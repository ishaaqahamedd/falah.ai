import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useUserStore } from '../entities/user/store';
import { fetchCurrentUser } from '../features/auth/api';
import { WelcomeModal } from '../features/onboarding/WelcomeModal';
import { OnboardingBubble } from '../features/onboarding/OnboardingBubble';
import { useOnboardingStore } from '../features/onboarding/store';

export const ProtectedRoute = () => {
  const { isAuthenticated, user } = useUserStore();
  const isOnboardingActive = useOnboardingStore((s) => s.isActive);
  const [isVerifying, setIsVerifying] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      if (isAuthenticated) {
        try {
          await fetchCurrentUser();
        } catch (e) {
          // Cookie expired or invalid — logout handled by fetchCurrentUser
        }
      }
      setIsVerifying(false);
    };
    checkAuth();
  }, []);

  if (isVerifying) {
    return <div className="h-screen w-screen bg-surface flex items-center justify-center text-text-primary">Verifying session...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <>
      <Outlet />
      {user?.onboarding_status === 'pending' && <WelcomeModal />}
      {isOnboardingActive && <OnboardingBubble />}
    </>
  );
};
