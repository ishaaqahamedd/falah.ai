import axios from 'axios';
import { toast } from 'sonner';
import { getErrorMessage } from '../lib/api-error';

// Backend runs on port 8000 locally
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Send httpOnly cookies with every request
});

// Response interceptor to handle errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Force redirect to login if not already there
      if (!window.location.pathname.includes('/login')) {
         window.location.href = '/login';
      }
    } else if (error.response?.status >= 400) {
      toast.error(getErrorMessage(error));
    }
    return Promise.reject(error);
  }
);
