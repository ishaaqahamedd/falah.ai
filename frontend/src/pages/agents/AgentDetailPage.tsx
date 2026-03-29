import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPersona, updatePersona } from '../../features/personas/api';
import { VOICES } from '../../entities/personas/constants';
import { ChevronLeftIcon, PlayIcon, GlobeIcon, LockIcon } from '../../shared/ui/Icons';
import { PreFlightDrawer } from '../../widgets/preflight-drawer/PreFlightDrawer';

interface ScoringCriterion {
  key?: string;
  label: string;
  desc: string;
}

interface AgentDetail {
  id: string;
  name: string;
  role: string;
  type: string;
  personality: string;
  focus_areas: string;
  voice: string;
  scoring_criteria?: ScoringCriterion[] | null;
  behavior_rules?: string[];
  opening_message?: string | null;
  is_public?: boolean;
  grounding_enabled?: boolean;
  is_system?: boolean;
  use_count?: number;
  history?: string;
}

function toKey(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export function AgentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [persona, setPersona] = useState<AgentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPreset, setIsPreset] = useState(false);
  const [showPreflight, setShowPreflight] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<AgentDetail>>({});
  const [saving, setSaving] = useState(false);
  const [showVisibilityConfirm, setShowVisibilityConfirm] = useState(false);
  const [togglingVisibility, setTogglingVisibility] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => { loadPersona(); }, [id]);

  const loadPersona = async () => {
    setLoading(true);
    try {
      if (id) {
        const data = await getPersona(id);
        setPersona(data);
        setEditData(data);
        setIsPreset(data.is_system ?? false);
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
      const payload: Record<string, unknown> = {
        name: editData.name,
        role: editData.role,
        type: editData.type,
        personality: editData.personality,
        focus_areas: editData.focus_areas,
        voice: editData.voice,
        grounding_enabled: editData.grounding_enabled ?? false,
      };
      if (editData.scoring_criteria && editData.scoring_criteria.length > 0) {
        payload.scoring_criteria = editData.scoring_criteria;
      }
      if (editData.behavior_rules && editData.behavior_rules.length > 0) {
        payload.behavior_rules = editData.behavior_rules.filter(r => r.trim());
      }
      if (editData.opening_message?.trim()) {
        payload.opening_message = editData.opening_message;
      }
      const updated = await updatePersona(id, payload);
      setPersona(updated);
      setEditing(false);
      setShowAdvanced(false);
    } catch (e) {
      console.error('Failed to update persona:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleVisibility = async () => {
    if (!id || isPreset || !persona) return;
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

  // Scoring criteria helpers
  const addCriterion = () => {
    setEditData(prev => ({
      ...prev,
      scoring_criteria: [...(prev.scoring_criteria || []), { key: '', label: '', desc: '' }],
    }));
  };
  const updateCriterion = (idx: number, field: keyof ScoringCriterion, value: string) => {
    const updated = [...(editData.scoring_criteria || [])];
    updated[idx] = { ...updated[idx], [field]: value };
    if (field === 'label') updated[idx].key = toKey(value);
    setEditData(prev => ({ ...prev, scoring_criteria: updated }));
  };
  const removeCriterion = (idx: number) => {
    setEditData(prev => ({
      ...prev,
      scoring_criteria: (prev.scoring_criteria || []).filter((_, i) => i !== idx),
    }));
  };

  // Behavior rules helpers
  const addRule = () => {
    setEditData(prev => ({ ...prev, behavior_rules: [...(prev.behavior_rules || []), ''] }));
  };
  const updateRule = (idx: number, value: string) => {
    const updated = [...(editData.behavior_rules || [])];
    updated[idx] = value;
    setEditData(prev => ({ ...prev, behavior_rules: updated }));
  };
  const removeRule = (idx: number) => {
    setEditData(prev => ({
      ...prev,
      behavior_rules: (prev.behavior_rules || []).filter((_, i) => i !== idx),
    }));
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

  const inputClass = 'w-full bg-surface border border-border-primary rounded-lg p-3 text-text-primary focus:ring-2 focus:ring-blue-500 outline-none placeholder:text-text-muted';
  const labelClass = 'text-sm font-semibold text-text-secondary';

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
              onClick={() => { setEditing(true); setShowAdvanced(!!(persona.scoring_criteria?.length || persona.behavior_rules?.length || persona.opening_message)); }}
              className="px-4 py-2 border border-border-primary rounded-lg text-sm font-medium text-text-primary hover:bg-surface-tertiary transition-colors cursor-pointer"
            >
              Edit
            </button>
          )}
          <button
            onClick={() => setShowPreflight(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors cursor-pointer"
          >
            <PlayIcon className="w-4 h-4" />
            Start Session
          </button>
        </div>
      </div>

      {/* ── READ VIEW ──────────────────────────────────────────────────────── */}
      {!editing && (
        <>
          {/* Header */}
          <div className="bg-surface-secondary border border-border-primary rounded-xl p-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-extrabold text-text-primary">{persona.name}</h1>
                <p className="text-blue-500 mt-1">{persona.role}</p>
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
                        <GlobeIcon className="w-3.5 h-3.5" /> Public
                      </span>
                      <button onClick={() => setShowVisibilityConfirm(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors">
                        <LockIcon className="w-3.5 h-3.5" /> Make Private
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface-tertiary text-text-muted">
                        <LockIcon className="w-3.5 h-3.5" /> Private
                      </span>
                      <button onClick={() => setShowVisibilityConfirm(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors">
                        <GlobeIcon className="w-3.5 h-3.5" /> Make Public
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Config grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-surface-secondary border border-border-primary rounded-xl p-6 space-y-3">
              <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider">Identity</h3>
              <div className="flex justify-between text-sm"><span className="text-text-muted">Type</span><span className="text-text-primary font-medium">{persona.type}</span></div>
              <div className="flex justify-between text-sm"><span className="text-text-muted">Voice</span><span className="text-text-primary font-medium">{persona.voice}</span></div>
            </div>

            <div className="bg-surface-secondary border border-border-primary rounded-xl p-6 space-y-3">
              <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider">Personality</h3>
              <p className="text-sm text-text-secondary leading-relaxed">{persona.personality}</p>
            </div>

            <div className="bg-surface-secondary border border-border-primary rounded-xl p-6 space-y-3">
              <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider">Focus Areas</h3>
              <p className="text-sm text-text-secondary leading-relaxed">{persona.focus_areas}</p>
            </div>

            <div className="bg-surface-secondary border border-border-primary rounded-xl p-6 space-y-3">
              <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider">Scoring Criteria</h3>
              {persona.scoring_criteria && persona.scoring_criteria.length > 0 ? (
                <div className="space-y-2">
                  {persona.scoring_criteria.map((c, i) => (
                    <div key={i} className="flex justify-between text-sm gap-4">
                      <span className="text-text-primary font-medium flex-shrink-0">{c.label}</span>
                      <span className="text-text-muted text-xs text-right">{c.desc}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-text-muted italic">Using default scoring dimensions</p>
              )}
            </div>
          </div>

          {/* Capabilities */}
          {!isPreset && (
            <div className="bg-surface-secondary border border-border-primary rounded-xl p-6 space-y-4">
              <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider">Capabilities</h3>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-5 rounded-full flex items-center pointer-events-none ${persona.grounding_enabled ? 'bg-blue-600' : 'bg-surface-tertiary border border-border-primary'}`}>
                    <div className={`w-3.5 h-3.5 rounded-full bg-white shadow mx-0.5 ${persona.grounding_enabled ? 'translate-x-4' : 'translate-x-0'}`} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text-primary">Google Search Grounding</p>
                    <p className="text-xs text-text-muted">Agent searches the web in real-time for current facts</p>
                  </div>
                </div>
                {persona.grounding_enabled
                  ? <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-600/15 text-blue-400">Active</span>
                  : <span className="text-xs text-text-muted px-2.5 py-1 rounded-full bg-surface-tertiary">Off</span>
                }
              </div>
            </div>
          )}

          {/* Behavior rules read view */}
          {persona.behavior_rules && persona.behavior_rules.length > 0 && (
            <div className="bg-surface-secondary border border-border-primary rounded-xl p-6 space-y-3">
              <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider">Behavior Rules</h3>
              <ol className="space-y-2">
                {persona.behavior_rules.map((rule, i) => (
                  <li key={i} className="flex gap-3 text-sm text-text-secondary">
                    <span className="text-text-muted flex-shrink-0 w-5">{i + 1}.</span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Opening message read view */}
          {persona.opening_message && (
            <div className="bg-surface-secondary border border-border-primary rounded-xl p-6 space-y-3">
              <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider">Opening Message</h3>
              <p className="text-sm text-text-secondary leading-relaxed">{persona.opening_message}</p>
            </div>
          )}

          {/* Context (preset agents) */}
          {persona.history && (
            <div className="bg-surface-secondary border border-border-primary rounded-xl p-6 space-y-3">
              <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider">Context</h3>
              <p className="text-sm text-text-secondary">{persona.history}</p>
            </div>
          )}
        </>
      )}

      {/* ── EDIT VIEW ──────────────────────────────────────────────────────── */}
      {editing && (
        <div className="bg-surface-secondary border border-border-primary rounded-xl">
          <div className="p-6 border-b border-border-primary flex justify-between items-center">
            <h2 className="text-lg font-bold text-text-primary">Edit Agent</h2>
            <button onClick={() => { setEditing(false); setEditData(persona); setShowAdvanced(false); }} className="text-text-muted hover:text-text-primary transition cursor-pointer">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-6 space-y-6">

            {/* Name + Role */}
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className={labelClass}>Name</label>
                <input value={editData.name || ''} onChange={(e) => setEditData({ ...editData, name: e.target.value })} className={inputClass} placeholder="e.g. Sarah, Interview Coach" />
              </div>
              <div className="space-y-2">
                <label className={labelClass}>Role / Title</label>
                <input value={editData.role || ''} onChange={(e) => setEditData({ ...editData, role: e.target.value })} className={inputClass} placeholder="e.g. Managing Partner, Training Lead" />
              </div>
            </div>

            {/* Type + Voice */}
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className={labelClass}>Persona Type</label>
                <input value={editData.type || ''} onChange={(e) => setEditData({ ...editData, type: e.target.value })} className={inputClass} placeholder="e.g. investor, training, support" />
              </div>
              <div className="space-y-2">
                <label className={labelClass}>AI Voice</label>
                <select value={editData.voice || 'Puck'} onChange={(e) => setEditData({ ...editData, voice: e.target.value })} className={inputClass}>
                  {VOICES.map(v => (
                    <option key={v.id} value={v.id}>{v.name} — {v.desc}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Personality */}
            <div className="space-y-2">
              <label className={labelClass}>
                Core Personality &amp; Traits
                <span className="text-text-muted font-normal ml-2 text-xs">How should they act?</span>
              </label>
              <textarea rows={3} value={editData.personality || ''} onChange={(e) => setEditData({ ...editData, personality: e.target.value })} className={inputClass + ' resize-none'} placeholder="e.g. Patient and encouraging. Guides step-by-step. Celebrates small wins." />
            </div>

            {/* Focus Areas */}
            <div className="space-y-2">
              <label className={labelClass}>
                Key Focus Areas
                <span className="text-text-muted font-normal ml-2 text-xs">What do they care about?</span>
              </label>
              <textarea rows={3} value={editData.focus_areas || ''} onChange={(e) => setEditData({ ...editData, focus_areas: e.target.value })} className={inputClass + ' resize-none'} placeholder="e.g. Account setup, feature discovery, troubleshooting..." />
            </div>

            {/* Google Search Grounding */}
            <div
              className="flex items-center justify-between p-4 rounded-xl border border-border-primary bg-surface/50 cursor-pointer select-none"
              onClick={() => setEditData({ ...editData, grounding_enabled: !editData.grounding_enabled })}
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-5 rounded-full transition-colors flex items-center ${editData.grounding_enabled ? 'bg-blue-600' : 'bg-surface-tertiary border border-border-primary'}`}>
                  <div className={`w-3.5 h-3.5 rounded-full bg-white shadow transition-transform mx-0.5 ${editData.grounding_enabled ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">Google Search Grounding</p>
                  <p className="text-xs text-text-muted">Agent searches the web in real-time for current facts</p>
                </div>
              </div>
              {editData.grounding_enabled && (
                <span className="text-xs font-medium text-blue-400 bg-blue-600/10 px-2 py-0.5 rounded-full">Active</span>
              )}
            </div>

            {/* Advanced toggle */}
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-text-muted hover:text-blue-400 transition text-sm font-medium cursor-pointer"
            >
              <svg className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Advanced Settings (Scoring, Rules, Opening)
            </button>

            {showAdvanced && (
              <div className="space-y-6 border-t border-border-primary pt-6">

                {/* Scoring Criteria */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <label className={labelClass}>Scoring Criteria</label>
                      <p className="text-xs text-text-muted mt-0.5">Define how sessions will be scored (1–10 each).</p>
                    </div>
                    <button type="button" onClick={addCriterion} className="text-xs px-3 py-1.5 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/30 transition font-medium cursor-pointer">
                      + Add Dimension
                    </button>
                  </div>
                  {(editData.scoring_criteria || []).map((c, idx) => (
                    <div key={idx} className="flex gap-3 items-start">
                      <div className="flex-1">
                        <input
                          placeholder="Label (e.g. Clarity)"
                          value={c.label}
                          onChange={(e) => updateCriterion(idx, 'label', e.target.value)}
                          className="w-full bg-surface border border-border-primary rounded-lg p-2 text-text-primary text-sm focus:ring-2 focus:ring-blue-500 outline-none placeholder:text-text-muted"
                        />
                      </div>
                      <div className="flex-[2]">
                        <input
                          placeholder="Description (e.g. Clear and structured communication)"
                          value={c.desc}
                          onChange={(e) => updateCriterion(idx, 'desc', e.target.value)}
                          className="w-full bg-surface border border-border-primary rounded-lg p-2 text-text-primary text-sm focus:ring-2 focus:ring-blue-500 outline-none placeholder:text-text-muted"
                        />
                      </div>
                      <button type="button" onClick={() => removeCriterion(idx)} className="text-text-muted hover:text-red-400 transition mt-1.5 cursor-pointer">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  {(!editData.scoring_criteria || editData.scoring_criteria.length === 0) && (
                    <p className="text-xs text-text-muted italic">No custom criteria — will use default scoring dimensions.</p>
                  )}
                </div>

                {/* Behavior Rules */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <label className={labelClass}>Behavior Rules</label>
                      <p className="text-xs text-text-muted mt-0.5">Custom instructions for how the AI behaves during sessions.</p>
                    </div>
                    <button type="button" onClick={addRule} className="text-xs px-3 py-1.5 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/30 transition font-medium cursor-pointer">
                      + Add Rule
                    </button>
                  </div>
                  {(editData.behavior_rules || []).map((rule, idx) => (
                    <div key={idx} className="flex gap-3 items-center">
                      <span className="text-xs text-text-muted w-6 text-right flex-shrink-0">{idx + 1}.</span>
                      <input
                        placeholder="e.g. Always confirm user completed each step before moving on"
                        value={rule}
                        onChange={(e) => updateRule(idx, e.target.value)}
                        className="flex-1 bg-surface border border-border-primary rounded-lg p-2 text-text-primary text-sm focus:ring-2 focus:ring-blue-500 outline-none placeholder:text-text-muted"
                      />
                      <button type="button" onClick={() => removeRule(idx)} className="text-text-muted hover:text-red-400 transition cursor-pointer">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  {(!editData.behavior_rules || editData.behavior_rules.length === 0) && (
                    <p className="text-xs text-text-muted italic">No custom rules — will use default behavior.</p>
                  )}
                </div>

                {/* Opening Message */}
                <div className="space-y-2">
                  <label className={labelClass}>Opening Message</label>
                  <p className="text-xs text-text-muted">How the AI should greet and start the session.</p>
                  <textarea
                    rows={2}
                    placeholder="e.g. Welcome them warmly and ask what they'd like to set up today."
                    value={editData.opening_message || ''}
                    onChange={(e) => setEditData({ ...editData, opening_message: e.target.value })}
                    className={inputClass + ' resize-none text-sm'}
                  />
                </div>

              </div>
            )}
          </div>

          {/* Save / Cancel */}
          <div className="px-6 py-4 border-t border-border-primary flex justify-end gap-3 bg-surface-tertiary/20 rounded-b-xl">
            <button
              onClick={() => { setEditing(false); setEditData(persona); setShowAdvanced(false); }}
              className="px-5 py-2 rounded-lg text-text-secondary hover:bg-surface-tertiary transition-colors font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold transition-colors shadow-lg shadow-blue-900/20 cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
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
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${persona.is_public ? 'bg-amber-500/10' : 'bg-emerald-500/10'}`}>
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
              <button onClick={() => setShowVisibilityConfirm(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-text-secondary hover:bg-surface-tertiary transition-colors cursor-pointer">
                Cancel
              </button>
              <button
                onClick={handleToggleVisibility}
                disabled={togglingVisibility}
                className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 cursor-pointer ${
                  persona.is_public ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
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
