import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getPersonas, createPersona, deletePersona } from '../../features/personas/api';
import { PersonaForm } from '../../features/personas/PersonaForm';
import { PERSONA_OPTIONS } from '../../entities/personas/constants';
import { PlusIcon, TrashIcon, GlobeIcon } from '../../shared/ui/Icons';

export function AgentsPage() {
  const navigate = useNavigate();
  const [customPersonas, setCustomPersonas] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isFormLoading, setIsFormLoading] = useState(false);

  useEffect(() => {
    fetchPersonas();
  }, []);

  const fetchPersonas = async () => {
    try {
      const data = await getPersonas();
      setCustomPersonas(data);
    } catch (e) {
      console.error('Failed to fetch personas:', e);
    }
  };

  const handleCreateSubmit = async (formData: any) => {
    setIsFormLoading(true);
    try {
      await createPersona(formData);
      await fetchPersonas();
      setIsCreating(false);
    } catch (e) {
      console.error('Failed to create persona:', e);
    } finally {
      setIsFormLoading(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this agent?')) return;
    try {
      await deletePersona(id);
      setCustomPersonas((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      console.error('Failed to delete persona:', e);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-text-primary tracking-tight">Agents</h1>
          <p className="text-text-secondary mt-1">Your AI personas for live practice sessions</p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          Create Agent
        </button>
      </div>

      {/* Starter Agents */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">Starter Agents</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {PERSONA_OPTIONS.map((p) => (
            <Link
              key={p.id}
              to={`/agents/${p.id}`}
              className="group bg-surface-secondary border border-border-primary rounded-xl p-5 hover:border-blue-500 transition-all"
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-text-primary group-hover:text-blue-500 transition-colors">{p.name}</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-tertiary text-text-muted uppercase tracking-wider">
                  Starter
                </span>
              </div>
              <p className="text-sm text-blue-500 mb-3">{p.role}</p>
              <p className="text-xs text-text-muted line-clamp-2">{p.history}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Custom Agents */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">Your Agents</h2>
        {customPersonas.length === 0 ? (
          <div className="bg-surface-secondary border border-border-primary border-dashed rounded-xl p-10 text-center">
            <GlobeIcon className="w-12 h-12 text-text-muted mx-auto mb-4" />
            <h3 className="text-lg font-bold text-text-primary mb-2">You don't have any agents yet!</h3>
            <p className="text-sm text-text-secondary mb-6 max-w-md mx-auto">
              Pick one from the Community to get started, or create your own from scratch.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => navigate('/community')}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                <GlobeIcon className="w-4 h-4" />
                Browse Community
              </button>
              <button
                onClick={() => setIsCreating(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 border border-border-primary hover:bg-surface-tertiary text-text-primary rounded-lg font-medium transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                Create from Scratch
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {customPersonas.map((p) => (
              <Link
                key={p.id}
                to={`/agents/${p.id}`}
                className="group bg-surface-secondary border border-border-primary rounded-xl p-5 hover:border-blue-500 transition-all relative"
              >
                <button
                  onClick={(e) => handleDelete(p.id, e)}
                  className="absolute top-4 right-4 p-1.5 rounded-lg text-text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
                <div className="flex justify-between items-start mb-2 pr-8">
                  <h3 className="font-bold text-text-primary group-hover:text-blue-500 transition-colors">{p.name}</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-600/20 text-blue-400 uppercase tracking-wider">
                    Custom
                  </span>
                </div>
                <p className="text-sm text-blue-500 mb-3">{p.role}</p>
                <p className="text-xs text-text-muted line-clamp-2">{p.focus_areas}</p>
                <div className="mt-3 flex items-center gap-2 text-xs text-text-muted">
                  <span className="px-2 py-0.5 bg-surface-tertiary rounded">{p.type}</span>
                  <span>Voice: {p.voice}</span>
                </div>
              </Link>
            ))}

            {/* Add new card */}
            <button
              onClick={() => setIsCreating(true)}
              className="flex flex-col items-center justify-center border-2 border-dashed border-border-primary bg-surface-secondary/50 rounded-xl p-5 min-h-[180px] hover:border-blue-500 hover:bg-surface-secondary transition-all group"
            >
              <div className="w-10 h-10 rounded-full bg-surface-tertiary flex items-center justify-center mb-3 group-hover:bg-blue-600 transition-colors">
                <PlusIcon className="w-5 h-5 text-text-muted group-hover:text-white" />
              </div>
              <span className="font-medium text-text-secondary group-hover:text-text-primary">Create New Agent</span>
            </button>
          </div>
        )}
      </div>

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
