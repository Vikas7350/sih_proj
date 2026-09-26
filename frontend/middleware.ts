import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, verifyToken } from '@/lib/auth/token';

/**
 * Route guard for the backend-owned cookie session. Protects the dashboard +
 * onboarding; sends authenticated users away from the auth pages.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const payload = token ? await verifyToken(token) : null;
  const isAuthed = payload !== null;
  const phcId = (payload?.phcId as string) || (payload?.phc_id as string) || null;
  const needsProfile = payload ? (Boolean(payload.needs_profile) || !phcId) : false;

  const isDashboard = pathname.startsWith('/dashboard');
  const isOnboarding = pathname === '/onboarding';
  const isProtected = isDashboard || isOnboarding;
  const isAuthPage =
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/verify-email' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password';

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
  matcher: ['/dashboard/:path*', '/onboarding', '/login', '/register', '/verify-email', '/forgot-password', '/reset-password'],
};