import type { UpdateProfileInput, ChangeEmailInput, ChangePasswordInput, UpdatePaypalInput, UpdateAboutYouInput } from '@binaryiq/types';

import { apiFetch } from './client.js';

export interface ProfileData {
  firstName: string;
  surname: string;
  dob: string;
  gender: string;
  photoUrl: string | null;
  country: string;
}

export interface AboutYouData {
  address: { line1: string | null; city: string | null; pinCode: string | null; areaType: string | null };
  demographics: { educationLevel: string | null; employmentType: string | null; incomeBracket: string | null; householdSize: number | null; childrenCount: number | null; chiefWageEarner: boolean | null; assets: unknown };
}

export interface BalanceData {
  balance: number;
  lifetimeEarned: number;
}

export const accountApi = {
  getProfile(): Promise<ProfileData> {
    return apiFetch('/account/profile');
  },
  updateProfile(body: UpdateProfileInput): Promise<ProfileData> {
    return apiFetch('/account/profile', { method: 'PUT', body });
  },
  updatePhoto(url: string): Promise<{ photoUrl: string }> {
    return apiFetch('/account/profile/photo', { method: 'POST', body: { url } });
  },
  deletePhoto(): Promise<{ photoUrl: null }> {
    return apiFetch('/account/profile/photo', { method: 'DELETE' });
  },
  requestEmailChange(body: ChangeEmailInput): Promise<{ pending: boolean; email: string }> {
    return apiFetch('/account/email', { method: 'PUT', body });
  },
  confirmEmailChange(token: string): Promise<{ email: string }> {
    return apiFetch('/account/email/verify', { method: 'POST', body: { token } });
  },
  changePassword(body: ChangePasswordInput): Promise<{ ok: boolean }> {
    return apiFetch('/account/password', { method: 'PUT', body });
  },
  updatePaypal(body: UpdatePaypalInput): Promise<{ paypalEmail: string; verifiedAt: string | null }> {
    return apiFetch('/account/paypal', { method: 'PUT', body });
  },
  getAboutYou(): Promise<AboutYouData> {
    return apiFetch('/account/about-you');
  },
  updateAboutYou(body: UpdateAboutYouInput): Promise<AboutYouData> {
    return apiFetch('/account/about-you', { method: 'PUT', body });
  },
  getBalance(): Promise<BalanceData> {
    return apiFetch('/account/balance');
  },
};
