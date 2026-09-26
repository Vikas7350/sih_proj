import { getSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import DashboardShell from '@/components/dashboard/DashboardShell';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session?.user) {
    redirect('/login');
  }

  if (session.user.needsProfile) {
    redirect('/onboarding');
  }

  const user = session.user;

  return <DashboardShell user={user}>{children}</DashboardShell>;
}
