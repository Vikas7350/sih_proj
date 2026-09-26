import { z } from 'zod';

export const registerSchema = z
  .object({
    name: z
      .string()
      .min(2, { message: 'Name must be at least 2 characters long' })
      .max(50, { message: 'Name cannot exceed 50 characters' }),
    email: z
      .string()
      .min(1, { message: 'Email is required' })
      .email({ message: 'Please enter a valid email address' }),
    password: z
      .string()
      .min(8, { message: 'Password must be at least 8 characters long' })
      .max(100, { message: 'Password cannot exceed 100 characters' }),
    confirmPassword: z
      .string()
      .min(1, { message: 'Please confirm your password' }),
    // PHC Registration Fields
    facilityId: z
      .string()
      .min(1, { message: 'Please select a registered PHC facility' })
      .optional(),
    phcName: z.string().optional(),
    phcCode: z.string().optional(),
    state: z.string().optional(),
    district: z.string().optional(),
    address: z.string().optional(),
    contactNumber: z
      .string()
      .min(8, { message: 'Contact Number must be at least 8 digits' }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, { message: 'Email is required' })
    .email({ message: 'Please enter a valid email address' }),
  password: z
    .string()
    .min(1, { message: 'Password is required' }),
});

export const onboardingSchema = z.object({
  name: z
    .string()
    .max(50, { message: 'Name cannot exceed 50 characters' })
    .optional(),
  phcName: z
    .string()
    .min(2, { message: 'PHC Name must be at least 2 characters' })
    .max(100, { message: 'PHC Name cannot exceed 100 characters' }),
  phcCode: z
    .string()
    .min(2, { message: 'PHC Code is required' })
    .max(30, { message: 'PHC Code cannot exceed 30 characters' }),
  state: z
    .string()
    .min(2, { message: 'State is required' }),
  district: z
    .string()
    .min(2, { message: 'District is required' }),
  address: z
    .string()
    .min(5, { message: 'Address must be at least 5 characters' }),
  contactNumber: z
    .string()
    .min(8, { message: 'Contact Number must be at least 8 digits' }),
});

export const verifyOtpSchema = z.object({
  email: z
    .string()
    .min(1, { message: 'Email is required' })
    .email({ message: 'Please enter a valid email address' }),
  otp: z
    .string()
    .length(6, { message: 'OTP must be exactly 6 digits' })
    .regex(/^\d{6}$/, { message: 'OTP must contain digits only' }),
  purpose: z.enum(['email_verification', 'password_reset']),
});

export const resendOtpSchema = z.object({
  email: z
    .string()
    .min(1, { message: 'Email is required' })
    .email({ message: 'Please enter a valid email address' }),
  purpose: z.enum(['email_verification', 'password_reset']),
});

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, { message: 'Email is required' })
    .email({ message: 'Please enter a valid email address' }),
});

export const resetPasswordSchema = z
  .object({
    email: z
      .string()
      .min(1, { message: 'Email is required' })
      .email({ message: 'Please enter a valid email address' }),
    otp: z
      .string()
      .length(6, { message: 'OTP must be exactly 6 digits' })
      .regex(/^\d{6}$/, { message: 'OTP must contain digits only' }),
    password: z
      .string()
      .min(8, { message: 'Password must be at least 8 characters long' })
      .max(100, { message: 'Password cannot exceed 100 characters' }),
    confirmPassword: z
      .string()
      .min(1, { message: 'Please confirm your password' }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type ResendOtpInput = z.infer<typeof resendOtpSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
