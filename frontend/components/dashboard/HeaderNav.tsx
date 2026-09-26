'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X, Eye, PlusCircle, Building2, UserCheck } from 'lucide-react';
import SidebarNav from './SidebarNav';
import { getPHCProfile } from '@/lib/api/phc';
import { PHCProfile } from '@/lib/api/types';

import { useDrawer } from './DashboardShell';

interface HeaderNavProps {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export default function HeaderNav({ user }: HeaderNavProps) {
  const { drawerOpen, toggleDrawer } = useDrawer();
  const [phc, setPHC] = useState<PHCProfile | null>(null);

  useEffect(() => {
    async function loadHeaderPHC() {
      try {
        const data = await getPHCProfile();
        setPHC(data);
      } catch (err) {
        console.error('Failed to load header PHC info:', err);
      }
    }
    loadHeaderPHC();
  }, []);

  return (
    <header className="h-16 bg-paper-0 border-b border-line-200 sticky top-0 z-40 px-6 flex items-center justify-between">
      {/* Left: Menu Toggle & PHC info */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleDrawer}
          className="p-2 rounded-lg text-ink-900 hover:bg-mist-100 cursor-pointer"
          aria-label="Toggle Navigation Drawer"
          title="Toggle navigation drawer"
        >
          {drawerOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        <div className="md:hidden flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-petrol-600 text-white flex items-center justify-center font-bold">
            <Eye className="w-5 h-5" />
          </div>
          <span className="font-bold text-sm text-ink-900 tracking-tight">
            Netra<span className="text-petrol-600">Care</span> PHC
          </span>
        </div>

        <div className="hidden md:flex items-center gap-2 text-xs text-ink-900 bg-mist-100 px-3 py-1.5 rounded-lg border border-line-200 font-semibold">
          <Building2 className="w-4 h-4 text-petrol-600 shrink-0" />
          <span>{phc?.name || 'Alandi Rural PHC'} ({phc?.code || 'PHC-001'})</span>
        </div>
      </div>

      {/* Right Quick Actions */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 text-xs text-ink-900 bg-mist-100 px-3 py-1.5 rounded-lg border border-line-200 font-semibold">
          <UserCheck className="w-3.5 h-3.5 text-petrol-600" />
          <span>{user?.name || 'Healthcare Worker'}</span>
        </div>

        <Link
          href="/dashboard/screening/new"
          className="flex items-center gap-1.5 px-4 py-2 bg-petrol-600 hover:bg-[#0c595c] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          <span>+ New Patient Screening</span>
        </Link>
      </div>
    </header>
  );
}
