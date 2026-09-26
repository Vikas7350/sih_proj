'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { LogOut, User as UserIcon, Shield, Mail, Calendar, Loader2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface UserProfileProps {
  user: {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    provider?: string | null;
    createdAt?: Date | string | null;
  };
}

export default function UserProfile({ user }: UserProfileProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleSignOut = async () => {
    setIsLoggingOut(true);
    await fetch('/api/backend/auth/logout', { method: 'POST' }).catch(() => {});
    router.push('/login');
    router.refresh();
  };

  const getInitials = (name?: string | null) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const provider = user.provider || 'credentials';

  return (
    <div className="bg-paper-0 border border-line-200 rounded-xl p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-line-200">
        <div className="flex items-center gap-4">
          {/* Avatar or Fallback Initials */}
          <div className="relative w-16 h-16 rounded-full overflow-hidden bg-petrol-600/10 border-2 border-petrol-600/30 flex items-center justify-center text-petrol-600 font-bold text-xl shrink-0">
            {user.image ? (
              <Image
                src={user.image}
                alt={user.name || 'User Avatar'}
                fill
                sizes="64px"
                className="object-cover"
              />
            ) : (
              <span>{getInitials(user.name)}</span>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-ink-900">
                {user.name || 'Healthcare Worker'}
              </h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-mist-100 text-petrol-600 border border-line-200">
                <Shield className="w-3 h-3" />
                {provider}
              </span>
            </div>
            <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1">
              <Mail className="w-3.5 h-3.5" />
              {user.email || 'No email provided'}
            </p>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 px-4 py-2 bg-mist-100 hover:bg-slate-200 text-ink-900 text-xs font-semibold rounded-lg border border-line-200 transition-colors cursor-pointer disabled:opacity-50"
        >
          {isLoggingOut ? (
            <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
          ) : (
            <LogOut className="w-4 h-4" />
          )}
          <span>{isLoggingOut ? 'Signing out...' : 'Sign out'}</span>
        </button>
      </div>

      {/* Quick Details Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 text-xs text-slate-600">
        <div className="flex items-center gap-2 bg-mist-100/50 p-3 rounded-lg border border-line-200">
          <UserIcon className="w-4 h-4 text-slate-400" />
          <div>
            <div className="text-slate-400 font-medium">User ID</div>
            <div className="font-mono text-ink-900 truncate max-w-[150px]">
              {user.id || 'N/A'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-mist-100/50 p-3 rounded-lg border border-line-200">
          <Shield className="w-4 h-4 text-slate-400" />
          <div>
            <div className="text-slate-400 font-medium">Auth provider</div>
            <div className="capitalize text-ink-900">
              {provider} OAuth / Credentials
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-mist-100/50 p-3 rounded-lg border border-line-200">
          <Calendar className="w-4 h-4 text-slate-400" />
          <div>
            <div className="text-slate-400 font-medium">Session status</div>
            <div className="text-petrol-600 font-semibold">
              Active session
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
