import { NextRequest } from 'next/server';
import { registerSchema } from '@/lib/validations';
import { apiError, apiSuccess } from '@/lib/utils';
import { backendFetch } from '@/lib/backend-proxy';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const validationResult = registerSchema.safeParse(body);
    if (!validationResult.success) {
      const firstError =
        validationResult.error.issues[0]?.message || 'Invalid input data';
      return apiError(firstError, 400);
    }

    const payload = {
      name: body.name,
      email: body.email,
      password: body.password,
      facility_id: body.facilityId || body.phcCode,
      phc_name: body.phcName || '',
      phc_code: body.facilityId || body.phcCode || '',
      state: body.state || '',
      district: body.district || '',
      address: body.address || '',
      contact_number: body.contactNumber,
    };

    const { ok, status, json } = await backendFetch('/api/auth/register', {
      body: payload,
    });

    const errorMsg = typeof json?.detail === 'string' ? json.detail : (json?.detail?.message || 'Account registration failed');
    if (!ok) return apiError(errorMsg, status);

    return apiSuccess(
      'PHC account created successfully. Please verify your email with the OTP sent to your address.',
      {
        email: json.email,
        phcId: json.phc_id,
        phcName: '',
        verifyRequired: true,
      },
      201
    );
  } catch (error) {
    console.error('Registration Proxy Error:', error);
    return apiError('Internal server error during account registration', 500);
  }
}
