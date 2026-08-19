import { z } from 'zod';

import { passwordSchema } from './auth.js';

export const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(60),
  surname: z.string().min(1).max(60),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format'),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changeEmailSchema = z.object({
  email: z.string().email(),
});
export type ChangeEmailInput = z.infer<typeof changeEmailSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const updatePaypalSchema = z.object({
  paypalEmail: z.string().email('Enter a valid PayPal email'),
});
export type UpdatePaypalInput = z.infer<typeof updatePaypalSchema>;

export const updateAboutYouSchema = z.object({
  address: z
    .object({
      line1: z.string().max(120).optional(),
      city: z.string().max(60).optional(),
      pinCode: z.string().max(10).optional(),
      areaType: z.enum(['URBAN', 'RURAL', 'SUBURBAN']).optional(),
    })
    .optional(),
  demographics: z
    .object({
      educationLevel: z.enum(['secondary', 'graduate', 'postgrad', 'other']).optional(),
      employmentType: z.enum(['salaried', 'self_employed', 'student', 'homemaker', 'retired', 'unemployed']).optional(),
      incomeBracket: z.string().optional(),
      householdSize: z.number().int().min(1).max(20).optional(),
      childrenCount: z.number().int().min(0).max(15).optional(),
      chiefWageEarner: z.boolean().optional(),
    })
    .optional(),
});
export type UpdateAboutYouInput = z.infer<typeof updateAboutYouSchema>;
