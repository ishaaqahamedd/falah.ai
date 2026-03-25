import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPersona, updatePersona } from '../../features/personas/api';
import { PERSONA_OPTIONS } from '../../entities/personas/constants';
import { ChevronLeftIcon, PlayIcon, GlobeIcon, LockIcon } from '../../shared/ui/Icons';
import { Drawer } from '../../shared/ui/Drawer';
import { PreFlightDrawer } from '../../widgets/preflight-drawer/PreFlightDrawer';

export function AgentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [persona, setPersona] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isPreset, setIsPreset] = useState(false);
  const [showPreflight, setShowPreflight] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [showVisibilityConfirm, setShowVisibilityConfirm] = useState(false);
  const [togglingVisibility, setTogglingVisibility] = useState(false);

  useEffect(() => {
    loadPersona();
  }, [id]);

  const loadPersona = async () => {
    setLoading(true);
    try {
      // Check if it's a preset persona
      const preset = PERSONA_OPTIONS.find((p) => p.id === id);
      if (preset) {
        setPersona(preset);
        setIsPreset(true);
      } else if (id) {
        const data = await getPersona(id);
        setPersona(data);
        setEditData(data);
        setIsPreset(false);
      }
    } catch (e) {
      console.error('Failed to load persona:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!id || isPreset) return;
    setSaving(true);
    try {
      const updated = await updatePersona(id, editData);
      setPersona(updated);
      setEditing(false);
    } catch (e) {
      console.error('Failed to update persona:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleVisibility = async () => {
    if (!id || isPreset) return;
    setTogglingVisibility(true);
    try {
      const updated = await updatePersona(id, { is_public: !persona.is_public });
      setPersona(updated);
    } catch (e) {
      console.error('Failed to toggle visibility:', e);
    } finally {
      setTogglingVisibility(false);
      setShowVisibilityConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-blue-500 animate-pulse font-medium">Loading agent...</span>
      </div>
    );
  }

  if (!persona) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <p className="text-text-secondary">Agent not found</p>
        <button onClick={() => navigate('/agents')} className="text-blue-500 hover:underline">Back to Agents</button>
      </div>
    );
  }

  const inputClass = 'w-full bg-surface border border-border-primary rounded-lg p-3 text-text-primary focus:ring-2 focus:ring-blue-500 outline-none';

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-8">
      {/* Back + Actions */}
      <div className="flex justify-between items-center">
        <button
          onClick={() => navigate('/agents')}
          className="inline-flex items-center gap-1 text-text-secondary hover:text-text-primary transition-colors"
        >
          <ChevronLeftIcon className="w-4 h-4" />
          <span className="text-sm font-medium">Back to Agents</span>
        </button>
        <div className="flex items-center gap-3">
          {!isPreset && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="px-4 py-2 border border-border-primary rounded-lg text-sm font-medium text-text-primary hover:bg-surface-tertiary transition-colors"
            >
              Edit
            </button>
          )}
          <button
            onClick={() => setShowPreflight(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            <PlayIcon className="w-4 h-4" />
            Start Session
          </button>
        </div>
      </div>

      {/* Agent Header */}
      <div className="bg-surface-secondary border border-border-primary rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div>
            {editing ? (
              <div className="space-y-3">
                <input value={editData.name || ''} onChange={(e) => setEditData({ ...editData, name: e.target.value })} className={inputClass} placeholder="Name" />
                <input value={editData.role || ''} onChange={(e) => setEditData({ ...editData, role: e.target.value })} className={inputClass} placeholder="Role" />
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-extrabold text-text-primary">{persona.name}</h1>
                <p className="text-blue-500 mt-1">{persona.role}</p>
              </>
            )}
          </div>
          {isPreset ? (
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-surface-tertiary text-text-muted uppercase tracking-wider">
              Starter
            </span>
          ) : (
            <div className="flex items-center gap-2">
              {persona.is_public ? (
                <>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400">
                    <GlobeIcon className="w-3.5 h-3.5" />
                    Public
                  </span>
                  <button
                    onClick={() => setShowVisibilityConfirm(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors"
                  >
                    <LockIcon className="w-3.5 h-3.5" />
                    Make Private
                  </button>
                </>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface-tertiary text-text-muted">
                    <LockIcon className="w-3.5 h-3.5" />
                    Private
                  </span>
                  <button
                    onClick={() => setShowVisibilityConfirm(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                  >
                    <GlobeIcon className="w-3.5 h-3.5" />
                    Make Public
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Config Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-surface-secondary border border-border-primary rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider">Identity</h3>
          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-text-secondary mb-1 block">Type</label>
                <input value={editData.type || ''} onChange={(e) => setEditData({ ...editData, type: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="text-xs text-text-secondary mb-1 block">Voice</label>
                <input value={editData.voice || ''} onChange={(e) => setEditData({ ...editData, voice: e.target.value })} className={inputClass} />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Type</span>
                <span className="text-text-primary font-medium">{persona.type}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Voice</span>
                <span className="text-text-primary font-medium">{persona.voice}</span>
              </div>
            </div>
          )}
        </div>

        <div className="bg-surface-secondary border border-border-primary rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider">Personality</h3>
          {editing ? (
            <textarea rows={4} value={editData.personality || ''} onChange={(e) => setEditData({ ...editData, personality: e.target.value })} className={inputClass + ' resize-none'} />
          ) : (
            <p className="text-sm text-text-secondary leading-relaxed">{persona.personality}</p>
          )}
        </div>

        <div className="bg-surface-secondary border border-border-primary rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider">Focus Areas</h3>
          {editing ? (
            <textarea rows={4} value={editData.focus_areas || ''} onChange={(e) => setEditData({ ...editData, focus_areas: e.target.value })} className={inputClass + ' resize-none'} />
          ) : (
            <p className="text-sm text-text-secondary leading-relaxed">{persona.focus_areas}</p>
          )}
        </div>

        <div className="bg-surface-secondary border border-border-primary rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider">Scoring Criteria</h3>
          {persona.scoring_criteria && persona.scoring_criteria.length > 0 ? (
            <div className="space-y-2">
              {persona.scoring_criteria.map((c: any, i: number) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-text-primary font-medium">{c.label}</span>
                  <span className="text-text-muted text-xs">{c.desc}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-muted italic">Using default scoring dimensions</p>
          )}
        </div>
      </div>

      {/* Context (preset agents have background context) */}
      {persona.history && (
        <div className="bg-surface-secondary border border-border-primary rounded-xl p-6">
          <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">Context</h3>
          <p className="text-sm text-text-secondary">{persona.history}</p>
        </div>
      )}

      {/* Save/Cancel for editing */}
      {editing && (
        <div className="flex justify-end gap-3">
          <button onClick={() => { setEditing(false); setEditData(persona); }} className="px-5 py-2 rounded-lg text-text-secondary hover:bg-surface-tertiary transition-colors font-medium">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}

      {/* Preflight Drawer */}
      <PreFlightDrawer
        isOpen={showPreflight}
        onClose={() => setShowPreflight(false)}
        persona={persona}
      />

      {/* Visibility Confirmation Modal */}
      {showVisibilityConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-surface-secondary border border-border-primary rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                persona.is_public ? 'bg-amber-500/10' : 'bg-emerald-500/10'
              }`}>
                {persona.is_public
                  ? <LockIcon className="w-5 h-5 text-amber-400" />
                  : <GlobeIcon className="w-5 h-5 text-emerald-400" />
                }
              </div>
              <h3 className="text-lg font-bold text-text-primary">
                {persona.is_public ? 'Make Private?' : 'Share with Community?'}
              </h3>
            </div>
            <p className="text-sm text-text-secondary">
              {persona.is_public
                ? `"${persona.name}" will no longer be visible to other users in the community.`
                : `"${persona.name}" will be visible to all logged-in users. They can run live sessions with this agent but cannot edit or access your uploaded documents.`
              }
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowVisibilityConfirm(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-text-secondary hover:bg-surface-tertiary transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleToggleVisibility}
                disabled={togglingVisibility}
                className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 cursor-pointer ${
                  persona.is_public
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {togglingVisibility ? 'Updating...' : persona.is_public ? 'Make Private' : 'Share Publicly'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
