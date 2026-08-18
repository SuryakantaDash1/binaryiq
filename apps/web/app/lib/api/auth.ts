import type {
  RegisterStep1Input,
  RegisterStep1Result,
  RegisterStep2Input,
  RegisterStep2Result,
  LoginInput,
  AuthSession,
  VerifyEmailResult,
  ForgotPasswordInput,
  ResetPasswordInput,
} from '@influencer/types';

import { apiFetch } from './client';

export const authApi = {
  registerStep1: (body: RegisterStep1Input) =>
    apiFetch<RegisterStep1Result>('/auth/register/step1', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  registerStep2: (body: RegisterStep2Input) =>
    apiFetch<RegisterStep2Result>('/auth/register/step2', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  verifyEmail: (token: string) =>
    apiFetch<VerifyEmailResult>(`/auth/verify-email?token=${encodeURIComponent(token)}`),

  login: (body: LoginInput) =>
    apiFetch<AuthSession>('/auth/login', {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify(body),
    }),

  forgotPassword: (body: ForgotPasswordInput) =>
    apiFetch<{ success: true }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  resetPassword: (body: ResetPasswordInput) =>
    apiFetch<{ success: true }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};
