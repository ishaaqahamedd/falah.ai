import React from 'react';
import { VideoTrack } from '@livekit/components-react';
import type { TrackReferenceOrPlaceholder } from '@livekit/components-react';
import type { TrackReference } from '@livekit/components-core';
import type { LocalParticipant } from 'livekit-client';

interface ScreenSharePanelProps {
  localScreenShare: TrackReferenceOrPlaceholder | undefined;
  localParticipant: LocalParticipant;
}

export function ScreenSharePanel({ localScreenShare, localParticipant }: ScreenSharePanelProps) {
  return (
    <div className="flex-1 border-r border-slate-800 relative bg-slate-900 flex flex-col items-center justify-center p-4">
      {localScreenShare ? (
        <div className="w-full h-full relative group">
          <VideoTrack
            trackRef={localScreenShare as TrackReference}
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
  );
}
