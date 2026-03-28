import { apiClient } from '../../shared/api/client';

export const getSessions = async (personaId: string | null = null, limit: number = 20) => {
  const params: Record<string, unknown> = { limit };
  if (personaId) params.persona_id = personaId;
  const response = await apiClient.get('/sessions/', { params });
  return response.data;
};

export const getSession = async (sessionId: string) => {
  const response = await apiClient.get(`/sessions/${sessionId}`);
  return response.data;
};

export const createSession = async (personaId: string, personaSnapshot: Record<string, unknown>) => {
  const response = await apiClient.post('/sessions/', {
    persona_id: personaId,
    persona_snapshot: personaSnapshot,
  });
  return response.data;
};

export const triggerScoring = async (sessionId: string) => {
  const response = await apiClient.post(`/sessions/${sessionId}/score`);
  return response.data;
};
