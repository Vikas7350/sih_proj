'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Eye, Menu, X, ArrowRight, User } from 'lucide-react';
import CTAButton from './CTAButton';

const NAV = [
  { label: 'Home', href: '/' },
  { label: 'How It Works', href: '/how-it-works' },
  { label: 'Features', href: '/features' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<{ name?: string; email?: string } | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    fetch('/api/backend/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setUser(data))
      .catch(() => setUser(null));
  }, []);

  // Lock body scroll while the mobile menu is open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const floating = scrolled || open;

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        floating
          ? 'border-b border-white/10 bg-navy/80 backdrop-blur-xl shadow-lg'
          : 'border-b border-transparent bg-transparent'
      }`}
    >
      <nav
        className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8"
        aria-label="Primary"
      >
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2.5 text-white animate-fade-up"
          aria-label="NetraCare home"
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-electric text-navy shadow-md shadow-electric/20">
            <Eye className="h-5 w-5" strokeWidth={2.2} />
          </span>
          <span className="font-display text-lg font-bold tracking-tight">
            Netra<span className="text-electric">Care</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-7 md:flex">
          {NAV.map((item, i) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm font-medium transition-colors animate-fade-up ${
                  active ? 'text-electric' : 'text-white/80 hover:text-white'
                }`}
                style={{ animationDelay: `${120 + i * 60}ms` }}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Desktop CTAs */}
        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl bg-electric px-4 py-2 text-sm font-bold text-navy shadow-md shadow-electric/20 transition-all hover:brightness-110"
            >
              <User className="h-4 w-4" />
              <span>Dashboard ({user.name?.split(' ')[0] || 'User'})</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="px-4 py-2 text-sm font-semibold text-white/90 transition-colors hover:text-white animate-fade-up"
                style={{ animationDelay: '480ms' }}
              >
                Sign In
              </Link>
              <span className="animate-scale-in" style={{ animationDelay: '540ms' }}>
                <CTAButton href="/register" variant="primary">
                  Get Started <ArrowRight className="h-4 w-4" />
                </CTAButton>
              </span>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="grid h-10 w-10 place-items-center rounded-lg text-white transition-colors hover:bg-white/10 md:hidden focus-visible:outline-2 focus-visible:outline-electric"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {/* Mobile menu */}
      <div
        id="mobile-menu"
        className={`md:hidden overflow-hidden transition-[max-height,opacity] duration-300 ${
          open ? 'max-h-[24rem] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="space-y-1 border-t border-white/10 bg-navy/95 px-4 pb-6 pt-3">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`block rounded-lg px-3 py-2.5 text-base font-medium transition-colors ${
                  active ? 'text-electric bg-white/5' : 'text-white/85 hover:bg-white/5 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          <div className="flex flex-col gap-2 pt-4">
            {user ? (
              <Link
                href="/dashboard"
                onClick={() => setOpen(false)}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-electric px-5 py-3 text-sm font-semibold text-navy shadow-lg shadow-electric/20"
              >
                <User className="h-4 w-4" />
                <span>Go to Dashboard</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-white/20 px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-white/10"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-electric px-5 py-3 text-sm font-semibold text-navy shadow-lg shadow-electric/20 transition-all hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric"
                >
                  Get Started <ArrowRight className="h-4 w-4" />
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
