import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
  useTracks,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { useOnboardingStore } from './store';
import { updateOnboardingProgress } from './api';
import { fetchCurrentUser } from '../auth/api';
import { XIcon, MicIcon } from '../../shared/ui/Icons';

const LIVEKIT_URL = (window as any).__CONFIG__?.VITE_LIVEKIT_URL || import.meta.env.VITE_LIVEKIT_URL;

const ONBOARDING_STEPS = [
  { key: 'welcome', label: 'Welcome to Falah' },
  { key: 'explore_ui', label: 'Explore the platform' },
  { key: 'create_first_agent', label: 'Create your first agent' },
  { key: 'first_session', label: 'Start your first session' },
];

export function OnboardingBubble() {
  const { token, roomName, expanded, setExpanded, endOnboarding, currentStep } = useOnboardingStore();
  const location = useLocation();

  // Auto-disconnect when user enters a live session
  const isOnLivePage = location.pathname.startsWith('/live/');

  if (!token || !roomName || isOnLivePage) return null;

  return (
    <LiveKitRoom
      video={false}
      audio={true}
      token={token}
      serverUrl={LIVEKIT_URL}
      onDisconnected={() => endOnboarding()}
      connectOptions={{ autoSubscribe: true }}
      style={{ position: 'fixed', bottom: '6rem', right: '1.5rem', zIndex: 40 }}
    >
      <RoomAudioRenderer />
      <BubbleUI
        expanded={expanded}
        setExpanded={setExpanded}
        currentStep={currentStep}
        onEnd={endOnboarding}
      />
    </LiveKitRoom>
  );
}

function BubbleUI({
  expanded,
  setExpanded,
  currentStep,
  onEnd,
}: {
  expanded: boolean;
  setExpanded: (v: boolean) => void;
  currentStep: string;
  onEnd: () => void;
}) {
  const { localParticipant } = useLocalParticipant();
  const [muted, setMuted] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [ending, setEnding] = useState(false);

  // Track screen share state
  const screenTracks = useTracks([Track.Source.ScreenShare], { onlySubscribed: false });
  const hasScreenShare = screenTracks.length > 0;

  useEffect(() => {
    setScreenSharing(hasScreenShare);
  }, [hasScreenShare]);

  const toggleMute = () => {
    localParticipant.setMicrophoneEnabled(muted);
    setMuted(!muted);
  };

  const toggleScreenShare = async () => {
    try {
      await localParticipant.setScreenShareEnabled(!screenSharing);
    } catch (e) {
      console.error('Screen share failed:', e);
    }
  };

  const handleEnd = async () => {
    setEnding(true);
    try {
      await updateOnboardingProgress(currentStep, 'in_progress');
      await fetchCurrentUser();
    } catch (e) {
      console.error('Failed to save progress:', e);
    }
    onEnd();
  };

  const stepIndex = ONBOARDING_STEPS.findIndex((s) => s.key === currentStep);
  const stepLabel = ONBOARDING_STEPS[stepIndex]?.label || 'Setup';

  // Collapsed: just a pulsing orb
  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/30 flex items-center justify-center cursor-pointer transition-all hover:scale-110 animate-pulse"
        title="Onboarding Guide"
      >
        <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      </button>
    );
  }

  // Expanded: control card
  return (
    <div className="w-72 bg-surface-secondary border border-border-primary rounded-2xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-white text-sm font-semibold">Falah - Setup Guide</span>
        </div>
        <button
          onClick={() => setExpanded(false)}
          className="text-white/70 hover:text-white transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 13H5v-2h14v2z" />
          </svg>
        </button>
      </div>

      {/* Step info */}
      <div className="px-4 py-3 border-b border-border-primary">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-text-muted">Step {stepIndex + 1} of {ONBOARDING_STEPS.length}</span>
        </div>
        <p className="text-sm text-text-primary font-medium">{stepLabel}</p>
        {/* Progress bar */}
        <div className="mt-2 h-1.5 bg-surface-tertiary rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-500"
            style={{ width: `${((stepIndex + 1) / ONBOARDING_STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Screen share status */}
      <div className="px-4 py-2 border-b border-border-primary">
        {screenSharing ? (
          <div className="flex items-center gap-2 text-xs text-emerald-500">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Screen sharing active
          </div>
        ) : (
          <button
            onClick={toggleScreenShare}
            className="text-xs text-blue-500 hover:text-blue-400 cursor-pointer transition-colors"
          >
            Share your screen so I can guide you
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            className={`p-2 rounded-lg transition-colors cursor-pointer ${
              muted ? 'bg-red-500/20 text-red-400' : 'bg-surface-tertiary text-text-secondary hover:text-text-primary'
            }`}
            title={muted ? 'Unmute' : 'Mute'}
          >
            <MicIcon className="w-4 h-4" />
          </button>
          {screenSharing && (
            <button
              onClick={toggleScreenShare}
              className="p-2 rounded-lg bg-surface-tertiary text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
              title="Stop sharing"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </button>
          )}
        </div>
        <button
          onClick={handleEnd}
          disabled={ending}
          className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium rounded-lg transition-colors cursor-pointer"
        >
          {ending ? 'Saving...' : 'End Setup'}
        </button>
      </div>
    </div>
  );
}
