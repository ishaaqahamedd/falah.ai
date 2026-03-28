import { apiClient } from '../../shared/api/client';
import { useUserStore } from '../../entities/user/store';

export const login = async (email: string, password: string) => {
  const formData = new URLSearchParams();
  formData.append('username', email); // OAuth2PasswordRequestForm expects username
  formData.append('password', password);

  const response = await apiClient.post('/auth/login', formData, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });

  // Cookie is set by backend automatically (httpOnly)
  await fetchCurrentUser();
  return response.data;
};

export const register = async (email: string, fullName: string, password: string) => {
  const response = await apiClient.post('/auth/register', {
    email,
    full_name: fullName,
    password
  });
  return response.data;
};

export const googleAuth = async (credential: string) => {
  await apiClient.post('/auth/google', { credential });
  // Cookie is set by backend automatically (httpOnly)
  await fetchCurrentUser();
};

export const logout = async () => {
  try {
    await apiClient.post('/auth/logout');
  } finally {
    useUserStore.getState().logout();
  }
};

export const fetchCurrentUser = async () => {
  try {
    const response = await apiClient.get('/auth/me');
    useUserStore.getState().setAuth(response.data);
    return response.data;
  } catch (error) {
    useUserStore.getState().logout();
    throw error;
  }
};
