import { NextResponse } from 'next/server';
import { apiError, apiSuccess } from '@/lib/utils';

export const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

export async function backendFetch(
  path: string,
  opts: { method?: string; body?: unknown; token?: string } = {}
): Promise<{ ok: boolean; status: number; json: any }> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: opts.method || 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: 'no-store',
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

// Auth endpoints return { message } on success, { detail } on error.
export async function proxyMessage(
  path: string,
  body: unknown
): Promise<NextResponse> {
  const { ok, status, json } = await backendFetch(path, { body });
  if (!ok) return apiError(json?.detail || 'Request failed', status);
  return apiSuccess(json?.message || 'Success');
}

// Authenticated endpoints return raw data, wrapped into the { success, data } envelope.
export async function proxyData(
  path: string,
  opts: { method?: string; body?: unknown; token?: string }
): Promise<NextResponse> {
  const { ok, status, json } = await backendFetch(path, {
    method: opts.method || 'GET',
    body: opts.body,
    token: opts.token,
  });
  if (!ok) return apiError(json?.detail || 'Request failed', status);
  return apiSuccess('Success', json);
}
