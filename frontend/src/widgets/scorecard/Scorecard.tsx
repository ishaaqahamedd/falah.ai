import React from 'react';
import { getScoreColor } from '../../shared/lib/formatters';
import { SCORE_DIMENSIONS } from '../../entities/sessions/constants';
import type { Scorecard as ScorecardType, ScorecardDimension } from '../../types';

interface ScorecardProps {
  scorecard: ScorecardType | null;
  onTriggerScoring: () => void;
  scoring: boolean;
  hasTranscript: boolean;
}

export function Scorecard({ scorecard, onTriggerScoring, scoring, hasTranscript }: ScorecardProps) {
  const hasScorecard = scorecard && scorecard.overall_score;

  if (hasScorecard) {
    return (
      <div className="space-y-6">
        {/* Overall Score */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-1">Overall Score</h3>
            <p className="text-slate-300 text-sm max-w-lg">{scorecard.overall_feedback}</p>
          </div>
          <div className={`text-6xl font-black ${getScoreColor(scorecard.overall_score).text}`}>
            {scorecard.overall_score.toFixed(1)}
          </div>
        </div>

        {/* Dimension Bars */}
        <div className="grid grid-cols-1 gap-4">
          {SCORE_DIMENSIONS.map(dim => {
            const raw = scorecard[dim.key];
            if (!raw || typeof raw !== 'object') return null;
            const dimData = raw as ScorecardDimension;
            const color = getScoreColor(dimData.score);
            return (
              <div key={dim.key} className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <span className="font-bold text-white">{dim.label}</span>
                    <span className="text-xs text-slate-500 ml-2">{dim.desc}</span>
                  </div>
                  <span className={`text-2xl font-black ${color.text}`}>{dimData.score}</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2.5 mb-3">
                  <div className={`h-2.5 rounded-full ${color.bar} transition-all duration-500`} style={{ width: `${dimData.score * 10}%` }}></div>
                </div>
                <p className="text-sm text-slate-400">{dimData.feedback}</p>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center space-y-4">
      <p className="text-slate-300">Scorecard not yet generated for this session.</p>
      {hasTranscript && (
        <button
          onClick={onTriggerScoring}
          disabled={scoring}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg font-bold transition"
        >
          {scoring ? 'Scoring...' : 'Generate Scorecard'}
        </button>
      )}
    </div>
  );
}
