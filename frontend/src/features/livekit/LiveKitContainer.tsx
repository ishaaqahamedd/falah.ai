import React, { useState, useEffect, ReactNode } from 'react';
import { LiveKitRoom, RoomAudioRenderer } from '@livekit/components-react';
import { getLiveKitToken } from './api';

const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL as string;

interface LiveKitContainerProps {
  persona: { id: string; [key: string]: any };
  transcript: string;
  onEnd: () => void;
  children: ReactNode;
}

export function LiveKitContainer({ persona, transcript, onEnd, children }: LiveKitContainerProps) {
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
      {children}
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}
