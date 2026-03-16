import { apiClient } from '../../shared/api/client';

export const getOnboardingToken = async () => {
  const response = await apiClient.get('/livekit/onboarding-token');
  return response.data;
};

export const updateOnboardingProgress = async (step: string, status: string) => {
  const response = await apiClient.patch('/onboarding/progress', { step, status });
  return response.data;
};
