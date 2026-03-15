import React from 'react';

interface AiStatusPanelProps {
  isAiTalking: boolean;
}

export function AiStatusPanel({ isAiTalking }: AiStatusPanelProps) {
  return (
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
  );
}
