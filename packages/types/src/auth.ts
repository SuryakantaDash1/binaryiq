import { z } from 'zod';

/** Auth & registration DTOs — shared by the API (validation) and web (forms). */

export const genderEnum = z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']);

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[a-z]/, 'Include a lowercase letter')
  .regex(/[A-Z]/, 'Include an uppercase letter')
  .regex(/[0-9]/, 'Include a number');

// Step 1 — identity basics. Stored in a Redis draft, returns a draftId.
export const registerStep1Schema = z.object({
  country: z.string().min(2),
  firstName: z.string().min(1, 'First name is required'),
  surname: z.string().min(1, 'Surname is required'),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
  gender: genderEnum,
});
export type RegisterStep1Input = z.infer<typeof registerStep1Schema>;

export const registerStep1ResultSchema = z.object({ draftId: z.string() });
export type RegisterStep1Result = z.infer<typeof registerStep1ResultSchema>;

// Step 2 — account credentials. Completes registration, sends verification email.
export const registerStep2Schema = z.object({
  draftId: z.string().min(1),
  email: z.string().email('Enter a valid email'),
  password: passwordSchema,
  pinCode: z.string().min(4, 'Enter your PIN/postal code').max(12),
  username: z.string().min(3, 'Username must be at least 3 characters').max(30),
  mobile: z.string().min(6).max(20).optional(),
});
export type RegisterStep2Input = z.infer<typeof registerStep2Schema>;

export const registerStep2ResultSchema = z.object({
  email: z.string().email(),
  message: z.string(),
});
export type RegisterStep2Result = z.infer<typeof registerStep2ResultSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const authSessionSchema = z.object({
  accessToken: z.string(),
  user: z.object({
    id: z.string(),
    email: z.string().email(),
    username: z.string(),
    isVerified: z.boolean(),
  }),
});
export type AuthSession = z.infer<typeof authSessionSchema>;

export const verifyEmailResultSchema = z.object({
  verified: z.boolean(),
  pointsAwarded: z.number(),
});
export type VerifyEmailResult = z.infer<typeof verifyEmailResultSchema>;

export const forgotPasswordSchema = z.object({ email: z.string().email() });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
