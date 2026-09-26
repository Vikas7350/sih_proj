'use client';

import { useState, createContext, useContext } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Eye,
  Users,
  History,
  FileText,
  Building2,
  LogOut,
  ChevronRight,
  ShieldCheck,
  X,
} from 'lucide-react';
import SidebarNav from './SidebarNav';
import HeaderNav from './HeaderNav';

interface DrawerContextType {
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  toggleDrawer: () => void;
}

const DrawerContext = createContext<DrawerContextType>({
  drawerOpen: false,
  setDrawerOpen: () => {},
  toggleDrawer: () => {},
});

export const useDrawer = () => useContext(DrawerContext);

export default function DashboardShell({
  user,
  children,
}: {
  user: any;
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const toggleDrawer = () => setDrawerOpen((prev) => !prev);

  const navItems = [
    {
      name: 'PHC dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      name: 'New screening',
      href: '/dashboard/screening/new',
      icon: Eye,
      badge: 'AI Screening',
    },
    {
      name: 'Patients',
      href: '/dashboard/patients',
      icon: Users,
      badge: null,
    },
    {
      name: 'Screening history',
      href: '/dashboard/screenings',
      icon: History,
      badge: null,
    },
    {
      name: 'Screening reports',
      href: '/dashboard/reports',
      icon: FileText,
      badge: null,
    },
    {
      name: 'PHC profile & settings',
      href: '/dashboard/phc',
      icon: Building2,
      badge: null,
    },
  ];

  return (
    <DrawerContext.Provider value={{ drawerOpen, setDrawerOpen, toggleDrawer }}>
      <div className="min-h-screen bg-mist-100 text-ink-900 flex flex-col md:flex-row relative">
        {/* 1. Desktop Sidebar Icon Rail (Fixed 64px) */}
        <div className="hidden md:block w-[64px] shrink-0 h-screen sticky top-0 z-30">
          <SidebarNav user={user} />
        </div>

        {/* 2. Main Content Viewport */}
        <div className="flex-1 flex flex-col min-w-0 min-h-screen">
          <HeaderNav user={user} />

          <main className="flex-1 w-full py-6 px-8 space-y-6">
            {children}
          </main>
        </div>

        {/* 3. Root-Level 260px Overlay Drawer (z-50, overlays EVERYTHING from top-0 left-0) */}
        {drawerOpen && (
          <div className="fixed inset-0 z-50 flex">
            {/* Backdrop Scrim */}
            <div
              className="fixed inset-0 bg-ink-900/50 backdrop-blur-xs transition-opacity duration-240 cursor-pointer"
              onClick={() => setDrawerOpen(false)}
            />

            {/* Slide-out 260px Drawer Panel */}
            <aside className="relative w-[260px] max-w-xs h-full bg-petrol-900 text-slate-100 border-r border-line-200 flex flex-col justify-between z-50 shadow-2xl transition-transform duration-240 ease-out select-none">
              <div>
                {/* Header with Close Button */}
                <div className="p-5 border-b border-white/10 flex items-center justify-between">
                  <Link
                    href="/dashboard"
                    onClick={() => setDrawerOpen(false)}
                    className="flex items-center gap-3 group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-petrol-600 text-white flex items-center justify-center border border-white/10 group-hover:scale-105 transition-transform">
                      <Eye className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="font-extrabold text-base text-white tracking-tight leading-tight block">
                        Netra<span className="text-teal-300">Care</span>
                      </span>
                      <span className="text-xs text-slate-300 font-medium">
                        PHC DR Screening AI
                      </span>
                    </div>
                  </Link>

                  <button
                    type="button"
                    onClick={() => setDrawerOpen(false)}
                    aria-label="Close navigation drawer"
                    className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Navigation Items */}
                <nav className="p-3 space-y-1">
                  <div className="px-3 py-1.5 text-xs font-semibold text-slate-400">
                    Main navigation
                  </div>
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
                        onClick={() => setDrawerOpen(false)}
                        className={`flex items-center justify-between py-2 text-sm transition-all group ${
                          isActive
                            ? 'border-l-4 border-petrol-600 bg-white/5 text-white font-semibold pl-3 pr-3.5 rounded-r-md'
                            : 'text-slate-300 hover:text-white hover:bg-white/5 pl-3.5 pr-3.5 rounded-md'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon
                            className={`w-4 h-4 transition-colors ${
                              isActive ? 'text-teal-300' : 'text-slate-400 group-hover:text-slate-200'
                            }`}
                          />
                          <span>{item.name}</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {item.badge && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-petrol-600/30 text-teal-200 border border-petrol-600/40">
                              {item.badge}
                            </span>
                          )}
                          {isActive && <ChevronRight className="w-3.5 h-3.5 text-teal-300" />}
                        </div>
                      </Link>
                    );
                  })}
                </nav>
              </div>

              {/* Footer User Info & Sign Out */}
              <div className="p-3 border-t border-white/10 bg-black/20">
                <div className="p-2.5 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <div className="w-8 h-8 rounded-full bg-petrol-600 border border-white/20 text-white flex items-center justify-center font-bold text-xs shrink-0">
                      {user?.name ? user.name[0].toUpperCase() : 'W'}
                    </div>
                    <div className="overflow-hidden">
                      <div className="text-xs font-semibold text-white truncate">
                        {user?.name || 'Healthcare Worker'}
                      </div>
                      <div className="text-[10px] text-slate-300 truncate flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-teal-300 shrink-0" />
                        <span>Authenticated</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={async () => {
                      setIsLoggingOut(true);
                      await fetch('/api/backend/auth/logout', { method: 'POST' }).catch(() => {});
                      router.push('/login');
                      router.refresh();
                    }}
                    disabled={isLoggingOut}
                    title={isLoggingOut ? 'Signing out...' : 'Sign Out'}
                    className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </DrawerContext.Provider>
  );
}
