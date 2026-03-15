import React, { useState, useEffect } from 'react';
import { getSession, getSessions, triggerScoring } from '../../features/sessions/api';
import { SCORE_DIMENSIONS } from '../../entities/sessions/constants';

interface AnalyticsPageProps {
  sessionId: string | null;
  onReset: () => void;
}

function getScoreColor(score: number) {
  if (score >= 7) return { bar: 'bg-emerald-500', text: 'text-emerald-400', ring: 'ring-emerald-500/30' };
  if (score >= 4) return { bar: 'bg-amber-500', text: 'text-amber-400', ring: 'ring-amber-500/30' };
  return { bar: 'bg-red-500', text: 'text-red-400', ring: 'ring-red-500/30' };
}

function formatTimestamp(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function AnalyticsPage({ sessionId, onReset }: AnalyticsPageProps) {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  useEffect(() => {
    loadSession();
  }, [sessionId]);

  const loadSession = async () => {
    setLoading(true);
    try {
      if (sessionId) {
        const data = await getSession(sessionId);
        setSession(data);
      } else {
        // No sessionId -- fetch the latest session (just finished a live pitch)
        const sessions = await getSessions(null, 1);
        if (sessions.length > 0) {
          const data = await getSession(sessions[0].id);
          setSession(data);
        }
      }
    } catch (e) {
      console.error("Failed to load session:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerScoring = async () => {
    if (!session) return;
    setScoring(true);
    try {
      const updated = await triggerScoring(session.id);
      setSession(updated);
    } catch (e) {
      console.error("Scoring failed:", e);
    } finally {
      setScoring(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-grow flex items-center justify-center">
        <div className="text-blue-400 animate-pulse text-lg font-medium">Loading session analytics...</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center space-y-4">
        <h2 className="text-2xl font-bold text-white">No Session Data</h2>
        <p className="text-slate-400">The session may still be processing. Try again in a moment.</p>
        <div className="flex space-x-4">
          <button onClick={loadSession} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition">Retry</button>
          <button onClick={onReset} className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition">Dashboard</button>
        </div>
      </div>
    );
  }

  const sc = session.scorecard;
  const hasScorecard = sc && sc.overall_score;

  // Use persona-specific scoring dimensions if available, otherwise defaults
  const dimensions = session.persona_snapshot?.scoring_criteria || SCORE_DIMENSIONS;

  return (
    <div className="flex-grow overflow-y-auto">
      <div className="max-w-5xl mx-auto p-8 space-y-8">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-3xl font-extrabold text-white">Session Analytics</h2>
            <p className="text-slate-400 mt-1">
              {session.persona_snapshot?.name || 'Practice Session'}
              {' \u00b7 '}
              {new Date(session.started_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              {session.duration_seconds ? ` \u00b7 ${Math.round(session.duration_seconds / 60)} min` : ''}
            </p>
          </div>
          <button onClick={onReset} className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition">
            Dashboard
          </button>
        </div>

        {/* AI Summary */}
        {session.ai_summary && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">AI Session Summary</h3>
            <p className="text-slate-200 leading-relaxed">{session.ai_summary}</p>
          </div>
        )}

        {/* Scorecard */}
        {hasScorecard ? (
          <div className="space-y-6">
            {/* Overall Score */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-1">Overall Score</h3>
                <p className="text-slate-300 text-sm max-w-lg">{sc.overall_feedback}</p>
              </div>
              <div className={`text-6xl font-black ${getScoreColor(sc.overall_score).text}`}>
                {sc.overall_score.toFixed(1)}
              </div>
            </div>

            {/* Dimension Bars */}
            <div className="grid grid-cols-1 gap-4">
              {dimensions.map((dim: any) => {
                const dimData = sc[dim.key];
                if (!dimData) return null;
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
        ) : (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center space-y-4">
            <p className="text-slate-300">Scorecard not yet generated for this session.</p>
            {session.transcript && session.transcript.length >= 2 && (
              <button
                onClick={handleTriggerScoring}
                disabled={scoring}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg font-bold transition"
              >
                {scoring ? 'Scoring...' : 'Generate Scorecard'}
              </button>
            )}
          </div>
        )}

        {/* Transcript */}
        {session.transcript && session.transcript.length > 0 && (
          <div className="space-y-3">
            <button
              onClick={() => setShowTranscript(!showTranscript)}
              className="flex items-center space-x-2 text-slate-300 hover:text-white transition"
            >
              <svg className={`w-4 h-4 transition-transform ${showTranscript ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <h3 className="text-lg font-semibold">Transcript ({session.transcript.length} turns)</h3>
            </button>

            {showTranscript && (
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-h-[500px] overflow-y-auto space-y-4">
                {session.transcript.map((turn: any, i: number) => (
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
        )}
      </div>
    </div>
  );
}
