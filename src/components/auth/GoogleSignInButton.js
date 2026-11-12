'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { api } from '@/lib/client/api';

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

/**
 * "Sign in with Google" via Google Identity Services. Renders nothing unless
 * NEXT_PUBLIC_GOOGLE_CLIENT_ID is set. Calls onSuccess(user) after the session cookie is set.
 */
export default function GoogleSignInButton({ onSuccess, onError, text = 'continue_with' }) {
  const ref = useRef(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const handlers = useRef({ onSuccess, onError });
  handlers.current = { onSuccess, onError };

  const handleCredential = useCallback(async (response) => {
    if (!response?.credential) return;
    setBusy(true);
    try {
      const { user } = await api('/api/auth/google', { method: 'POST', body: { credential: response.credential } });
      await handlers.current.onSuccess?.(user);
    } catch (e) {
      handlers.current.onError?.(e.message || 'Google sign-in failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!CLIENT_ID) return;
    if (window.google?.accounts?.id) setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || !ref.current || !window.google?.accounts?.id) return;
    window.google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: handleCredential,
      ux_mode: 'popup',
      cancel_on_tap_outside: true,
    });
    const width = Math.min(400, Math.max(200, Math.floor(ref.current.offsetWidth || 320)));
    window.google.accounts.id.renderButton(ref.current, {
      type: 'standard', theme: 'outline', size: 'large', shape: 'pill', text, width, logo_alignment: 'center',
    });
  }, [ready, handleCredential, text]);

  if (!CLIENT_ID) return null;

  return (
    <div className="space-y-4">
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onReady={() => setReady(true)} />
      <div className="relative flex min-h-[44px] justify-center">
        <div ref={ref} className={`flex w-full justify-center ${busy ? 'pointer-events-none opacity-50' : ''}`} />
        {!ready && <div className="absolute inset-0 h-11 animate-pulse rounded-full bg-ink/5" aria-hidden />}
      </div>
      <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
        <span className="h-px flex-1 bg-ink/10" />
        or
        <span className="h-px flex-1 bg-ink/10" />
      </div>
    </div>
  );
}
