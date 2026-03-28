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

export function LivePitchPage() {
  const { roomName } = useParams<{ roomName: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const persona = location.state?.persona;
  const context = location.state?.context || '';
  const selectedMicId = location.state?.selectedMicId || '';
  const selectedSpeakerId = location.state?.selectedSpeakerId || '';

  const [token, setToken] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const initRef = useRef(false);

  useEffect(() => {
    // Guard against React strict mode double-firing
    if (initRef.current) return;
    initRef.current = true;

    const fetchToken = async () => {
      try {
        const personaId = persona?.id || 'unknown';
        const room = roomName || `session-${personaId}-${Date.now()}`;

        // Create ACTIVE session in DB before entering the room
        const sessionData = await createSession(personaId, persona);
        setSessionId(sessionData.id);

        // Pass session_id so agent knows which session to update on shutdown
        const response = await getLiveKitToken(room, personaId, context, sessionData.id);
        setToken(response.token);
      } catch (e) {
        setError('Failed to connect. Are you authenticated?');
        console.error(e);
      }
    };
    fetchToken();
  }, [persona, context, roomName]);

  const handleEnd = () => {
    navigate(sessionId ? `/sessions/${sessionId}` : '/sessions');
  };

  if (error) {
    return <div className="flex-grow flex items-center justify-center text-red-500 font-medium">{error}</div>;
  }

  if (!token) {
    return <div className="flex-grow flex items-center justify-center text-blue-400 font-medium animate-pulse">Connecting to WebRTC Room...</div>;
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
      <LivePitchContent onEnd={handleEnd} />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

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
    if (!visible) {
      setFadeOut(true);
    }
  }, [visible]);

  if (fadeOut) {
    return (
      <div className="absolute inset-0 z-50 bg-surface flex flex-col items-center justify-center transition-opacity duration-500 opacity-0 pointer-events-none" />
    );
  }

  return (
    <div className="absolute inset-0 z-50 bg-surface flex flex-col items-center justify-center">
      {/* Pulsing orb */}
      <div className="relative mb-10">
        <div className="w-24 h-24 rounded-full bg-blue-600/20 flex items-center justify-center">
          <div className="w-14 h-14 rounded-full bg-blue-500 animate-pulse shadow-[0_0_40px_rgba(59,130,246,0.6)]" />
        </div>
        <div className="absolute inset-0 w-24 h-24 rounded-full border-2 border-blue-500/30 animate-ping" />
      </div>

      {/* Steps */}
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

function LivePitchContent({ onEnd }: { onEnd: () => void }) {
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [setupComplete, setSetupComplete] = useState(false);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  const remoteParticipants = participants.filter(p => !p.isLocal);

  // Minimum 2s display so loader doesn't flash
  useEffect(() => {
    const timer = setTimeout(() => setMinTimeElapsed(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  // Mark setup complete when agent joins and min time passed
  useEffect(() => {
    if (remoteParticipants.length > 0 && minTimeElapsed) {
      setSetupComplete(true);
    }
  }, [remoteParticipants.length, minTimeElapsed]);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatElapsed = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const audioTracks = useTracks([Track.Source.Microphone]).filter(t => t.participant.identity !== localParticipant.identity);
  const isAiTalking = audioTracks.length > 0 && audioTracks[0].publication.isMuted === false && audioTracks[0].participant.isSpeaking;

  const localScreenShare = useTracks([Track.Source.ScreenShare]).find(t => t.participant.identity === localParticipant.identity);

  return (
    <div className="flex flex-col h-full bg-surface relative">
      {/* Setup Overlay */}
      <SetupOverlay visible={!setupComplete} />

      {/* Status Header */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 bg-gradient-to-b from-surface/80 to-transparent">
        <div className="flex items-center space-x-3">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
          <span className="text-red-500 font-bold uppercase tracking-widest text-sm">Agent Live</span>
          <span className="text-text-secondary font-mono text-sm ml-2 bg-surface-tertiary px-3 py-1 rounded-full border border-border-primary">{formatElapsed(elapsedSeconds)}</span>
        </div>
        <button onClick={onEnd} className="bg-red-600/20 text-red-500 hover:bg-red-600 hover:text-white px-6 py-2 rounded-full text-sm font-bold border border-red-600/50 transition-colors">
          End Session
        </button>
      </div>

      <div className="flex-grow flex flex-row overflow-hidden pt-16 relative">
        {/* Left: Screen Share */}
        <div className="flex-1 border-r border-border-primary relative bg-surface-secondary flex flex-col items-center justify-center p-4">
          {localScreenShare ? (
            <div className="w-full h-full relative group">
              <VideoTrack
                trackRef={localScreenShare}
                className="w-full h-full object-contain rounded-lg border border-border-primary shadow-2xl"
              />
              <button
                onClick={() => localParticipant.setScreenShareEnabled(false)}
                className="absolute top-4 right-4 bg-red-600/80 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity"
              >
                Stop Sharing
              </button>
            </div>
          ) : (
            <div className="text-text-muted flex flex-col items-center border-2 border-dashed border-border-primary p-12 rounded-2xl w-full h-full justify-center">
              <svg className="w-16 h-16 mb-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              <span className="text-xl font-bold text-text-primary mb-2">Share Your Screen</span>
              <span className="text-sm mt-2 text-text-secondary text-center max-w-sm mb-6">Your agent uses real-time vision. Share your screen and it will see exactly what you see.</span>
              <button
                onClick={() => localParticipant.setScreenShareEnabled(true)}
                className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-bold shadow-lg transition-transform hover:scale-105"
              >
                Start Screen Share
              </button>
            </div>
          )}
        </div>

        {/* Right: AI Status */}
        <div className="w-96 bg-surface-secondary flex flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.2)] z-10">
          <div className="flex-1 p-6 flex items-center justify-center border-b border-border-primary relative overflow-hidden">
            <div className={`absolute inset-0 transition-opacity duration-300 ${isAiTalking ? 'bg-blue-900/10' : 'bg-transparent'}`}></div>
            <div className={`w-32 h-32 rounded-full border-4 flex items-center justify-center z-10 transition-all duration-300 ${isAiTalking ? 'border-blue-500/50 shadow-[0_0_80px_rgba(59,130,246,0.5)] scale-110' : 'border-border-primary shadow-none scale-100'}`}>
              <div className={`w-16 h-16 rounded-full transition-all duration-100 ${isAiTalking ? 'bg-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.8)] animate-pulse' : 'bg-surface-tertiary'}`}></div>
            </div>
            <div className={`absolute bottom-6 font-bold text-sm tracking-widest uppercase ${isAiTalking ? 'text-blue-400' : 'text-text-muted'}`}>
              {isAiTalking ? 'AI is Speaking' : 'Listening...'}
            </div>
          </div>
          <div className="h-64 p-6 flex flex-col w-full border-t border-border-primary bg-surface">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider block mb-4">WebRTC Connection</span>
            <div className="text-emerald-400 text-xs font-mono mb-2 flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>LiveKit Connected</span>
            </div>
            <div className="text-emerald-400 text-xs font-mono mb-2 flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 opacity-50"></span>
              <span className="opacity-50">Agent Subscribed</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
