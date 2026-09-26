import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/utils';
import { backendFetch } from '@/lib/backend-proxy';

export async function GET(req: NextRequest) {
  try {
    const { ok, status, json } = await backendFetch('/api/phc/registry', {
      method: 'GET',
    });
    if (!ok) return apiError(json?.detail || 'Failed to fetch PHC registry', status);
    return apiSuccess('Registry loaded successfully', json);
  } catch (error) {
    console.error('GET /api/phc/registry Proxy Error:', error);
    return apiError('Internal server error fetching PHC registry', 500);
  }
}
