'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Eye,
  Users,
  History,
  FileText,
  Building2,
} from 'lucide-react';
import { useDrawer } from './DashboardShell';

interface SidebarNavProps {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export default function SidebarNav({ user }: SidebarNavProps) {
  const pathname = usePathname();
  const { toggleDrawer } = useDrawer();

  const navItems = [
    {
      name: 'PHC dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
    },
    {
      name: 'New screening',
      href: '/dashboard/screening/new',
      icon: Eye,
    },
    {
      name: 'Patients',
      href: '/dashboard/patients',
      icon: Users,
    },
    {
      name: 'Screening history',
      href: '/dashboard/screenings',
      icon: History,
    },
    {
      name: 'Screening reports',
      href: '/dashboard/reports',
      icon: FileText,
    },
    {
      name: 'PHC profile & settings',
      href: '/dashboard/phc',
      icon: Building2,
    },
  ];

  return (
    <aside className="w-[64px] bg-petrol-900 text-slate-100 border-r border-line-200 flex flex-col justify-between items-center py-4 h-full select-none shrink-0">
      <div className="flex flex-col items-center gap-6 w-full">
        {/* Logo & Drawer Toggle Icon */}
        <button
          type="button"
          onClick={toggleDrawer}
          title="Expand navigation drawer"
          aria-label="Expand navigation drawer"
          className="w-10 h-10 rounded-xl bg-petrol-600 text-white flex items-center justify-center border border-white/10 hover:scale-105 transition-transform cursor-pointer shadow-xs"
        >
          <Eye className="w-5 h-5" />
        </button>

        {/* Icon Navigation Links */}
        <nav className="flex flex-col items-center gap-2 w-full px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.name}
                href={item.href}
                title={item.name}
                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all group relative ${
                  isActive
                    ? 'bg-white/10 text-teal-300 border-l-2 border-petrol-600 font-semibold'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-teal-300' : 'group-hover:text-slate-200'}`} />
                {/* Tooltip */}
                <span className="absolute left-full ml-3 px-2.5 py-1 bg-petrol-900 text-white text-xs rounded-md shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap border border-white/10">
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User Initials Avatar at bottom */}
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={toggleDrawer}
          title={user?.name || 'Healthcare Worker'}
          className="w-9 h-9 rounded-full bg-petrol-600 border border-white/20 text-white flex items-center justify-center font-bold text-xs cursor-pointer hover:ring-2 hover:ring-teal-400 transition-all"
        >
          {user?.name ? user.name[0].toUpperCase() : 'W'}
        </button>
      </div>
    </aside>
  );
}
