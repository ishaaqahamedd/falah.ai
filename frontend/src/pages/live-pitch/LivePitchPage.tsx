import React, { useState, useEffect } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
  useTracks,
  VideoTrack
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { getLiveKitToken } from '../../features/livekit/api';

const LIVEKIT_URL = (window as any).__CONFIG__?.VITE_LIVEKIT_URL || import.meta.env.VITE_LIVEKIT_URL;

interface LivePitchPageProps {
  persona: any;
  transcript: string;
  onEnd: () => void;
}

export function LivePitchPage({ persona, transcript, onEnd }: LivePitchPageProps) {
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const roomName = `session-${persona.id}-${Date.now()}`;
        const response = await getLiveKitToken(roomName, persona.id, transcript);
        setToken(response.token);
      } catch (e) {
        setError("Failed to fetch LiveKit token. Are you authenticated?");
        console.error(e);
      }
    };
    fetchToken();
  }, [persona, transcript]);

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
      onDisconnected={onEnd}
      options={{ adaptiveStream: false }}
    >
      <LivePitchContent onEnd={onEnd} />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

function LivePitchContent({ onEnd }: { onEnd: () => void }) {
  const { localParticipant } = useLocalParticipant();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

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
    <div className="flex flex-col h-full bg-black relative">
      {/* Status Header */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center space-x-3">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
          <span className="text-red-500 font-bold uppercase tracking-widest text-sm">Live Pitching</span>
          <span className="text-slate-400 font-mono text-sm ml-2 bg-slate-800/80 px-3 py-1 rounded-full border border-slate-700">{formatElapsed(elapsedSeconds)}</span>
        </div>
        <button onClick={onEnd} className="bg-red-600/20 text-red-500 hover:bg-red-600 hover:text-white px-6 py-2 rounded-full text-sm font-bold border border-red-600/50 transition-colors">
          End Simulation
        </button>
      </div>

      <div className="flex-grow flex flex-row overflow-hidden pt-16 relative">
        {/* Left: Screen Share */}
        <div className="flex-1 border-r border-slate-800 relative bg-slate-900 flex flex-col items-center justify-center p-4">
          {localScreenShare ? (
            <div className="w-full h-full relative group">
              <VideoTrack
                trackRef={localScreenShare}
                className="w-full h-full object-contain rounded-lg border border-slate-700 shadow-2xl"
              />
              <button
                onClick={() => localParticipant.setScreenShareEnabled(false)}
                className="absolute top-4 right-4 bg-red-600/80 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity"
              >
                Stop Sharing
              </button>
            </div>
          ) : (
            <div className="text-slate-500 flex flex-col items-center border-2 border-dashed border-slate-700 p-12 rounded-2xl w-full h-full justify-center">
              <svg className="w-16 h-16 mb-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              <span className="text-xl font-bold text-white mb-2">Share Your Pitch Deck</span>
              <span className="text-sm mt-2 opacity-80 text-center max-w-sm mb-6">The AI uses the Gemini 2.5 Flash Native Vision model. Share your screen so it can observe your slides.</span>

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
        <div className="w-96 bg-slate-900 flex flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.5)] z-10">
          <div className="flex-1 p-6 flex items-center justify-center border-b border-slate-800 relative overflow-hidden">
            <div className={`absolute inset-0 transition-opacity duration-300 ${isAiTalking ? 'bg-blue-900/10' : 'bg-transparent'}`}></div>

            <div className={`w-32 h-32 rounded-full border-4 flex items-center justify-center z-10 transition-all duration-300 ${isAiTalking ? 'border-blue-500/50 shadow-[0_0_80px_rgba(59,130,246,0.5)] scale-110' : 'border-slate-700 shadow-none scale-100'}`}>
              <div className={`w-16 h-16 rounded-full transition-all duration-100 ${isAiTalking ? 'bg-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.8)] animate-pulse' : 'bg-slate-600'}`}></div>
            </div>
            <div className="absolute bottom-6 font-bold text-sm tracking-widest uppercase" style={{ color: isAiTalking ? '#60a5fa' : '#475569' }}>
              {isAiTalking ? 'AI is Speaking' : 'Listening...'}
            </div>
          </div>
          <div className="h-64 p-6 flex flex-col w-full border-t border-slate-800 bg-black">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-4">WebRTC Connection</span>
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
