import React from 'react';

interface Briefing {
  briefing: string;
  sources: number;
  cached: boolean;
}

interface BriefingPanelProps {
  briefing: Briefing | null;
  loading: boolean;
  onGenerate: (forceRefresh: boolean) => void;
}

export function BriefingPanel({ briefing, loading, onGenerate }: BriefingPanelProps) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold text-slate-400">
          AI Pre-Call Briefing
          {briefing?.cached && <span className="ml-2 text-[10px] bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded">cached</span>}
        </h3>
        <button
          onClick={() => onGenerate(true)}
          disabled={loading}
          className="text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition font-medium"
        >
          {loading ? 'Generating...' : briefing ? 'Regenerate' : 'Generate Briefing'}
        </button>
      </div>

      <div className="bg-indigo-900/20 border border-indigo-800/30 rounded-xl p-4 min-h-[80px] max-h-[300px] overflow-y-auto">
        {briefing ? (
          <>
            <p className="text-sm text-indigo-200 leading-relaxed whitespace-pre-line">{briefing.briefing}</p>
            {briefing.sources > 0 && (
              <p className="text-xs text-indigo-400 mt-2 border-t border-indigo-800/30 pt-2">
                Based on {briefing.sources} uploaded document{briefing.sources > 1 ? 's' : ''}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-indigo-400/60 italic">Upload documents and click "Generate Briefing" to get an AI-powered pre-call summary.</p>
        )}
      </div>
    </div>
  );
}

export type { Briefing };
