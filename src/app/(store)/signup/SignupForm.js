'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/client/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { track } from '@/lib/client/analytics';
import { signupSchema } from '@/lib/validation';
import AuthShell, { FormError, Spinner } from '@/components/auth/AuthShell';
import PasswordInput from '@/components/auth/PasswordInput';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';
import { safeNext, setPendingEmail, withNext } from '@/components/auth/authHelpers';

export default function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get('next'));
  const { refresh } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setFieldErrors((fe) => ({ ...fe, [k]: undefined }));
  };

  async function onGoogle(user) {
    track('sign_up', { method: 'google' });
    await refresh();
    toast.success(user?.name ? `Welcome, ${user.name.split(' ')[0]}!` : 'Signed in');
    router.replace(next);
    router.refresh();
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    const parsed = signupSchema.safeParse(form);
    if (!parsed.success) {
      const fe = {};
      for (const i of parsed.error.issues) fe[i.path[0]] ||= i.message;
      setFieldErrors(fe);
      return;
    }
    setBusy(true);
    try {
      await api('/api/auth/signup', { method: 'POST', body: parsed.data });
      track('sign_up', { method: 'email' });
      setPendingEmail(parsed.data.email);
      router.push(withNext('/verify-email', next));
    } catch (err) {
      if (err.code === 'email_taken') {
        setError(
          <>
            {err.message}{' '}
            <Link href={withNext('/login', next)} className="font-semibold underline">Sign in</Link>
            {' · '}
            <Link href={withNext('/forgot-password', next)} className="font-semibold underline">Reset password</Link>
          </>,
        );
      } else if (err.data?.field) {
        setFieldErrors({ [err.data.field]: err.message.replace(/^[^:]+:\s*/, '') });
      } else {
        setError(err.message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Track orders, save addresses and keep your wishlist across devices."
      footer={
        <>
          Already have an account?{' '}
          <Link href={withNext('/login', next)} className="font-semibold text-ink underline decoration-brand-400 decoration-2 underline-offset-2 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <GoogleSignInButton text="signup_with" onSuccess={onGoogle} onError={setError} />
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field id="name" label="Your name" error={fieldErrors.name}>
          <input
            id="name"
            className={`input ${fieldErrors.name ? 'input-error' : ''}`}
            autoComplete="name"
            value={form.name}
            onChange={(e) => set('name')(e.target.value)}
            required
          />
        </Field>
        <Field id="email" label="Email" error={fieldErrors.email}>
          <input
            id="email"
            type="email"
            inputMode="email"
            className={`input ${fieldErrors.email ? 'input-error' : ''}`}
            autoComplete="email"
            value={form.email}
            onChange={(e) => set('email')(e.target.value)}
            required
          />
        </Field>
        <Field id="password" label="Password" error={fieldErrors.password} hint="At least 8 characters">
          <PasswordInput
            id="password"
            value={form.password}
            onChange={set('password')}
            autoComplete="new-password"
            invalid={Boolean(fieldErrors.password)}
            minLength={8}
          />
        </Field>
        <FormError>{error}</FormError>
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy && <Spinner />} Create account
        </button>
        <p className="text-center text-xs text-ink-muted">
          By creating an account you agree to our{' '}
          <Link href="/policies/terms" className="underline">Terms</Link> and{' '}
          <Link href="/policies/privacy" className="underline">Privacy Policy</Link>.
        </p>
      </form>
    </AuthShell>
  );
}

function Field({ id, label, error, hint, children }) {
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}
