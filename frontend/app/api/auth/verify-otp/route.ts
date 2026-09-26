import { NextRequest } from 'next/server';
import { verifyOtpSchema } from '@/lib/validations';
import { apiError } from '@/lib/utils';
import { proxyMessage } from '@/lib/backend-proxy';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const validationResult = verifyOtpSchema.safeParse(body);
    if (!validationResult.success) {
      const firstError =
        validationResult.error.issues[0]?.message || 'Invalid input data';
      return apiError(firstError, 400);
    }

    const { email, otp, purpose } = validationResult.data;
    return proxyMessage('/api/auth/verify-otp', {
      email,
      otp,
      purpose,
    });
  } catch (error) {
    console.error('Verify OTP Proxy Error:', error);
    return apiError('Internal server error during OTP verification', 500);
  }
}
