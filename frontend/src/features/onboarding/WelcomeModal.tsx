import { useState } from 'react';
import { getOnboardingToken, updateOnboardingProgress } from './api';
import { useOnboardingStore } from './store';
import { useUserStore } from '../../entities/user/store';
import { fetchCurrentUser } from '../auth/api';

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
      // Refresh user so onboarding_status updates
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative max-w-lg w-full bg-surface-secondary border border-border-primary rounded-2xl shadow-2xl overflow-hidden">
        {/* Gradient header */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
            <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Welcome to Falah{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}!</h1>
          <p className="text-blue-100 mt-2 text-sm leading-relaxed">
            Your AI-powered practice platform for pitches, interviews, and client conversations.
          </p>
        </div>

        {/* Content */}
        <div className="p-8 space-y-6">
          <div className="space-y-3">
            <p className="text-text-secondary text-sm leading-relaxed">
              I'll walk you through a quick setup with a voice guide who will help you:
            </p>
            <ul className="space-y-2">
              {[
                'Explore the platform and understand key features',
                'Create your first AI agent (or pick one from the community)',
                'Start your first practice session',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-text-secondary">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleStart}
              disabled={loading}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-base rounded-xl transition-colors cursor-pointer"
            >
              {loading ? 'Starting...' : 'Start Setup'}
            </button>
            <button
              onClick={handleSkip}
              className="w-full py-2 text-text-muted hover:text-text-secondary text-sm transition-colors cursor-pointer"
            >
              Skip for now — I'll explore on my own
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
