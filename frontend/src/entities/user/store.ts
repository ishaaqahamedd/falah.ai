import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  full_name: string;
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
        localStorage.removeItem('access_token');
        set({ user: null, isAuthenticated: false });
      },
    }),
    {
      name: 'auth-storage', // saves to local storage
      partialize: (state) => ({ isAuthenticated: state.isAuthenticated }),
    }
  )
);
