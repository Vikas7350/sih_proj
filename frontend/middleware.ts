import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';
const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME || 'dr_token';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;

  const isDashboard = pathname.startsWith('/dashboard');
  const isOnboarding = pathname === '/onboarding';
  const isProtected = isDashboard || isOnboarding;

  const isAuthPage =
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/verify-email' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password';

  let isAuthed = false;
  let needsProfile = false;

  if (token) {
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
        headers: {
          Cookie: `${SESSION_COOKIE}=${token}`,
        },
        cache: 'no-store',
      });

      if (response.ok) {
        const user = await response.json();
        isAuthed = true;
        needsProfile = Boolean(user?.needs_profile) || !user?.phc_id;
      }
    } catch {
      isAuthed = false;
    }
  }

  if (isProtected && !isAuthed) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (isDashboard && isAuthed && needsProfile) {
    const url = req.nextUrl.clone();
    url.pathname = '/onboarding';
    return NextResponse.redirect(url);
  }

  if (isOnboarding && isAuthed && !needsProfile) {
    const url = req.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  if (isAuthPage && isAuthed) {
    const url = req.nextUrl.clone();
    url.pathname = needsProfile ? '/onboarding' : '/dashboard';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/onboarding',
    '/login',
    '/register',
    '/verify-email',
    '/forgot-password',
    '/reset-password',
  ],
};