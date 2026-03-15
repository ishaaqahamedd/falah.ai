import React, { useState } from 'react';
import { formatTimestamp } from '../../shared/lib/formatters';

interface TranscriptTurn {
  role: string;
  text: string;
  timestamp?: number;
}

interface TranscriptViewerProps {
  transcript: TranscriptTurn[];
}

export function TranscriptViewer({ transcript }: TranscriptViewerProps) {
  const [showTranscript, setShowTranscript] = useState(false);

  if (!transcript || transcript.length === 0) return null;

  return (
    <div className="space-y-3">
      <button
        onClick={() => setShowTranscript(!showTranscript)}
        className="flex items-center space-x-2 text-slate-300 hover:text-white transition"
      >
        <svg className={`w-4 h-4 transition-transform ${showTranscript ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <h3 className="text-lg font-semibold">Transcript ({transcript.length} turns)</h3>
      </button>

      {showTranscript && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-h-[500px] overflow-y-auto space-y-4">
          {transcript.map((turn, i) => (
            <div key={i} className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${turn.role === 'user'
                  ? 'bg-blue-600/20 border border-blue-500/30 text-blue-100'
                  : 'bg-slate-700/50 border border-slate-600/30 text-slate-200'
                }`}>
                <div className="flex items-center space-x-2 mb-1">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${turn.role === 'user' ? 'text-blue-400' : 'text-slate-400'}`}>
                    {turn.role === 'user' ? 'You' : 'AI'}
                  </span>
                  {turn.timestamp !== undefined && (
                    <span className="text-[10px] text-slate-500">{formatTimestamp(turn.timestamp)}</span>
                  )}
                </div>
                <p className="text-sm leading-relaxed">{turn.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export type { TranscriptTurn };
