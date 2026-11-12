import { Suspense } from 'react';
import SignupForm from './SignupForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Create an account', robots: { index: false, follow: false } };

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" />}>
      <SignupForm />
    </Suspense>
  );
}
