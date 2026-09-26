/**
 * Server component auth helper. Reads the backend-issued session cookie and
 * verifies it locally (HS256, shared AUTH_SECRET). The backend is the single
 * authority for session creation; this just decodes what it issued.
 */
import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifyToken, toSessionUser, Session, SessionUser } from './token';

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload || !payload.sub) return null;

  const user: SessionUser = toSessionUser(payload);
  return { user };
}