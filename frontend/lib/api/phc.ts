import { PHCProfile } from './types';
import { INITIAL_PHC_PROFILE } from '../mockData';

export async function getPHCProfile(): Promise<PHCProfile> {
  try {
    const res = await fetch('/api/phc', { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        return json.data;
      }
    }
  } catch (e) {
    console.warn('Falling back to local PHC mock profile:', e);
  }
  return INITIAL_PHC_PROFILE;
}

export async function updatePHCProfile(data: Partial<PHCProfile>): Promise<PHCProfile> {
  try {
    const res = await fetch('/api/phc', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        return json.data;
      }
    }
  } catch (e) {
    console.warn('Falling back to local PHC update mock:', e);
  }

  return {
    ...INITIAL_PHC_PROFILE,
    ...data,
  };
}
