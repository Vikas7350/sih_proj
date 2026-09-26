import { redirect } from 'next/navigation';

export default function ScreeningRedirectPage() {
  redirect('/dashboard/screening/new');
}
