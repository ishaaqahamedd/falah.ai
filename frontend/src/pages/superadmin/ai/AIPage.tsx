import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card } from '../../../shared/ui/Card';
import { Button } from '../../../shared/ui/Button';
import { BotIcon } from '../../../shared/ui/Icons';
import { StatusDot } from '../../../shared/ui/StatusDot';
import { fetchAIModels, updateAIModel } from '../../../features/superadmin/api';
import type { AvailableModel, LiveModel, ModelSettings } from '../../../features/superadmin/types';

const TIER_COLORS: Record<string, string> = {
  recommended: 'text-emerald-400',
  legacy:      'text-amber-400',
  beta:        'text-purple-400',
  stable:      'text-blue-400',
};

const THINKING_LEVEL_LABELS: Record<string, string> = {
  minimal: 'Minimal',
  low:     'Low',
  medium:  'Medium',
  high:    'High',
};

const THINKING_LEVEL_DESC: Record<string, string> = {
  minimal: 'Fastest — lowest latency',
  low:     'Light reasoning',
  medium:  'Balanced',
  high:    'Deepest reasoning — highest latency',
};

export function AIPage() {
  const [current, setCurrent]       = useState<LiveModel | null>(null);
  const [available, setAvailable]   = useState<AvailableModel[]>([]);
  const [selected, setSelected]     = useState('');
  const [settings, setSettings]     = useState<ModelSettings>({});
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    fetchAIModels()
      .then((res) => {
        setCurrent(res.current);
        setAvailable(res.available);
        setSelected(res.current.model_id);
        setSettings(res.current.settings ?? {});
      })
      .finally(() => setLoading(false));
  }, []);

  const selectedModel = available.find((m) => m.id === selected);
  const thinkingSpec  = selectedModel?.capabilities.thinking;

  const activeSettings = current?.settings ?? {};
  const modelChanged   = selected !== current?.model_id;
  const settingsChanged =
    settings.thinking_level !== activeSettings.thinking_level ||
    settings.thinking_budget !== activeSettings.thinking_budget;
  const hasChanged = modelChanged || settingsChanged;

  function handleModelSelect(modelId: string) {
    setSelected(modelId);
    // Reset settings to the new model's defaults from capabilities
    const model = available.find((m) => m.id === modelId);
    if (!model) return;
    const t = model.capabilities.thinking;
    if (t.type === 'level') {
      setSettings({ thinking_level: t.default as string });
    } else if (t.type === 'budget') {
      setSettings({ thinking_budget: t.default as number });
    } else {
      setSettings({});
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await updateAIModel(selected, settings);
      setCurrent(res.current);
      setAvailable(res.available);
      toast.success(`Switched to ${res.current.model_id}`);
    } catch {
      toast.error('Failed to update model config.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-text-muted text-sm">
        Loading model config...
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-text-primary">Gemini AI</h1>
        <p className="text-sm text-text-muted mt-0.5">
          Switch the live agent model and configure settings. Takes effect on the next session.
        </p>
      </div>

      {/* Active model card */}
      <Card padding="md" className="mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600/10 flex items-center justify-center">
              <BotIcon className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-text-muted font-medium uppercase tracking-wider">Active Model</p>
              <p className="text-sm font-semibold text-text-primary mt-0.5">{current?.model_id}</p>
              {current?.settings?.thinking_level && (
                <p className="text-xs text-text-muted mt-0.5">
                  Thinking: {THINKING_LEVEL_LABELS[current.settings.thinking_level] ?? current.settings.thinking_level}
                </p>
              )}
              {current?.settings?.thinking_budget !== undefined && (
                <p className="text-xs text-text-muted mt-0.5">
                  Thinking budget: {current.settings.thinking_budget} tokens
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusDot color="emerald" pulse />
            <span className="text-xs text-text-muted">Live</span>
          </div>
        </div>
        {current?.updated_at && (
          <p className="text-xs text-text-muted mt-3 pt-3 border-t border-border-primary">
            Last updated: {new Date(current.updated_at).toLocaleString()}
          </p>
        )}
      </Card>

      {/* Model switcher */}
      <Card padding="md" className="mb-4">
        <p className="text-sm font-semibold text-text-primary mb-4">Switch Model</p>

        <div className="space-y-2">
          {available.map((model) => {
            const isActive = model.id === current?.model_id;
            const isChosen = model.id === selected;

            return (
              <button
                key={model.id}
                onClick={() => handleModelSelect(model.id)}
                className={[
                  'w-full flex items-center justify-between px-4 py-3 rounded-lg border text-left transition-colors',
                  isChosen
                    ? 'border-blue-500 bg-blue-600/5'
                    : 'border-border-primary hover:border-blue-500/50 hover:bg-surface-tertiary',
                ].join(' ')}
              >
                <div className="flex items-center gap-3">
                  <div className={[
                    'w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                    isChosen ? 'border-blue-500' : 'border-border-primary',
                  ].join(' ')}>
                    {isChosen && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">{model.label}</p>
                    <p className="text-xs text-text-muted font-mono">{model.id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium ${TIER_COLORS[model.tier] ?? 'text-text-muted'}`}>
                    {model.tier}
                  </span>
                  {isActive && (
                    <span className="text-xs text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-md">
                      active
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Dynamic settings panel — rendered based on selected model's capabilities */}
      {selectedModel && (
        <Card padding="md" className="mb-4">
          <p className="text-sm font-semibold text-text-primary mb-1">Model Settings</p>
          <p className="text-xs text-text-muted mb-4">{selectedModel.label}</p>

          {/* Thinking — level (3.x models) */}
          {thinkingSpec?.type === 'level' && thinkingSpec.options && (
            <div className="mb-4">
              <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
                Thinking Level
              </p>
              <div className="grid grid-cols-2 gap-2">
                {thinkingSpec.options.map((level) => {
                  const isSelected = settings.thinking_level === level;
                  return (
                    <button
                      key={level}
                      onClick={() => setSettings((s) => ({ ...s, thinking_level: level }))}
                      className={[
                        'flex flex-col items-start px-3 py-2.5 rounded-lg border text-left transition-colors',
                        isSelected
                          ? 'border-blue-500 bg-blue-600/5'
                          : 'border-border-primary hover:border-blue-500/50 hover:bg-surface-tertiary',
                      ].join(' ')}
                    >
                      <span className={`text-sm font-medium ${isSelected ? 'text-blue-400' : 'text-text-primary'}`}>
                        {THINKING_LEVEL_LABELS[level] ?? level}
                      </span>
                      <span className="text-xs text-text-muted mt-0.5">
                        {THINKING_LEVEL_DESC[level] ?? ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Thinking — budget (2.x models) */}
          {thinkingSpec?.type === 'budget' && (
            <div className="mb-4">
              <label className="text-xs font-medium text-text-muted uppercase tracking-wider block mb-2">
                Thinking Budget (tokens)
              </label>
              <input
                type="number"
                min={0}
                value={settings.thinking_budget ?? (thinkingSpec.default as number)}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, thinking_budget: Number(e.target.value) }))
                }
                className="w-full px-3 py-2 rounded-lg border border-border-primary bg-surface-tertiary text-text-primary text-sm focus:outline-none focus:border-blue-500"
              />
              <p className="text-xs text-text-muted mt-1">
                0 = disabled · -1 = auto · 128 = minimal reasoning (~100–300ms)
              </p>
            </div>
          )}

          {/* Feature flags — informational only */}
          <div className="flex gap-2 flex-wrap pt-1">
            <FeatureFlag
              label="Affective Dialog"
              supported={selectedModel.capabilities.affective_dialog}
            />
            <FeatureFlag
              label="Proactive Audio"
              supported={selectedModel.capabilities.proactivity}
            />
          </div>
        </Card>
      )}

      {/* Apply bar */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-muted">
          {hasChanged ? (
            modelChanged
              ? `Switch to: ${selected}`
              : 'Settings changed'
          ) : (
            'No changes'
          )}
        </p>
        <Button
          intent="primary"
          size="sm"
          onClick={handleSave}
          isLoading={saving}
          disabled={!hasChanged}
        >
          Apply
        </Button>
      </div>
    </div>
  );
}

function FeatureFlag({ label, supported }: { label: string; supported: boolean }) {
  return (
    <span
      className={[
        'text-xs px-2 py-1 rounded-md font-medium',
        supported
          ? 'text-emerald-400 bg-emerald-400/10'
          : 'text-text-muted bg-surface-tertiary',
      ].join(' ')}
    >
      {supported ? '✓' : '✗'} {label}
    </span>
  );
}
