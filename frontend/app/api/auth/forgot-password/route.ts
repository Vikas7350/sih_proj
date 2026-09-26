import { NextRequest } from 'next/server';
import { forgotPasswordSchema } from '@/lib/validations';
import { apiError } from '@/lib/utils';
import { proxyMessage } from '@/lib/backend-proxy';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const validationResult = forgotPasswordSchema.safeParse(body);
    if (!validationResult.success) {
      const firstError =
        validationResult.error.issues[0]?.message || 'Invalid email address';
      return apiError(firstError, 400);
    }

    const { email } = validationResult.data;
    return proxyMessage('/api/auth/forgot-password', { email });
  } catch (error) {
    console.error('Forgot Password Proxy Error:', error);
    return apiError('Internal server error processing request', 500);
  }
}
