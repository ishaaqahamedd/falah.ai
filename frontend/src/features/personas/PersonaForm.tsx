import React, { useState, useEffect } from 'react';
import { getPersonaTemplates } from './api';

const VOICES = [
  { id: 'Puck', name: 'Puck (Default)', desc: 'Friendly and professional' },
  { id: 'Charon', name: 'Charon', desc: 'Deep and authoritative' },
  { id: 'Kore', name: 'Kore', desc: 'Calm and steady' },
  { id: 'Fenrir', name: 'Fenrir', desc: 'Energetic and bold' },
  { id: 'Aoede', name: 'Aoede', desc: 'Warm and expressive' },
  { id: 'Leda', name: 'Leda', desc: 'Clear and articulate' },
  { id: 'Orus', name: 'Orus', desc: 'Neutral and direct' },
  { id: 'Zephyr', name: 'Zephyr', desc: 'Breezy and fast-paced' }
];

interface ScoringCriterion {
  key: string;
  label: string;
  desc: string;
}

interface PersonaFormData {
  type: string;
  name: string;
  role: string;
  personality: string;
  focus_areas: string;
  voice: string;
  scoring_criteria: ScoringCriterion[];
  behavior_rules: string[];
  opening_message: string;
}

interface PersonaFormProps {
  onSubmit: (formData: Record<string, unknown>) => void;
  onCancel: () => void;
  isLoading: boolean;
}

function toKey(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export function PersonaForm({ onSubmit, onCancel, isLoading }: PersonaFormProps) {
  const [templates, setTemplates] = useState<any[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [formData, setFormData] = useState<PersonaFormData>({
    type: '',
    name: '',
    role: '',
    personality: '',
    focus_areas: '',
    voice: 'Puck',
    scoring_criteria: [],
    behavior_rules: [],
    opening_message: '',
  });

  useEffect(() => {
    getPersonaTemplates().then(setTemplates).catch(() => {});
  }, []);

  const applyTemplate = (t: any) => {
    setFormData({
      type: t.type || '',
      name: t.name || '',
      role: t.role || '',
      personality: t.personality || '',
      focus_areas: t.focus_areas || '',
      voice: t.voice || 'Puck',
      scoring_criteria: t.scoring_criteria || [],
      behavior_rules: t.behavior_rules || [],
      opening_message: t.opening_message || '',
    });
    setShowAdvanced(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, unknown> = {
      type: formData.type,
      name: formData.name,
      role: formData.role,
      personality: formData.personality,
      focus_areas: formData.focus_areas,
      voice: formData.voice,
    };
    if (formData.scoring_criteria.length > 0) {
      payload.scoring_criteria = formData.scoring_criteria;
    }
    if (formData.behavior_rules.length > 0) {
      payload.behavior_rules = formData.behavior_rules.filter(r => r.trim());
    }
    if (formData.opening_message.trim()) {
      payload.opening_message = formData.opening_message;
    }
    onSubmit(payload);
  };

  // Scoring criteria helpers
  const addCriterion = () => {
    setFormData({
      ...formData,
      scoring_criteria: [...formData.scoring_criteria, { key: '', label: '', desc: '' }],
    });
  };
  const updateCriterion = (idx: number, field: keyof ScoringCriterion, value: string) => {
    const updated = [...formData.scoring_criteria];
    updated[idx] = { ...updated[idx], [field]: value };
    if (field === 'label') {
      updated[idx].key = toKey(value);
    }
    setFormData({ ...formData, scoring_criteria: updated });
  };
  const removeCriterion = (idx: number) => {
    setFormData({
      ...formData,
      scoring_criteria: formData.scoring_criteria.filter((_, i) => i !== idx),
    });
  };

  // Behavior rules helpers
  const addRule = () => {
    setFormData({ ...formData, behavior_rules: [...formData.behavior_rules, ''] });
  };
  const updateRule = (idx: number, value: string) => {
    const updated = [...formData.behavior_rules];
    updated[idx] = value;
    setFormData({ ...formData, behavior_rules: updated });
  };
  const removeRule = (idx: number) => {
    setFormData({
      ...formData,
      behavior_rules: formData.behavior_rules.filter((_, i) => i !== idx),
    });
  };

  const inputClass = "w-full bg-surface border border-border-primary rounded-lg p-3 text-text-primary focus:ring-2 focus:ring-blue-500 outline-none placeholder:text-text-muted";

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface-secondary border border-border-primary rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-border-secondary flex justify-between items-center bg-surface-tertiary/50 rounded-t-2xl">
          <h2 className="text-2xl font-bold text-text-primary">Create Persona</h2>
          <button onClick={onCancel} className="text-text-muted hover:text-text-primary transition">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {/* Template Picker */}
          {templates.length > 0 && (
            <div className="space-y-3">
              <label className="text-sm font-semibold text-text-secondary">Start from a template</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {templates.map((t: any) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => applyTemplate(t)}
                    className={`text-left p-3 rounded-lg border transition-all text-sm ${
                      formData.type === t.type && formData.name === t.name
                        ? 'border-blue-500 bg-blue-600/20 ring-1 ring-blue-500/50'
                        : 'border-border-primary bg-surface/50 hover:border-border-primary/80'
                    }`}
                  >
                    <div className="font-semibold text-text-primary truncate">{t.name}</div>
                    <div className="text-xs text-text-muted truncate">{t.type}</div>
                  </button>
                ))}
              </div>
              <div className="border-b border-border-secondary pt-2" />
            </div>
          )}

          <form id="persona-form" onSubmit={handleSubmit} className="space-y-6">
            {/* Type + Voice */}
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-text-secondary">Persona Type</label>
                <input
                  required
                  placeholder="e.g. investor, onboarding, training, support..."
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value})}
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-text-secondary">AI Voice</label>
                <select
                  value={formData.voice}
                  onChange={(e) => setFormData({...formData, voice: e.target.value})}
                  className={inputClass}
                >
                  {VOICES.map(v => (
                    <option key={v.id} value={v.id}>{v.name} - {v.desc}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Name + Role */}
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-text-secondary">Name</label>
                <input
                  required
                  placeholder="e.g. Sarah, Product Guide, KT Bot"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-text-secondary">Role / Title</label>
                <input
                  required
                  placeholder="e.g. Managing Partner, Training Lead"
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
                  className={inputClass}
                />
              </div>
            </div>

            {/* Personality */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-text-secondary flex justify-between">
                <span>Core Personality & Traits</span>
                <span className="text-text-muted font-normal">How should they act?</span>
              </label>
              <textarea
                required
                rows={3}
                placeholder="e.g. Patient and encouraging. Guides step-by-step. Celebrates small wins."
                value={formData.personality}
                onChange={(e) => setFormData({...formData, personality: e.target.value})}
                className={inputClass + " resize-none"}
              />
            </div>

            {/* Focus Areas */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-text-secondary flex justify-between">
                <span>Key Focus Areas</span>
                <span className="text-text-muted font-normal">What do they care about?</span>
              </label>
              <textarea
                required
                rows={3}
                placeholder="e.g. Account setup, feature discovery, troubleshooting, integrations..."
                value={formData.focus_areas}
                onChange={(e) => setFormData({...formData, focus_areas: e.target.value})}
                className={inputClass + " resize-none"}
              />
            </div>

            {/* Advanced Section Toggle */}
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center space-x-2 text-text-muted hover:text-blue-400 transition text-sm font-medium"
            >
              <svg className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span>Advanced Settings (Scoring, Rules, Opening)</span>
            </button>

            {showAdvanced && (
              <div className="space-y-6 border-t border-border-secondary pt-6">
                {/* Scoring Criteria */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-semibold text-text-secondary">Scoring Criteria</label>
                    <button type="button" onClick={addCriterion} className="text-xs px-3 py-1 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/30 transition font-medium">
                      + Add Dimension
                    </button>
                  </div>
                  <p className="text-xs text-text-muted">Define how sessions with this persona will be scored (1-10 each).</p>
                  {formData.scoring_criteria.map((c, idx) => (
                    <div key={idx} className="flex gap-3 items-start">
                      <div className="flex-1 space-y-1">
                        <input
                          placeholder="Label (e.g. Clarity)"
                          value={c.label}
                          onChange={(e) => updateCriterion(idx, 'label', e.target.value)}
                          className="w-full bg-surface border border-border-primary rounded-lg p-2 text-text-primary text-sm focus:ring-2 focus:ring-blue-500 outline-none placeholder:text-text-muted"
                        />
                      </div>
                      <div className="flex-[2] space-y-1">
                        <input
                          placeholder="Description (e.g. Clear and structured communication)"
                          value={c.desc}
                          onChange={(e) => updateCriterion(idx, 'desc', e.target.value)}
                          className="w-full bg-surface border border-border-primary rounded-lg p-2 text-text-primary text-sm focus:ring-2 focus:ring-blue-500 outline-none placeholder:text-text-muted"
                        />
                      </div>
                      <button type="button" onClick={() => removeCriterion(idx)} className="text-text-muted hover:text-red-400 transition mt-1.5">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  {formData.scoring_criteria.length === 0 && (
                    <p className="text-xs text-text-muted italic">No custom criteria — will use default scoring dimensions.</p>
                  )}
                </div>

                {/* Behavior Rules */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-semibold text-text-secondary">Behavior Rules</label>
                    <button type="button" onClick={addRule} className="text-xs px-3 py-1 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/30 transition font-medium">
                      + Add Rule
                    </button>
                  </div>
                  <p className="text-xs text-text-muted">Custom instructions for how the AI should behave during sessions.</p>
                  {formData.behavior_rules.map((rule, idx) => (
                    <div key={idx} className="flex gap-3 items-center">
                      <span className="text-xs text-text-muted w-6 text-right">{idx + 1}.</span>
                      <input
                        placeholder="e.g. Always confirm user completed each step before moving on"
                        value={rule}
                        onChange={(e) => updateRule(idx, e.target.value)}
                        className="flex-1 bg-surface border border-border-primary rounded-lg p-2 text-text-primary text-sm focus:ring-2 focus:ring-blue-500 outline-none placeholder:text-text-muted"
                      />
                      <button type="button" onClick={() => removeRule(idx)} className="text-text-muted hover:text-red-400 transition">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>

                {/* Opening Message */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-text-secondary">Opening Message</label>
                  <p className="text-xs text-text-muted">How the AI should greet and start the session.</p>
                  <textarea
                    rows={2}
                    placeholder="e.g. Welcome them warmly and ask what they'd like to set up today."
                    value={formData.opening_message}
                    onChange={(e) => setFormData({...formData, opening_message: e.target.value})}
                    className={inputClass + " resize-none text-sm"}
                  />
                </div>
              </div>
            )}
          </form>
        </div>

        <div className="p-6 border-t border-border-secondary flex justify-end space-x-4 bg-surface-tertiary/30 rounded-b-2xl">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-tertiary transition font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="persona-form"
            disabled={isLoading}
            className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition font-bold shadow-lg shadow-blue-900/20"
          >
            {isLoading ? 'Creating...' : 'Create Persona'}
          </button>
        </div>
      </div>
    </div>
  );
}
