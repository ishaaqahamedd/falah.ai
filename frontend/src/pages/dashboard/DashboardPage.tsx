import React, { useState, useEffect } from 'react';
import { getPersonas, createPersona } from '../../features/personas/api';
import { getSessions } from '../../features/sessions/api';
import { PersonaForm } from '../../features/personas/PersonaForm';
import { PERSONA_OPTIONS } from '../../entities/personas/constants';

interface DashboardPageProps {
  onSelect: (persona: any) => void;
  onViewSession: (id: string) => void;
}

function getScoreColor(score: number) {
  if (score >= 7) return { bar: 'bg-emerald-500', text: 'text-emerald-400', ring: 'ring-emerald-500/30' };
  if (score >= 4) return { bar: 'bg-amber-500', text: 'text-amber-400', ring: 'ring-amber-500/30' };
  return { bar: 'bg-red-500', text: 'text-red-400', ring: 'ring-red-500/30' };
}

function ScoreBadge({ score }: { score: number }) {
  const color = getScoreColor(score);
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-bold ${color.text} bg-slate-900 ring-2 ${color.ring}`}>
      {typeof score === 'number' ? score.toFixed(1) : score}
    </span>
  );
}

export function DashboardPage({ onSelect, onViewSession }: DashboardPageProps) {
  const [customPersonas, setCustomPersonas] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isFormLoading, setIsFormLoading] = useState(false);
  const [pastSessions, setPastSessions] = useState<any[]>([]);

  useEffect(() => {
    fetchPersonas();
    fetchSessions();
  }, []);

  const fetchPersonas = async () => {
    try {
      const data = await getPersonas();
      const mapped = data.map((p: any) => ({
        id: p.id,
        name: p.name,
        role: p.role,
        isCustom: true,
        history: `Custom Persona (${p.type}): Focuses on ${p.focus_areas.substring(0, 50)}...`,
        config: p
      }));
      setCustomPersonas(mapped);
    } catch (e) {
      console.error("Failed to fetch personas:", e);
    }
  };

  const fetchSessions = async () => {
    try {
      const data = await getSessions(null, 10);
      setPastSessions(data);
    } catch (e) {
      console.error("Failed to fetch sessions:", e);
    }
  };

  const handleCreateSubmit = async (formData: any) => {
    setIsFormLoading(true);
    try {
      await createPersona(formData);
      await fetchPersonas();
      setIsCreating(false);
    } catch (e) {
      console.error("Failed to create persona:", e);
      alert("Failed to create persona. Please try again.");
    } finally {
      setIsFormLoading(false);
    }
  };

  const allPersonas = [...PERSONA_OPTIONS, ...customPersonas];

  return (
    <div className="flex flex-col items-center p-8 h-full space-y-8 flex-grow overflow-y-auto">
      <div className="text-center space-y-2 mt-8">
        <h1 className="text-4xl font-extrabold text-white tracking-tight">AI Persona Dashboard</h1>
        <p className="text-slate-400 max-w-lg mx-auto">Select a persona or create your own to start an AI-powered session.</p>
      </div>

      <div className="flex flex-wrap justify-center gap-6 max-w-6xl w-full">
        {allPersonas.map(p => (
          <button
            key={p.id}
            onClick={() => onSelect(p)}
            className="flex flex-col text-left border border-slate-700 bg-slate-800 p-6 rounded-2xl w-80 hover:border-blue-500 hover:ring-2 ring-blue-500/50 transition-all cursor-pointer group relative"
          >
            {(p as any).isCustom && (
              <span className="absolute top-4 right-4 bg-blue-600 border border-blue-400 text-blue-100 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                Custom
              </span>
            )}
            <h3 className="text-xl font-bold text-slate-100 group-hover:text-blue-400 transition-colors pr-12">{p.name}</h3>
            <span className="text-sm font-medium text-blue-500 mb-4">{p.role}</span>
            <div className="bg-slate-900/50 p-4 rounded-lg flex-grow border border-slate-700/50">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">Context Snippet</span>
              <p className="text-sm text-slate-300 italic">"{p.history}"</p>
            </div>
          </button>
        ))}

        {/* Create New Button */}
        <button
          onClick={() => setIsCreating(true)}
          className="flex flex-col items-center justify-center text-center border-2 border-dashed border-slate-600 bg-slate-800/30 p-6 rounded-2xl w-80 min-h-[220px] hover:border-blue-500 hover:bg-slate-800/80 transition-all cursor-pointer group"
        >
          <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center mb-4 group-hover:bg-blue-600 transition-colors">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-slate-300 group-hover:text-white">Create New Persona</h3>
          <p className="text-sm text-slate-500 mt-2">Create any type of AI persona</p>
        </button>
      </div>

      {/* Past Sessions */}
      {pastSessions.length > 0 && (
        <div className="w-full max-w-6xl space-y-4">
          <h2 className="text-2xl font-bold text-white">Past Sessions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pastSessions.map((s: any) => (
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
      )}

      {isCreating && (
        <PersonaForm
          onSubmit={handleCreateSubmit}
          onCancel={() => setIsCreating(false)}
          isLoading={isFormLoading}
        />
      )}
    </div>
  );
}
