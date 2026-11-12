'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/client/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { passwordSchema } from '@/lib/validation';
import AuthShell, { FormError, Spinner } from '@/components/auth/AuthShell';
import CodeInput from '@/components/auth/CodeInput';
import PasswordInput from '@/components/auth/PasswordInput';
import { clearPendingEmail, safeNext, withNext } from '@/components/auth/authHelpers';

const RESEND_COOLDOWN = 30;

export default function ForgotPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get('next'));
  const { refresh } = useAuth();
  const toast = useToast();
  const [step, setStep] = useState('email'); // email -> reset
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendCode(e) {
    e?.preventDefault();
    setError('');
    const clean = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(clean)) return setError('Enter a valid email.');
    setBusy(true);
    try {
      await api('/api/auth/forgot-password', { method: 'POST', body: { email: clean } });
      setEmail(clean);
      setStep('reset');
      setCooldown(RESEND_COOLDOWN);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function reset(e) {
    e.preventDefault();
    setError('');
    if (!/^\d{6}$/.test(code)) return setError('Enter the 6-digit code from your email.');
    const pw = passwordSchema.safeParse(password);
    if (!pw.success) return setError(pw.error.issues[0]?.message || 'Choose a stronger password.');
    setBusy(true);
    try {
      await api('/api/auth/reset-password', { method: 'POST', body: { email, code, password } });
      clearPendingEmail();
      await refresh();
      toast.success('Password updated — you are signed in');
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const footer = (
    <Link href={withNext('/login', next)} className="font-semibold text-ink underline decoration-brand-400 decoration-2 underline-offset-2 hover:underline">
      Back to sign in
    </Link>
  );

  if (step === 'email') {
    return (
      <AuthShell title="Forgot your password?" subtitle="Enter your email and we'll send you a code to set a new one." footer={footer}>
        <form onSubmit={sendCode} className="space-y-4" noValidate>
          <div>
            <label htmlFor="email" className="label">Email</label>
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              required
            />
          </div>
          <FormError>{error}</FormError>
          <button type="submit" className="btn-primary w-full" disabled={busy || !email}>
            {busy && <Spinner />} Send reset code
          </button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Set a new password"
      subtitle={
        <>
          If an account exists for <b className="text-ink">{email}</b>, a 6-digit code is on its way.{' '}
          <button type="button" onClick={() => { setStep('email'); setCode(''); setError(''); }} className="font-semibold text-ink underline decoration-brand-400 decoration-2 underline-offset-2 hover:underline">
            Change email
          </button>
        </>
      }
      footer={footer}
    >
      <form onSubmit={reset} className="space-y-5" noValidate>
        <div>
          <span className="label">Reset code</span>
          <CodeInput value={code} onChange={setCode} disabled={busy} />
        </div>
        <div>
          <label htmlFor="new-password" className="label">New password</label>
          <PasswordInput id="new-password" value={password} onChange={setPassword} autoComplete="new-password" minLength={8} />
          <p className="mt-1 text-xs text-ink-muted">At least 8 characters</p>
        </div>
        <FormError>{error}</FormError>
        <button type="submit" className="btn-primary w-full" disabled={busy || code.length !== 6 || !password}>
          {busy && <Spinner />} Update password &amp; sign in
        </button>
        <p className="text-center text-sm text-ink-soft">
          No email?{' '}
          {cooldown > 0 ? (
            <span className="text-ink-muted">Resend in {cooldown}s</span>
          ) : (
            <button type="button" onClick={() => sendCode()} className="font-semibold text-ink underline decoration-brand-400 decoration-2 underline-offset-2 hover:underline">
              Send a new code
            </button>
          )}
        </p>
      </form>
    </AuthShell>
  );
}
