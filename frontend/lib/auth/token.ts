/**
 * Backend-owned session: a single httpOnly `dr_token` cookie holding the backend's
 * HS256 JWT. This module verifies it everywhere (middleware + server components).
 * Edge-safe (no node-only imports); do not add server-only code here.
 */
import { jwtVerify } from 'jose';

export const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME || 'dr_token';

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET || '';
  if (!secret && typeof window === 'undefined') {
    console.warn('[AUTH] Warning: process.env.AUTH_SECRET is empty. Ensure AUTH_SECRET is set in AWS Amplify environment variables.');
  }
  return new TextEncoder().encode(secret);
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
  phcId: string | null;
  provider: string;
  needsProfile: boolean;
}

export interface Session {
  user: SessionUser;
}

export function toSessionUser(payload: Record<string, unknown>): SessionUser {
  const phcId = ((payload.phcId as string) ?? (payload.phc_id as string) ?? null) || null;
  return {
    id: (payload.sub as string) || (payload.id as string) || '',
    email: (payload.email as string) || '',
    name: (payload.name as string) || '',
    role: (payload.role as string) || 'phc_staff',
    phcId: phcId,
    provider: (payload.provider as string) || 'credentials',
    needsProfile: Boolean(payload.needs_profile) || !phcId,
  };
}

/** Verify the token bytes were signed with our AUTH_SECRET. Returns raw payload. */
export async function verifyToken(token: string): Promise<Record<string, unknown> | null> {
  if (!token) return null;
  try {
    const key = secretKey();
    if (!key.length) return null;
    const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
    return payload as unknown as Record<string, unknown>;
  } catch {
    return null;
  }
}
