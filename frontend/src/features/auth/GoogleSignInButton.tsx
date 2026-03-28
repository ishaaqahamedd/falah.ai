import { useEffect, useRef } from 'react';
import { googleAuth } from './api';
import { GOOGLE_CLIENT_ID } from '../../shared/lib/env';

interface GoogleSignInButtonProps {
  onSuccess: () => void;
  onError: (message: string) => void;
}

export const GoogleSignInButton = ({ onSuccess, onError }: GoogleSignInButtonProps) => {
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const clientId = GOOGLE_CLIENT_ID;
    if (!clientId || !window.google) return;

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: async (response) => {
        try {
          await googleAuth(response.credential);
          onSuccess();
        } catch (err: unknown) {
          const axiosErr = err as { response?: { data?: { detail?: string } } };
          onError(axiosErr.response?.data?.detail || 'Google sign-in failed');
        }
      },
      auto_select: false,
    });

    if (buttonRef.current) {
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        width: '100%',
      });
    }
  }, [onSuccess, onError]);

  return <div ref={buttonRef} className="w-full flex justify-center" />;
};
