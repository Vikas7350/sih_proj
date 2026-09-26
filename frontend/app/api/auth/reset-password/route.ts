import { NextRequest } from 'next/server';
import { resetPasswordSchema } from '@/lib/validations';
import { apiError } from '@/lib/utils';
import { proxyMessage } from '@/lib/backend-proxy';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const validationResult = resetPasswordSchema.safeParse(body);
    if (!validationResult.success) {
      const firstError =
        validationResult.error.issues[0]?.message || 'Invalid input data';
      return apiError(firstError, 400);
    }

    const { email, otp, password } = validationResult.data;
    return proxyMessage('/api/auth/reset-password', { email, otp, password });
  } catch (error) {
    console.error('Reset Password Proxy Error:', error);
    return apiError('Internal server error updating password', 500);
  }
}
