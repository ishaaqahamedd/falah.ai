import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
  useParticipants,
  useTracks,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { useOnboardingStore } from './store';
import { updateOnboardingProgress } from './api';
import { fetchCurrentUser } from '../auth/api';
import { BotIcon, MicIcon } from '../../shared/ui/Icons';

const LIVEKIT_URL = (window as any).__CONFIG__?.VITE_LIVEKIT_URL || import.meta.env.VITE_LIVEKIT_URL;

const ONBOARDING_STEPS = [
  { key: 'welcome', label: 'Welcome to Falah' },
  { key: 'explore_ui', label: 'Explore the platform' },
  { key: 'create_first_agent', label: 'Create your first agent' },
  { key: 'first_session', label: 'Start your first session' },
];

const SETUP_STEPS = [
  { label: 'Connecting to your guide...', delay: 0 },
  { label: 'Setting up audio...', delay: 1500 },
  { label: 'Almost ready...', delay: 3000 },
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
      <BubbleUI
        expanded={expanded}
        setExpanded={setExpanded}
        currentStep={currentStep}
        onEnd={endOnboarding}
      />
    </LiveKitRoom>
  );
}

// ---------------------------------------------------------------------------
// Setup Loader — progressive steps before agent is ready
// ---------------------------------------------------------------------------

function SetupLoader({ visible }: { visible: boolean }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const timers = SETUP_STEPS.map((step, i) =>
      setTimeout(() => setCurrentStep(i), step.delay)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (!visible) {
      setFadeOut(true);
    }
  }, [visible]);

  return (
    <div
      className={`fixed inset-0 z-50 bg-surface flex flex-col items-center justify-center transition-opacity duration-500 ${fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
    >
      {/* Pulsing orb with BotIcon */}
      <div className="relative mb-10">
        <div className="w-24 h-24 rounded-full bg-blue-600/20 flex items-center justify-center">
          <div className="w-14 h-14 rounded-full bg-blue-500 animate-pulse shadow-[0_0_40px_rgba(59,130,246,0.6)] flex items-center justify-center">
            <BotIcon className="w-7 h-7 text-white" />
          </div>
        </div>
        <div className="absolute inset-0 w-24 h-24 rounded-full border-2 border-blue-500/30 animate-ping" />
      </div>

      {/* Steps */}
      <div className="space-y-3 w-72">
        {SETUP_STEPS.map((step, i) => (
          <div
            key={step.label}
            className={`flex items-center gap-3 transition-all duration-500 ${i <= currentStep ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'
              }`}
          >
            {i < currentStep ? (
              <svg className="w-5 h-5 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : i === currentStep ? (
              <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
              </div>
            ) : (
              <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-surface-tertiary" />
              </div>
            )}
            <span className={`text-sm font-medium ${i < currentStep ? 'text-emerald-400' : i === currentStep ? 'text-text-primary' : 'text-text-muted'
              }`}>
              {step.label}
            </span>
          </div>
        ))}
      </div>

      <p className="text-text-muted text-xs mt-8 animate-pulse">Setting up your onboarding guide...</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BubbleUI — collapsed bubble + expanded card
// ---------------------------------------------------------------------------

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
  const participants = useParticipants();
  const remoteParticipants = participants.filter(p => !p.isLocal);
  const [muted, setMuted] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [ending, setEnding] = useState(false);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);
  const [loaderDismissed, setLoaderDismissed] = useState(false);
  const screenShareTriggered = useRef(false);

  // Minimum 2s display to prevent loader flash
  useEffect(() => {
    const timer = setTimeout(() => setMinTimeElapsed(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  // Complete when agent joins AND min time passed
  useEffect(() => {
    if (remoteParticipants.length > 0 && minTimeElapsed) {
      setSetupComplete(true);
    }
  }, [remoteParticipants.length, minTimeElapsed]);

  // Allow 500ms fade-out, then dismiss loader
  useEffect(() => {
    if (setupComplete && !loaderDismissed) {
      setExpanded(true);
      const timer = setTimeout(() => setLoaderDismissed(true), 500);
      return () => clearTimeout(timer);
    }
  }, [setupComplete, loaderDismissed, setExpanded]);

  const showLoader = !loaderDismissed;

  // Track screen share state
  const screenTracks = useTracks([Track.Source.ScreenShare], { onlySubscribed: false });
  const hasScreenShare = screenTracks.length > 0;

  useEffect(() => {
    setScreenSharing(hasScreenShare);
  }, [hasScreenShare]);

  // Safety fallback: auto-end after 5.5 minutes if backend doesn't disconnect
  useEffect(() => {
    if (!setupComplete) return;
    const timer = setTimeout(() => {
      handleEnd();
    }, 330_000); // 5m30s
    return () => clearTimeout(timer);
  }, [setupComplete]);

  // Auto-trigger screen share 10 seconds after loader completes
  useEffect(() => {
    if (showLoader || screenShareTriggered.current || screenSharing) return;

    const timer = setTimeout(async () => {
      if (!screenShareTriggered.current) {
        screenShareTriggered.current = true;
        try {
          await localParticipant.setScreenShareEnabled(true);
        } catch (e) {
          // User denied — agent works audio-only
          console.log('Screen share denied or failed:', e);
        }
      }
    }, 10000);

    return () => clearTimeout(timer);
  }, [showLoader, localParticipant, screenSharing]);

  const toggleMute = () => {
    localParticipant.setMicrophoneEnabled(muted);
    setMuted(!muted);
  };

  const toggleScreenShare = async () => {
    screenShareTriggered.current = true; // Prevent auto-trigger after manual action
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

  // Show loader until agent connects
  if (showLoader) {
    return (
      <>
        {setupComplete && <RoomAudioRenderer />}
        <SetupLoader visible={!setupComplete} />
      </>
    );
  }

  const stepIndex = ONBOARDING_STEPS.findIndex((s) => s.key === currentStep);
  const stepLabel = ONBOARDING_STEPS[stepIndex]?.label || 'Setup';

  // Collapsed: BotIcon with radar pulse animation
  if (!expanded) {
    return (
      <>
        <RoomAudioRenderer />
        <button
          onClick={() => setExpanded(true)}
          className="relative w-14 h-14 cursor-pointer group"
          title="Onboarding Guide"
        >
          {/* Outer radar ping */}
          <span className="absolute inset-0 rounded-full bg-blue-500/30 animate-ping" />
          {/* Middle glow ring */}
          <span className="absolute inset-0.5 rounded-full bg-blue-500/20 animate-pulse" />
          {/* Inner button */}
          <span className="relative w-full h-full rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/40 flex items-center justify-center transition-all group-hover:scale-110">
            <BotIcon className="w-6 h-6 text-white" />
          </span>
        </button>
      </>
    );
  }

  // Expanded: control card
  return (
    <>
    <RoomAudioRenderer />
    <div className="w-72 bg-surface-secondary border border-border-primary rounded-2xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BotIcon className="w-4 h-4 text-white" />
          <span className="text-white text-sm font-semibold">Falah - Setup Guide</span>
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
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
            className={`p-2 rounded-lg transition-colors cursor-pointer ${muted ? 'bg-red-500/20 text-red-400' : 'bg-surface-tertiary text-text-secondary hover:text-text-primary'
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
    </>
  );
}
