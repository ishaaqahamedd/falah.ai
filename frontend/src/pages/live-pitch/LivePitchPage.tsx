import { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
  useParticipants,
  useTracks,
  VideoTrack
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { getLiveKitToken } from '../../features/livekit/api';
import { createSession } from '../../features/sessions/api';
import { LIVEKIT_URL } from '../../shared/lib/env';

interface Persona {
  id: string;
  name?: string;
  role?: string;
  [key: string]: unknown;
}

// ─── Root Page ────────────────────────────────────────────────────────────────

export function LivePitchPage() {
  const { roomName } = useParams<{ roomName: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const persona: Persona | undefined = location.state?.persona;
  const context = location.state?.context || '';
  const selectedMicId = location.state?.selectedMicId || '';
  const selectedSpeakerId = location.state?.selectedSpeakerId || '';

  const [token, setToken] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    const fetchToken = async () => {
      try {
        const personaId = persona?.id || 'unknown';
        const room = roomName || `session-${personaId}-${Date.now()}`;
        const sessionData = await createSession(personaId, persona);
        setSessionId(sessionData.id);
        const response = await getLiveKitToken(room, personaId, context, sessionData.id);
        setToken(response.token);
      } catch (e) {
        setError('Failed to connect. Are you authenticated?');
        console.error(e);
      }
    };
    fetchToken();
  }, [persona, context, roomName]);

  const handleEnd = () => navigate(sessionId ? `/sessions/${sessionId}` : '/sessions');

  if (error) {
    return (
      <div className="flex-grow flex items-center justify-center text-red-500 font-medium">
        {error}
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex-grow flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
            <div className="w-6 h-6 rounded-full bg-blue-500 animate-pulse" />
          </div>
          <span className="text-text-secondary text-sm animate-pulse">Connecting...</span>
        </div>
      </div>
    );
  }

  return (
    <LiveKitRoom
      video={false}
      audio={true}
      token={token}
      serverUrl={LIVEKIT_URL}
      data-lk-theme="default"
      className="flex-grow flex flex-col relative"
      onDisconnected={handleEnd}
      options={{
        adaptiveStream: false,
        audioCaptureDefaults: selectedMicId ? { deviceId: selectedMicId } : undefined,
        audioOutputDefaults: selectedSpeakerId ? { deviceId: selectedSpeakerId } : undefined,
      }}
    >
      <LivePitchContent onEnd={handleEnd} persona={persona} />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

// ─── Setup Overlay ────────────────────────────────────────────────────────────

const SETUP_STEPS = [
  { label: 'Connecting to room...', delay: 0 },
  { label: 'Setting up your agent...', delay: 1500 },
  { label: 'Preparing audio channels...', delay: 3000 },
  { label: 'Almost ready...', delay: 5000 },
];

function SetupOverlay({ visible }: { visible: boolean }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const timers = SETUP_STEPS.map((step, i) =>
      setTimeout(() => setCurrentStep(i), step.delay)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (!visible) setFadeOut(true);
  }, [visible]);

  return (
    <div
      className={`absolute inset-0 z-50 bg-surface flex flex-col items-center justify-center transition-opacity duration-700 ${
        fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="relative mb-10">
        <div className="w-24 h-24 rounded-full bg-blue-600/20 flex items-center justify-center">
          <div className="w-14 h-14 rounded-full bg-blue-500 animate-pulse shadow-[0_0_40px_rgba(59,130,246,0.6)]" />
        </div>
        <div className="absolute inset-0 w-24 h-24 rounded-full border-2 border-blue-500/30 animate-ping" />
      </div>
      <div className="space-y-3 w-72">
        {SETUP_STEPS.map((step, i) => (
          <div
            key={step.label}
            className={`flex items-center gap-3 transition-all duration-500 ${
              i <= currentStep ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'
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
            <span className={`text-sm font-medium ${
              i < currentStep ? 'text-emerald-400' : i === currentStep ? 'text-text-primary' : 'text-text-muted'
            }`}>
              {step.label}
            </span>
          </div>
        ))}
      </div>
      <p className="text-text-muted text-xs mt-8 animate-pulse">This usually takes a few seconds</p>
    </div>
  );
}

// ─── Wave Bars ────────────────────────────────────────────────────────────────

function WaveBars({ color }: { color: 'blue' | 'green' }) {
  const colorClass = color === 'blue' ? 'bg-blue-400' : 'bg-emerald-400';
  const heights = [8, 14, 20, 14, 8];
  return (
    <div className="flex items-end gap-0.5 h-5">
      {heights.map((h, i) => (
        <span
          key={i}
          className={`w-1 rounded-full ${colorClass}`}
          style={{
            height: `${h}px`,
            animation: 'wavebar 0.9s ease-in-out infinite',
            animationDelay: `${i * 0.12}s`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Presence Indicator ───────────────────────────────────────────────────────

function PresenceIndicator({
  label,
  isSpeaking,
  isMuted,
  color,
}: {
  label: string;
  isSpeaking: boolean;
  isMuted?: boolean;
  color: 'blue' | 'green';
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 min-w-[72px]">
      <span className="text-[10px] uppercase tracking-widest text-text-muted font-medium">{label}</span>
      <div className="h-6 flex items-center justify-center">
        {isMuted ? (
          <MicOffIcon className="w-4 h-4 text-text-muted" />
        ) : isSpeaking ? (
          <WaveBars color={color} />
        ) : (
          <span className="w-1.5 h-1.5 rounded-full bg-text-muted/30" />
        )}
      </div>
      <span className="text-[10px] text-text-muted leading-none">
        {isMuted ? 'Muted' : isSpeaking ? 'Speaking' : 'Listening'}
      </span>
    </div>
  );
}

// ─── Keyframes injected once ──────────────────────────────────────────────────

const KEYFRAMES = `
  @keyframes wavebar {
    0%, 100% { transform: scaleY(0.35); }
    50%       { transform: scaleY(1); }
  }
  @keyframes voicering {
    0%   { transform: scale(1);    opacity: 0.6; }
    50%  { transform: scale(1.08); opacity: 0.25; }
    100% { transform: scale(1);    opacity: 0.6; }
  }
  @keyframes voicering-fast {
    0%   { transform: scale(1);    opacity: 0.7; }
    50%  { transform: scale(1.12); opacity: 0.2; }
    100% { transform: scale(1);    opacity: 0.7; }
  }
`;

// ─── Main Content ─────────────────────────────────────────────────────────────

function LivePitchContent({ onEnd, persona }: { onEnd: () => void; persona?: Persona }) {
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [setupComplete, setSetupComplete] = useState(false);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(!localParticipant.isMicrophoneEnabled);

  const remoteParticipants = participants.filter(p => !p.isLocal);

  useEffect(() => {
    const timer = setTimeout(() => setMinTimeElapsed(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (remoteParticipants.length > 0 && minTimeElapsed) setSetupComplete(true);
  }, [remoteParticipants.length, minTimeElapsed]);

  useEffect(() => {
    const interval = setInterval(() => setElapsedSeconds(prev => prev + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatElapsed = (s: number) => {
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    if (hrs > 0) return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const audioTracks = useTracks([Track.Source.Microphone]).filter(
    t => t.participant.identity !== localParticipant.identity
  );
  const isAiTalking =
    audioTracks.length > 0 &&
    !audioTracks[0].publication.isMuted &&
    audioTracks[0].participant.isSpeaking;

  const isUserSpeaking = localParticipant.isSpeaking && !isMicMuted;

  const localScreenShare = useTracks([Track.Source.ScreenShare]).find(
    t => t.participant.identity === localParticipant.identity
  );
  const isSharing = !!localScreenShare;

  const toggleMic = () => {
    const next = !isMicMuted;
    localParticipant.setMicrophoneEnabled(!next);
    setIsMicMuted(next);
  };

  const toggleScreenShare = () => {
    if (isSharing) {
      localParticipant.setScreenShareEnabled(false);
    } else {
      // Pass display media options to nudge the browser picker to "Tab" view first
      localParticipant.setScreenShareEnabled(true, {
        resolution: { width: 1920, height: 1080, framerate: 15 },
      });
    }
  };

  // Orb ring color + voice-reactive animation
  const isSomeoneActive = isAiTalking || isUserSpeaking;
  const ringColor = isAiTalking && isUserSpeaking
    ? { border: 'border-indigo-500/50', ring: 'rgba(99,102,241,0.35)', anim: 'voicering-fast' }
    : isAiTalking
    ? { border: 'border-blue-500/40', ring: 'rgba(59,130,246,0.3)', anim: 'voicering-fast' }
    : isUserSpeaking
    ? { border: 'border-emerald-500/40', ring: 'rgba(34,197,94,0.3)', anim: 'voicering' }
    : { border: 'border-border-primary/20', ring: 'transparent', anim: '' };

  const orbCore = isAiTalking
    ? 'bg-blue-500 shadow-[0_0_40px_rgba(59,130,246,0.65)]'
    : isUserSpeaking
    ? 'bg-emerald-500 shadow-[0_0_40px_rgba(34,197,94,0.55)]'
    : 'bg-surface-tertiary';

  const agentName = persona?.name || 'AI Agent';
  const agentRole = persona?.role || 'Falah.ai';

  return (
    <div className="flex flex-col h-full bg-surface relative overflow-hidden">
      {/* Global keyframes */}
      <style>{KEYFRAMES}</style>

      <SetupOverlay visible={!setupComplete} />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 px-6 py-4 flex items-center justify-between border-b border-border-primary/20 bg-surface/80 backdrop-blur-sm">
        {/* Left: Live + timer */}
        <div className="flex items-center gap-3">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
          </span>
          <span className="text-red-500 font-semibold text-xs uppercase tracking-widest">Live</span>
          <span className="text-text-muted font-mono text-xs tabular-nums">{formatElapsed(elapsedSeconds)}</span>
        </div>

        {/* Right: Agent name + role + avatar */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className="text-sm font-semibold text-text-primary leading-tight">{agentName}</span>
            <span className="text-xs text-text-muted leading-tight">{agentRole}</span>
          </div>
          <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
            isAiTalking
              ? 'border-blue-500/60 bg-blue-500/10'
              : 'border-border-primary/40 bg-surface-secondary'
          }`}>
            <BotIcon className={`w-4 h-4 ${isAiTalking ? 'text-blue-400' : 'text-text-muted'}`} />
          </div>
        </div>
      </div>

      {/* Main stage */}
      <div className="flex-1 flex overflow-hidden pt-[57px] pb-28">

        {/* Screen share area */}
        <div
          className={`overflow-hidden transition-all duration-500 ease-in-out relative ${
            isSharing ? 'flex-1 opacity-100' : 'w-0 opacity-0'
          }`}
        >
          {localScreenShare && (
            <div className="w-full h-full relative">
              <VideoTrack
                trackRef={localScreenShare}
                className="w-full h-full object-contain"
              />
              {/* Hint: shown briefly to remind user to pick a specific tab/window */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
                <ShareHint />
              </div>
            </div>
          )}
        </div>

        {/* AI Agent panel */}
        <div
          className={`flex flex-col items-center justify-center transition-all duration-500 ease-in-out ${
            isSharing
              ? 'w-80 border-l border-border-primary/30 bg-surface-secondary/30 backdrop-blur-sm'
              : 'flex-1'
          }`}
        >
          {isSharing && (
            <span className="text-[10px] uppercase tracking-widest text-text-muted font-medium mb-6">
              AI Agent
            </span>
          )}

          {/* Orb with voice-reactive outer ring */}
          <div
            className={`relative flex items-center justify-center mb-8 transition-all duration-500 ${
              isSharing ? 'w-40 h-40' : 'w-56 h-56'
            }`}
          >
            {/* Voice-reactive animated outer ring */}
            <div
              className={`absolute inset-0 rounded-full border-2 ${ringColor.border} transition-colors duration-300`}
              style={isSomeoneActive ? {
                animation: `${ringColor.anim} 1.4s ease-in-out infinite`,
                boxShadow: `0 0 0 0 ${ringColor.ring}`,
              } : undefined}
            />

            {/* Secondary inner ring — slightly delayed for depth */}
            <div
              className={`absolute rounded-full border transition-all duration-300 ${
                isSomeoneActive ? ringColor.border : 'border-border-primary/10'
              } ${isSharing ? 'inset-4' : 'inset-6'}`}
              style={isSomeoneActive ? {
                animation: `${ringColor.anim} 1.4s ease-in-out infinite`,
                animationDelay: '0.2s',
                opacity: 0.5,
              } : undefined}
            />

            {/* Core orb */}
            <div
              className={`rounded-full transition-all duration-200 ${orbCore} ${
                isSharing ? 'w-20 h-20' : 'w-24 h-24'
              }`}
            />

            {/* Mic muted badge */}
            {isMicMuted && (
              <div className="absolute bottom-1 right-1 w-7 h-7 rounded-full bg-surface-secondary border-2 border-border-primary/40 flex items-center justify-center shadow-md">
                <MicOffIcon className="w-3.5 h-3.5 text-text-muted" />
              </div>
            )}
          </div>

          {/* Dual presence indicators — single instance, always shown */}
          <div className="flex items-start gap-6">
            <PresenceIndicator
              label="You"
              isSpeaking={isUserSpeaking}
              isMuted={isMicMuted}
              color="green"
            />
            <div className="w-px h-10 bg-border-primary/30 self-center" />
            <PresenceIndicator
              label="AI Agent"
              isSpeaking={isAiTalking}
              color="blue"
            />
          </div>
        </div>
      </div>

      {/* Bottom control bar — all 3 in one pill */}
      <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-center pb-6">
        <div className="flex items-center gap-1 bg-surface-secondary/80 backdrop-blur-xl border border-border-primary/30 rounded-2xl p-1.5 shadow-2xl">

          {/* Mic */}
          <button
            onClick={toggleMic}
            className={`cursor-pointer flex flex-col items-center justify-center gap-1 w-16 h-16 rounded-xl transition-all duration-200 active:scale-95 select-none ${
              isMicMuted
                ? 'bg-red-500 text-white'
                : 'text-text-primary hover:bg-surface-tertiary'
            }`}
          >
            {isMicMuted ? <MicOffIcon className="w-5 h-5" /> : <MicIcon className="w-5 h-5" />}
            <span className="text-[10px] font-medium opacity-60 leading-none">
              {isMicMuted ? 'Unmute' : 'Mute'}
            </span>
          </button>

          <div className="w-px h-8 bg-border-primary/30 mx-0.5" />

          {/* Share Screen */}
          <button
            onClick={toggleScreenShare}
            className={`cursor-pointer flex flex-col items-center justify-center gap-1 w-16 h-16 rounded-xl transition-all duration-200 active:scale-95 select-none ${
              isSharing
                ? 'bg-blue-500 text-white'
                : 'text-text-primary hover:bg-surface-tertiary'
            }`}
          >
            {isSharing ? <MonitorOffIcon className="w-5 h-5" /> : <MonitorIcon className="w-5 h-5" />}
            <span className="text-[10px] font-medium opacity-60 leading-none">
              {isSharing ? 'Stop' : 'Share'}
            </span>
          </button>

          <div className="w-px h-8 bg-border-primary/30 mx-0.5" />

          {/* End — in same pill, separated by divider */}
          <button
            onClick={onEnd}
            className="cursor-pointer flex flex-col items-center justify-center gap-1 w-16 h-16 rounded-xl bg-red-600 text-white hover:bg-red-500 transition-all duration-200 active:scale-95 select-none"
          >
            <PhoneOffIcon className="w-5 h-5" />
            <span className="text-[10px] font-medium opacity-60 leading-none">End</span>
          </button>

        </div>
      </div>
    </div>
  );
}

// ─── Share Hint — fades out after 4s ─────────────────────────────────────────

function ShareHint() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className={`flex items-center gap-2 bg-surface-secondary/90 backdrop-blur-md border border-border-primary/40 rounded-full px-4 py-2 shadow-lg transition-opacity duration-700 ${
      visible ? 'opacity-100' : 'opacity-0'
    }`}>
      <MonitorIcon className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
      <span className="text-xs text-text-secondary whitespace-nowrap">
        Tip: share a specific <span className="text-text-primary font-medium">tab or window</span>, not your entire screen
      </span>
    </div>
  );
}

// ─── Icons (inline SVG, strokeWidth=2, fill=none) ────────────────────────────

function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 3a4 4 0 014 4v4a4 4 0 01-8 0V7a4 4 0 014-4z" />
    </svg>
  );
}

function MicOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M15 9.34V7a3 3 0 00-5.94-.6M9 9v.01M3 3l18 18" />
    </svg>
  );
}

function MonitorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function MonitorOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2zM3 3l18 18" />
    </svg>
  );
}

function PhoneOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a16.424 16.424 0 0114 14" />
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3.393 3.393A16.424 16.424 0 003 5c0 9.941 8.059 18 18 18 .617 0 1.228-.033 1.83-.097" />
    </svg>
  );
}

function BotIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 2a2 2 0 012 2v1h3a2 2 0 012 2v8a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h3V4a2 2 0 012-2z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 11h.01M15 11h.01M9 15h6" />
    </svg>
  );
}
