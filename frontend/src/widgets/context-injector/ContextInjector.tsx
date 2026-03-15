import React from 'react';

interface ContextInjectorProps {
  transcript: string;
  onTranscriptChange: (value: string) => void;
  isCustomPersona: boolean;
}

export function ContextInjector({ transcript, onTranscriptChange, isCustomPersona }: ContextInjectorProps) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-slate-300">System Context Injection</h3>
        <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">Passed to Live API</span>
      </div>

      <div className="relative h-40">
        <textarea
          value={transcript}
          onChange={(e) => onTranscriptChange(e.target.value)}
          placeholder="Paste previous email threads, notes, or specific objections you've encountered with this client..."
          className="w-full h-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none shadow-inner"
        />
      </div>

      {/* Session Info Checklist */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-300">Session Info</h3>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-lg space-y-3">
          <div className="flex items-center space-x-2 text-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="text-slate-300">Audio + Vision enabled</span>
          </div>
          <div className="flex items-center space-x-2 text-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="text-slate-300">Context will be injected on connect</span>
          </div>
          {isCustomPersona && (
            <div className="flex items-center space-x-2 text-sm">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <span className="text-slate-300">Vector DB context search active</span>
            </div>
          )}
          <div className="flex items-center space-x-2 text-sm">
            <span className="w-2 h-2 rounded-full bg-purple-500"></span>
            <span className="text-slate-300">Adaptive questioning enabled</span>
          </div>
        </div>
      </div>
    </div>
  );
}
