import { useState } from 'react';
import { getOnboardingToken, updateOnboardingProgress } from './api';
import { useOnboardingStore } from './store';
import { useUserStore } from '../../entities/user/store';
import { fetchCurrentUser } from '../auth/api';
import { BotIcon } from '../../shared/ui/Icons';

export function WelcomeModal() {
  const [loading, setLoading] = useState(false);
  const user = useUserStore((s) => s.user);
  const startOnboarding = useOnboardingStore((s) => s.startOnboarding);

  const handleStart = async () => {
    setLoading(true);
    try {
      await updateOnboardingProgress('welcome', 'in_progress');
      const { token, room } = await getOnboardingToken();
      startOnboarding(token, room);
      await fetchCurrentUser();
    } catch (e) {
      console.error('Failed to start onboarding:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    try {
      await updateOnboardingProgress('welcome', 'skipped');
      await fetchCurrentUser();
    } catch (e) {
      console.error('Failed to skip onboarding:', e);
    }
  };

  const firstName = user?.full_name ? user.full_name.split(' ')[0] : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative max-w-md w-full bg-surface-secondary border border-border-primary rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 px-8 pt-10 pb-8 text-center">
          <div className="relative w-16 h-16 mx-auto mb-5">
            <div className="absolute inset-0 rounded-full bg-white/10 animate-ping" />
            <div className="relative w-full h-full rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <BotIcon className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {firstName ? `Hey ${firstName}!` : 'Welcome!'}
          </h1>
          <p className="text-blue-200 mt-1.5 text-sm">
            Welcome to Falah
          </p>
        </div>

        {/* Body */}
        <div className="px-8 pt-6 pb-8 text-center">
          <p className="text-text-primary text-sm font-medium leading-relaxed">
            Agent is ready to help you set up.
          </p>
          <p className="text-text-muted text-xs mt-1">
            Just hit start and talk to it. It's that simple.
          </p>

          <button
            onClick={handleStart}
            disabled={loading}
            className="w-full mt-6 py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-base rounded-xl transition-all cursor-pointer shadow-lg shadow-blue-600/30 hover:shadow-blue-500/40"
          >
            {loading ? 'Connecting...' : 'Start Setup'}
          </button>
          <button
            onClick={handleSkip}
            className="w-full mt-2 py-2 text-text-muted hover:text-text-secondary text-xs transition-colors cursor-pointer"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
