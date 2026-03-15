import React from 'react';
import { ScoreBadge } from '../../shared/ui/Badge/Badge';

interface Session {
  id: string;
  persona_snapshot?: { name?: string };
  started_at: string;
  duration_seconds?: number;
  scorecard?: { overall_score?: number };
  ai_summary?: string;
  status?: string;
}

interface SessionListProps {
  sessions: Session[];
  onViewSession: (id: string) => void;
}

export function SessionList({ sessions, onViewSession }: SessionListProps) {
  if (sessions.length === 0) return null;

  return (
    <div className="w-full max-w-6xl space-y-4">
      <h2 className="text-2xl font-bold text-white">Past Sessions</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sessions.map(s => (
          <button
            key={s.id}
            onClick={() => onViewSession(s.id)}
            className="text-left bg-slate-800 border border-slate-700 rounded-xl p-5 hover:border-blue-500 transition-all group"
          >
            <div className="flex justify-between items-start mb-3">
              <div>
                <h4 className="font-bold text-white group-hover:text-blue-400 transition-colors">
                  {s.persona_snapshot?.name || 'Practice Session'}
                </h4>
                <p className="text-xs text-slate-500">
                  {new Date(s.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {s.duration_seconds ? ` \u00b7 ${Math.round(s.duration_seconds / 60)}m` : ''}
                </p>
              </div>
              {s.scorecard?.overall_score && (
                <ScoreBadge score={s.scorecard.overall_score} />
              )}
            </div>
            {s.ai_summary && (
              <p className="text-sm text-slate-400 line-clamp-2">{s.ai_summary}</p>
            )}
            {!s.scorecard && s.status === 'COMPLETED' && (
              <p className="text-xs text-amber-500 mt-2">Scoring pending...</p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export type { Session };
