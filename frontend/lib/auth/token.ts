/**
 * Backend-owned session: a single httpOnly `dr_token` cookie holding the backend's
 * HS256 JWT. This module verifies it everywhere (middleware + server components).
 * Edge-safe (no node-only imports); do not add server-only code here.
 */
import { jwtVerify } from 'jose';

export const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME || 'dr_token';

function getAuthSecret(): Uint8Array | null {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    console.error('[auth] FATAL: AUTH_SECRET is not defined in environment variables!');
    return null;
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
  const secretKey = getAuthSecret();
  if (!secretKey) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ['HS256'],
      clockTolerance: '60s',
    });
    return payload as unknown as Record<string, unknown>;
  } catch (err: unknown) {
    const errName = err instanceof Error ? err.name : 'UnknownError';
    const errCode = (err as { code?: string })?.code || 'N/A';
    const errMsg = err instanceof Error ? err.message : String(err);
    const secretPresent = Boolean(process.env.AUTH_SECRET);
    const secretLength = process.env.AUTH_SECRET ? process.env.AUTH_SECRET.length : 0;

    console.error('[auth] JWT verification failed:', {
      error: errName,
      code: errCode,
      message: errMsg,
      authSecretPresent: secretPresent,
      authSecretLength: secretLength,
    });
    return null;
  }
}