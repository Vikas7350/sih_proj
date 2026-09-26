import { getSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import UserProfile from '@/components/dashboard/UserProfile';
import { User, ShieldCheck, HeartPulse } from 'lucide-react';

export default async function ProfilePage() {
  const session = await getSession();

  if (!session?.user) {
    redirect('/login');
  }

  const user = session.user;

  return (
    <div className="w-full space-y-8">
      {/* Header */}
      <div className="border-l-[3px] border-petrol-600 pl-3 py-0.5">
        <h1 className="text-2xl font-bold text-ink-900 tracking-tight">
          User profile
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Manage your account settings, authenticated identity, and healthcare screening preferences.
        </p>
      </div>

      {/* User Profile Card */}
      <UserProfile user={user} />

      {/* Security & Health Record Privacy Banner */}
      <div className="p-6 rounded-xl bg-paper-0 border border-line-200 space-y-3">
        <div className="flex items-center gap-2 text-petrol-600 font-bold text-sm">
          <ShieldCheck className="w-5 h-5" />
          <span>Health Record Privacy & Authentication Security</span>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          Your account is secured with backend-issued JWT sessions and MongoDB document protection. All health screening logs are protected and anonymized before being computed into community health insights.
        </p>

        <div className="pt-3 border-t border-line-200 flex flex-wrap gap-4 text-xs text-slate-600">
          <div className="flex items-center gap-1.5">
            <HeartPulse className="w-3.5 h-3.5 text-petrol-600" />
            <span>Health Screening ID: Active</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-petrol-600" />
            <span>OAuth & Password Security: Verified</span>
          </div>
        </div>
      </div>
    </div>
  );
}
