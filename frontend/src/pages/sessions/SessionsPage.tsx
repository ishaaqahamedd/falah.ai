import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getSessions } from '../../features/sessions/api';
import { getPersonas } from '../../features/personas/api';
import { SearchInput } from '../../shared/ui/SearchInput';
import { getScoreColor } from '../../shared/lib/formatters';

export function SessionsPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [personas, setPersonas] = useState<any[]>([]);
  const [filterPersona, setFilterPersona] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'score' | 'duration'>('date');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sessionsData, personasData] = await Promise.all([
        getSessions(null, 100),
        getPersonas(),
      ]);
      setSessions(sessionsData);
      setFiltered(sessionsData);
      setPersonas(personasData);
    } catch (e) {
      console.error('Failed to load sessions:', e);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = useCallback(() => {
    let result = [...sessions];

    // Search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.ai_summary?.toLowerCase().includes(q) ||
          s.persona_snapshot?.name?.toLowerCase().includes(q)
      );
    }

    // Persona filter
    if (filterPersona) {
      result = result.filter((s) => s.persona_id === filterPersona);
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'score') {
        return (b.scorecard?.overall_score || 0) - (a.scorecard?.overall_score || 0);
      }
      if (sortBy === 'duration') {
        return (b.duration_seconds || 0) - (a.duration_seconds || 0);
      }
      return new Date(b.started_at).getTime() - new Date(a.started_at).getTime();
    });

    setFiltered(result);
  }, [sessions, search, filterPersona, sortBy]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  // Auto-poll while any session is ACTIVE or generating (COMPLETED but no scorecard)
  useEffect(() => {
    const needsPoll = sessions.some(
      (s) => s.status === 'active' || (s.status === 'completed' && !s.scorecard && !s.ai_summary)
    );
    if (!needsPoll) return;
    const interval = setInterval(() => {
      getSessions(null, 100).then((data) => {
        setSessions(data);
      }).catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [sessions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-blue-500 animate-pulse font-medium">Loading sessions...</span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-text-primary tracking-tight">Sessions</h1>
        <p className="text-text-secondary mt-1">Every session recorded, scored, and ready to review</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search summaries, agents..."
          className="w-72"
        />
        <select
          value={filterPersona}
          onChange={(e) => setFilterPersona(e.target.value)}
          className="bg-surface border border-border-primary rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Agents</option>
          {personas.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="bg-surface border border-border-primary rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="date">Sort by Date</option>
          <option value="score">Sort by Score</option>
          <option value="duration">Sort by Duration</option>
        </select>
        <span className="text-xs text-text-muted">{filtered.length} session{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Sessions List */}
      {filtered.length === 0 ? (
        <div className="bg-surface-secondary border border-border-primary rounded-xl p-12 text-center">
          <p className="text-text-secondary">No sessions found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => {
            const score = s.scorecard?.overall_score;
            const scoreColor = score ? getScoreColor(score) : null;
            const isActive = s.status === 'active';
            const isGenerating = s.status === 'completed' && !s.scorecard && !s.ai_summary;

            return (
              <Link
                key={s.id}
                to={`/sessions/${s.id}`}
                className={`flex items-center justify-between bg-surface-secondary border rounded-xl p-5 transition-all group ${
                  isActive ? 'border-emerald-500/40' : isGenerating ? 'border-blue-500/30' : 'border-border-primary hover:border-blue-500'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-bold text-text-primary group-hover:text-blue-500 transition-colors truncate">
                      {s.persona_snapshot?.name || 'Practice Session'}
                    </h3>
                    {isActive && (
                      <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        In Progress
                      </span>
                    )}
                    {isGenerating && (
                      <span className="flex items-center gap-1.5 text-xs text-blue-400 font-medium">
                        <span className="w-3 h-3 rounded-full border-2 border-blue-400 border-t-transparent animate-spin"></span>
                        Generating report...
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-text-muted">
                    <span>
                      {new Date(s.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    {s.duration_seconds && (
                      <span>{Math.round(s.duration_seconds / 60)}m</span>
                    )}
                  </div>
                  {isGenerating && !s.ai_summary && (
                    <div className="mt-2 space-y-1.5 animate-pulse">
                      <div className="h-3 bg-surface-tertiary rounded w-3/4"></div>
                      <div className="h-3 bg-surface-tertiary rounded w-1/2"></div>
                    </div>
                  )}
                  {s.ai_summary && (
                    <p className="text-sm text-text-secondary mt-2 line-clamp-1">{s.ai_summary}</p>
                  )}
                </div>
                {score && scoreColor ? (
                  <span className={`text-2xl font-black ${scoreColor.text} ml-4`}>
                    {score.toFixed(1)}
                  </span>
                ) : isGenerating ? (
                  <div className="w-12 h-8 bg-surface-tertiary rounded-lg animate-pulse ml-4"></div>
                ) : null}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
