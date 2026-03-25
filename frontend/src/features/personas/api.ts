import { apiClient } from '../../shared/api/client';

export const getPersonas = async () => {
  const response = await apiClient.get('/personas/');
  return response.data;
};

export const createPersona = async (personaData: Record<string, unknown>) => {
  const response = await apiClient.post('/personas/', personaData);
  return response.data;
};

export const deletePersona = async (personaId: string) => {
  const response = await apiClient.delete(`/personas/${personaId}`);
  return response.data;
};

export const getPersona = async (personaId: string) => {
  const response = await apiClient.get(`/personas/${personaId}`);
  return response.data;
};

export const updatePersona = async (personaId: string, data: Record<string, unknown>) => {
  const response = await apiClient.put(`/personas/${personaId}`, data);
  return response.data;
};

export const getPersonaTemplates = async () => {
  const response = await apiClient.get('/personas/templates');
  return response.data;
};

export const getCommunityPersonas = async (params?: { search?: string; type?: string }) => {
  const response = await apiClient.get('/personas/community', { params });
  return response.data;
};
