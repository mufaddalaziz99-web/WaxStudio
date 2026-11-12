import { Suspense } from 'react';
import VerifyEmailForm from './VerifyEmailForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Verify your email', robots: { index: false, follow: false } };

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" />}>
      <VerifyEmailForm />
    </Suspense>
  );
}
