import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import OnboardingForm from '@/components/auth/OnboardingForm';

export const metadata = { title: 'Complete Your Profile | NetraCare' };

export default async function OnboardingPage() {
  const session = await getSession();

  if (!session?.user) {
    redirect('/login');
  }

  if (!session.user.needsProfile) {
    // Profile already complete — don't let completed users back onto onboarding.
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-start justify-center py-10 px-4">
      <OnboardingForm
        initialName={session.user.name || ''}
        initialEmail={session.user.email || ''}
      />
    </div>
  );
}