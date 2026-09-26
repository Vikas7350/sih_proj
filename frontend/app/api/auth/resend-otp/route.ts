import { NextRequest } from 'next/server';
import { resendOtpSchema } from '@/lib/validations';
import { apiError } from '@/lib/utils';
import { proxyMessage } from '@/lib/backend-proxy';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const validationResult = resendOtpSchema.safeParse(body);
    if (!validationResult.success) {
      const firstError =
        validationResult.error.issues[0]?.message || 'Invalid input data';
      return apiError(firstError, 400);
    }

    const { email, purpose } = validationResult.data;
    return proxyMessage('/api/auth/resend-otp', { email, purpose });
  } catch (error) {
    console.error('Resend OTP Proxy Error:', error);
    return apiError('Internal server error while resending OTP', 500);
  }
}
