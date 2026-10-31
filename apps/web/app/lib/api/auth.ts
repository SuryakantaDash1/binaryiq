import type {
  RegisterStep1Input,
  RegisterStep1Result,
  RegisterStep2Input,
  RegisterStep2Result,
  LoginInput,
  AuthSession,
  VerifyEmailResult,
  ForgotPasswordInput,
  ResendVerificationInput,
  ResetPasswordInput,
} from '@binaryiq/types';

import { apiFetch } from './client';
import { clearToken, setToken } from './session.js';

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

  /** Always succeeds — the API never reveals whether the address has an account. */
  resendVerification: (body: ResendVerificationInput) =>
    apiFetch<{ success: true }>('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  verifyEmail: (token: string) =>
    apiFetch<VerifyEmailResult>(`/auth/verify-email?token=${encodeURIComponent(token)}`),

  login: async (body: LoginInput): Promise<AuthSession> => {
    const session = await apiFetch<AuthSession>('/auth/login', {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify(body),
    });
    setToken(session.accessToken);
    return session;
  },

  logout: async (): Promise<void> => {
    try {
      await apiFetch('/auth/logout', { method: 'POST', credentials: 'include' });
    } finally {
      clearToken();
    }
  },

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
