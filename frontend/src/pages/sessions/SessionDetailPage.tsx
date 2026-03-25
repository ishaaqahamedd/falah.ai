import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSession, getSessions, triggerScoring } from '../../features/sessions/api';
import { SCORE_DIMENSIONS } from '../../entities/sessions/constants';
import { getScoreColor, formatTimestamp } from '../../shared/lib/formatters';
import { ChevronLeftIcon } from '../../shared/ui/Icons';

export function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  useEffect(() => {
    loadSession();
  }, [id]);

  const loadSession = async () => {
    setLoading(true);
    try {
      if (id) {
        const data = await getSession(id);
        setSession(data);
      } else {
        const sessions = await getSessions(null, 1);
        if (sessions.length > 0) {
          const data = await getSession(sessions[0].id);
          setSession(data);
        }
      }
    } catch (e) {
      console.error('Failed to load session:', e);
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
      console.error('Scoring failed:', e);
    } finally {
      setScoring(false);
    }
  };

  const isActive = session?.status === 'active';
  const isGenerating = session?.status === 'completed' && !session?.scorecard && !session?.ai_summary;

  // Auto-poll while session is active or generating report
  useEffect(() => {
    if (!isActive && !isGenerating) return;
    const interval = setInterval(async () => {
      try {
        if (id) {
          const data = await getSession(id);
          setSession(data);
        }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [id, isActive, isGenerating]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-blue-500 animate-pulse font-medium">Loading session analytics...</span>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <h2 className="text-2xl font-bold text-text-primary">No Session Data</h2>
        <p className="text-text-secondary">The session may still be processing.</p>
        <div className="flex gap-3">
          <button onClick={loadSession} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition">Retry</button>
          <button onClick={() => navigate('/sessions')} className="px-6 py-2 bg-surface-tertiary hover:bg-border-primary text-text-primary rounded-lg font-medium transition">Back</button>
        </div>
      </div>
    );
  }

  const sc = session.scorecard;
  const hasScorecard = sc && sc.overall_score;
  const dimensions = session.persona_snapshot?.scoring_criteria || SCORE_DIMENSIONS;

  return (
    <div className="max-w-5xl mx-auto p-8 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <button
            onClick={() => navigate('/sessions')}
            className="inline-flex items-center gap-1 text-text-secondary hover:text-text-primary transition-colors mb-3"
          >
            <ChevronLeftIcon className="w-4 h-4" />
            <span className="text-sm font-medium">Back to Sessions</span>
          </button>
          <h2 className="text-3xl font-extrabold text-text-primary">Session Analytics</h2>
          <p className="text-text-secondary mt-1">
            {session.persona_snapshot?.name || 'Practice Session'}
            {' \u00b7 '}
            {new Date(session.started_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            {session.duration_seconds ? ` \u00b7 ${Math.round(session.duration_seconds / 60)} min` : ''}
          </p>
        </div>
      </div>

      {/* Session In Progress */}
      {isActive && (
        <div className="bg-surface-secondary border border-emerald-500/30 rounded-xl p-8 text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="text-emerald-400 font-bold text-lg">Session In Progress</span>
          </div>
          <p className="text-text-secondary text-sm">The report will be generated once the session ends.</p>
        </div>
      )}

      {/* AI Summary */}
      {session.ai_summary ? (
        <div className="bg-surface-secondary border border-border-primary rounded-xl p-6">
          <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">AI Session Summary</h3>
          <p className="text-text-secondary leading-relaxed">{session.ai_summary}</p>
        </div>
      ) : isGenerating ? (
        <div className="bg-surface-secondary border border-border-primary rounded-xl p-6 animate-pulse">
          <div className="flex items-center gap-3 mb-3">
            <span className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></span>
            <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider">Generating Summary...</h3>
          </div>
          <div className="space-y-2">
            <div className="h-3 bg-surface-tertiary rounded w-full"></div>
            <div className="h-3 bg-surface-tertiary rounded w-4/5"></div>
          </div>
        </div>
      ) : null}

      {/* Scorecard */}
      {hasScorecard ? (
        <div className="space-y-6">
          <div className="bg-surface-secondary border border-border-primary rounded-xl p-8 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">Overall Score</h3>
              <p className="text-text-secondary text-sm max-w-lg">{sc.overall_feedback}</p>
            </div>
            <div className={`text-6xl font-black ${getScoreColor(sc.overall_score).text}`}>
              {sc.overall_score.toFixed(1)}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {dimensions.map((dim: any) => {
              const dimData = sc[dim.key];
              if (!dimData) return null;
              const color = getScoreColor(dimData.score);
              return (
                <div key={dim.key} className="bg-surface-secondary border border-border-primary rounded-xl p-5">
                  <div className="flex justify-between items-center mb-2">
                    <div>
                      <span className="font-bold text-text-primary">{dim.label}</span>
                      <span className="text-xs text-text-muted ml-2">{dim.desc}</span>
                    </div>
                    <span className={`text-2xl font-black ${color.text}`}>{dimData.score}</span>
                  </div>
                  <div className="w-full bg-surface-tertiary rounded-full h-2.5 mb-3">
                    <div className={`h-2.5 rounded-full ${color.bar} transition-all duration-500`} style={{ width: `${dimData.score * 10}%` }} />
                  </div>
                  <p className="text-sm text-text-secondary">{dimData.feedback}</p>
                </div>
              );
            })}
          </div>
        </div>
      ) : isGenerating ? (
        <div className="bg-surface-secondary border border-border-primary rounded-xl p-8 space-y-6">
          <div className="flex items-center gap-3">
            <span className="w-5 h-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></span>
            <span className="text-text-secondary font-medium">Analyzing your session performance...</span>
          </div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="space-y-2 animate-pulse">
              <div className="h-3 bg-surface-tertiary rounded w-1/3"></div>
              <div className="h-2.5 bg-surface-tertiary rounded-full w-full"></div>
            </div>
          ))}
        </div>
      ) : !isActive ? (
        <div className="bg-surface-secondary border border-border-primary rounded-xl p-8 text-center space-y-4">
          <p className="text-text-secondary">Scorecard not yet generated for this session.</p>
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
      ) : null}

      {/* Transcript */}
      {session.transcript && session.transcript.length > 0 && (
        <div className="space-y-3">
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition"
          >
            <svg className={`w-4 h-4 transition-transform ${showTranscript ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <h3 className="text-lg font-semibold">Transcript ({session.transcript.length} turns)</h3>
          </button>

          {showTranscript && (
            <div className="bg-surface-secondary border border-border-primary rounded-xl p-6 max-h-[500px] overflow-y-auto space-y-4">
              {session.transcript.map((turn: any, i: number) => (
                <div key={i} className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                    turn.role === 'user'
                      ? 'bg-blue-600/20 border border-blue-500/30 text-blue-300'
                      : 'bg-surface-tertiary border border-border-primary text-text-secondary'
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${turn.role === 'user' ? 'text-blue-400' : 'text-text-muted'}`}>
                        {turn.role === 'user' ? 'You' : 'AI'}
                      </span>
                      {turn.timestamp !== undefined && (
                        <span className="text-[10px] text-text-muted">{formatTimestamp(turn.timestamp)}</span>
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
  );
}
