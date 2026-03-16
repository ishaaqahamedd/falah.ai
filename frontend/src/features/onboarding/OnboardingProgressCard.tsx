import { useState } from 'react';
import { useUserStore } from '../../entities/user/store';
import { useOnboardingStore } from './store';
import { getOnboardingToken, updateOnboardingProgress } from './api';
import { fetchCurrentUser } from '../auth/api';

const ONBOARDING_STEPS = [
  { key: 'welcome', label: 'Welcome to Falah' },
  { key: 'explore_ui', label: 'Explore the platform' },
  { key: 'create_first_agent', label: 'Create your first agent' },
  { key: 'first_session', label: 'Start your first session' },
];

export function OnboardingProgressCard() {
  const user = useUserStore((s) => s.user);
  const { isActive, startOnboarding } = useOnboardingStore();
  const [resuming, setResuming] = useState(false);

  // Only show when onboarding is in-progress but bubble is not active
  if (!user || user.onboarding_status !== 'in_progress' || isActive) return null;

  const stepIndex = ONBOARDING_STEPS.findIndex((s) => s.key === user.onboarding_step);
  const currentStep = ONBOARDING_STEPS[stepIndex >= 0 ? stepIndex : 0];
  const progress = ((stepIndex >= 0 ? stepIndex + 1 : 1) / ONBOARDING_STEPS.length) * 100;

  const handleResume = async () => {
    setResuming(true);
    try {
      const { token, room } = await getOnboardingToken();
      startOnboarding(token, room);
    } catch (e) {
      console.error('Failed to resume onboarding:', e);
    } finally {
      setResuming(false);
    }
  };

  const handleDismiss = async () => {
    try {
      await updateOnboardingProgress(user.onboarding_step || 'welcome', 'skipped');
      await fetchCurrentUser();
    } catch (e) {
      console.error('Failed to dismiss onboarding:', e);
    }
  };

  return (
    <div className="mx-4 mt-2 bg-gradient-to-r from-blue-600/10 to-indigo-600/10 border border-blue-500/20 rounded-xl px-5 py-3 flex items-center gap-4">
      {/* Progress */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold text-blue-500 uppercase tracking-wider">Setup Guide</span>
          <span className="text-xs text-text-muted">Step {stepIndex + 1}/{ONBOARDING_STEPS.length}</span>
        </div>
        <p className="text-sm text-text-primary font-medium truncate">{currentStep.label}</p>
        <div className="mt-1.5 h-1 bg-surface-tertiary rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleResume}
          disabled={resuming}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
        >
          {resuming ? 'Resuming...' : 'Resume'}
        </button>
        <button
          onClick={handleDismiss}
          className="px-3 py-2 text-text-muted hover:text-text-secondary text-xs transition-colors cursor-pointer"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
