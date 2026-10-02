import { PHCProfile } from './types';
import { INITIAL_PHC_PROFILE } from '../mockData';

export async function getPHCProfile(): Promise<PHCProfile> {
  try {
    const res = await fetch('/api/backend/phc/profile', { cache: 'no-store' });
    if (res.ok) {
      // Backend returns the profile bare, already in PHCProfile's camelCase shape.
      const json = await res.json();
      if (json?.name) {
        return json as PHCProfile;
      }
    }
  } catch (e) {
    console.warn('Falling back to local PHC mock profile:', e);
  }
  return INITIAL_PHC_PROFILE;
}

export async function updatePHCProfile(data: Partial<PHCProfile>): Promise<PHCProfile> {
  try {
    const res = await fetch('/api/backend/phc/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const json = await res.json();
      if (json?.name) {
        return json as PHCProfile;
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
