'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/client/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { track } from '@/lib/client/analytics';
import AuthShell, { FormError, Spinner } from '@/components/auth/AuthShell';
import PasswordInput from '@/components/auth/PasswordInput';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';
import { safeNext, setPendingEmail, withNext } from '@/components/auth/authHelpers';

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get('next'));
  const { refresh } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function done(user, method) {
    track('login', { method });
    await refresh();
    toast.success(user?.name ? `Welcome back, ${user.name.split(' ')[0]}!` : 'Signed in');
    router.replace(next);
    router.refresh();
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { user } = await api('/api/auth/login', { method: 'POST', body: { email, password } });
      await done(user, 'password');
    } catch (err) {
      if (err.code === 'email_unverified') {
        setPendingEmail(err.data?.email || email.trim().toLowerCase());
        toast.info('Check your inbox for a verification code');
        router.push(withNext('/verify-email', next));
        return;
      }
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to see your orders, saved addresses and wishlist."
      footer={
        <>
          New here?{' '}
          <Link href={withNext('/signup', next)} className="font-semibold text-ink underline decoration-brand-400 decoration-2 underline-offset-2 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <GoogleSignInButton onSuccess={(u) => done(u, 'google')} onError={setError} />
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input
            id="email"
            type="email"
            className="input"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="label">Password</label>
            <Link href={withNext('/forgot-password', next)} className="mb-1.5 text-xs font-semibold text-ink underline decoration-brand-400 decoration-2 underline-offset-2 hover:underline">
              Forgot password?
            </Link>
          </div>
          <PasswordInput id="password" value={password} onChange={setPassword} />
        </div>
        <FormError>{error}</FormError>
        <button type="submit" className="btn-primary w-full" disabled={busy || !email || !password}>
          {busy && <Spinner />} Sign in
        </button>
      </form>
    </AuthShell>
  );
}
