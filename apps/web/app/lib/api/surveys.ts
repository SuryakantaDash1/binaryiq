import { apiFetch } from './client.js';

export interface SurveyCard {
  id: string;
  title: string;
  type: 'PRIORITY' | 'QUICK' | 'PREMIUM';
  pointsValue: number;
  estimatedMins: number | null;
  isExternal: boolean;
}

export interface SurveyDetail extends SurveyCard {
  description: string | null;
  expiresAt: string | null;
}

export interface MatchedSurveys {
  priority: SurveyCard[];
  quick: SurveyCard[];
  premium: SurveyCard[];
}

export interface StartResult {
  responseId: string;
  mode: 'external' | 'internal';
  externalUrl?: string;
  returnToken: string;
}

export interface CompleteResult {
  status: 'completed' | 'disqualified';
  pointsAwarded: number;
  balanceAfter: number;
}

export const surveysApi = {
  list(): Promise<MatchedSurveys> {
    return apiFetch('/surveys');
  },
  get(id: string): Promise<SurveyDetail> {
    return apiFetch(`/surveys/${id}`);
  },
  start(id: string): Promise<StartResult> {
    return apiFetch(`/surveys/${id}/start`, { method: 'POST' });
  },
  complete(id: string, returnToken: string, status?: 'completed' | 'disqualified'): Promise<CompleteResult> {
    return apiFetch(`/surveys/${id}/complete`, {
      method: 'POST',
      body: status ? { returnToken, status } : { returnToken },
    });
  },
};
