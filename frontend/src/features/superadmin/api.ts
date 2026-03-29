import { apiClient } from '../../shared/api/client';
import type { UsersListResponse, AIModelsResponse, ModelSettings } from './types';

export async function fetchAdminUsers(params: {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
}): Promise<UsersListResponse> {
  const { data } = await apiClient.get('/superadmin/users', { params });
  return data;
}

export async function fetchAIModels(): Promise<AIModelsResponse> {
  const { data } = await apiClient.get('/superadmin/ai/models');
  return data;
}

export async function updateAIModel(
  model_id: string,
  settings?: ModelSettings,
): Promise<AIModelsResponse> {
  const { data } = await apiClient.put('/superadmin/ai/models', { model_id, settings });
  return data;
}
