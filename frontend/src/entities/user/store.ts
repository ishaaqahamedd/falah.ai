import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  onboarding_status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  onboarding_step: string | null;
}

interface UserState {
  user: User | null;
  isAuthenticated: boolean;
  setAuth: (user: User | null) => void;
  logout: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      setAuth: (user) => set({ user, isAuthenticated: !!user }),
      logout: () => {
        // Cookie is cleared by backend /auth/logout endpoint
        set({ user: null, isAuthenticated: false });
      },
    }),
    {
      name: 'auth-storage', // saves to local storage
      partialize: (state) => ({ isAuthenticated: state.isAuthenticated }),
    }
  )
);
