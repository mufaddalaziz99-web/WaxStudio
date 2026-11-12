import { Suspense } from 'react';
import ForgotPasswordForm from './ForgotPasswordForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Reset your password', robots: { index: false, follow: false } };

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" />}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
