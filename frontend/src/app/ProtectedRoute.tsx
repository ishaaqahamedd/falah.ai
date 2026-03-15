import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useUserStore } from '../entities/user/store';
import { fetchCurrentUser } from '../features/auth/api';

export const ProtectedRoute = () => {
  const { isAuthenticated } = useUserStore();
  const [isVerifying, setIsVerifying] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      if (localStorage.getItem('access_token')) {
        try {
          await fetchCurrentUser();
        } catch (e) {
          console.error("Token verification failed");
        }
      }
      setIsVerifying(false);
    };
    checkAuth();
  }, []);

  if (isVerifying) {
    return <div className="h-screen w-screen bg-surface flex items-center justify-center text-text-primary">Verifying session...</div>;
  }

  if (!isAuthenticated && !localStorage.getItem('access_token')) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};
