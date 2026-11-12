'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/client/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import AuthShell, { FormError, Spinner } from '@/components/auth/AuthShell';
import CodeInput from '@/components/auth/CodeInput';
import { clearPendingEmail, getPendingEmail, safeNext, setPendingEmail, withNext } from '@/components/auth/authHelpers';

const RESEND_COOLDOWN = 30;

export default function VerifyEmailForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get('next'));
  const { refresh } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [editingEmail, setEditingEmail] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    const pending = getPendingEmail();
    if (pending) {
      setEmail(pending);
      setCooldown(RESEND_COOLDOWN); // a code was just sent by sign-up / sign-in
    } else {
      setEditingEmail(true);
    }
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function verify(value = code) {
    if (busy) return;
    setError('');
    if (!email) return setError('Enter the email you signed up with.');
    if (!/^\d{6}$/.test(value)) return setError('Enter the 6-digit code from your email.');
    setBusy(true);
    try {
      const { user } = await api('/api/auth/verify', { method: 'POST', body: { email, code: value } });
      clearPendingEmail();
      await refresh();
      toast.success(user?.name ? `You're all set, ${user.name.split(' ')[0]}!` : 'Email verified');
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(err.message);
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setError('');
    if (!email) return setError('Enter your email first.');
    try {
      await api('/api/auth/resend-code', { method: 'POST', body: { email } });
      setPendingEmail(email);
      setEditingEmail(false);
      setCooldown(RESEND_COOLDOWN);
      toast.info('If that email needs verifying, a new code is on its way');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <AuthShell
      title="Check your email"
      subtitle={
        email && !editingEmail ? (
          <>
            We sent a 6-digit code to <b className="text-ink">{email}</b>. It expires in 15 minutes.{' '}
            <button type="button" onClick={() => setEditingEmail(true)} className="font-semibold text-ink underline decoration-brand-400 decoration-2 underline-offset-2 hover:underline">
              Change
            </button>
          </>
        ) : (
          'Enter your email and the 6-digit code we sent you.'
        )
      }
      footer={
        <Link href={withNext('/login', next)} className="font-semibold text-ink underline decoration-brand-400 decoration-2 underline-offset-2 hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          verify();
        }}
        className="space-y-5"
        noValidate
      >
        {editingEmail && (
          <div>
            <label htmlFor="email" className="label">Email</label>
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value.trim().toLowerCase())}
              required
            />
          </div>
        )}
        <div>
          <span className="label">Verification code</span>
          <CodeInput value={code} onChange={setCode} onComplete={(v) => verify(v)} disabled={busy} invalid={Boolean(error)} autoFocus={!editingEmail} />
        </div>
        <FormError>{error}</FormError>
        <button type="submit" className="btn-primary w-full" disabled={busy || code.length !== 6}>
          {busy && <Spinner />} Verify email
        </button>
        <p className="text-center text-sm text-ink-soft">
          Didn&apos;t get it? Check spam, or{' '}
          {cooldown > 0 ? (
            <span className="text-ink-muted">resend in {cooldown}s</span>
          ) : (
            <button type="button" onClick={resend} className="font-semibold text-ink underline decoration-brand-400 decoration-2 underline-offset-2 hover:underline">
              send a new code
            </button>
          )}
        </p>
      </form>
    </AuthShell>
  );
}
