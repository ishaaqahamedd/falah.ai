import { Drawer } from '../../shared/ui/Drawer';
import { GlobeIcon, PlayIcon } from '../../shared/ui/Icons';
import type { ScoringCriterion } from '@shared/types';

interface AgentPreviewData {
  name: string;
  role: string;
  type: string;
  personality: string;
  focus_areas?: string;
  voice?: string;
  scoring_criteria?: ScoringCriterion[] | null;
  behavior_rules?: string[];
  opening_message?: string | null;
  creator_name?: string;
  use_count?: number;
}

interface AgentPreviewDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  agent: AgentPreviewData | null;
  /** 'template' shows "Add to My Agents", 'community' shows "Use This Agent" */
  variant: 'template' | 'community';
  onAction: () => void;
  actionLoading?: boolean;
  /** Hide action button (e.g. for own agents in community) */
  hideAction?: boolean;
}

export function AgentPreviewDrawer({
  isOpen,
  onClose,
  agent,
  variant,
  onAction,
  actionLoading = false,
  hideAction = false,
}: AgentPreviewDrawerProps) {
  if (!agent) return null;

  const isTemplate = variant === 'template';

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Agent Preview" width="w-[520px]">
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-surface border border-border-primary rounded-xl p-5">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="text-xl font-bold text-text-primary">{agent.name}</h3>
              <p className="text-sm text-blue-500 mt-0.5">{agent.role}</p>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-surface-tertiary text-text-muted uppercase tracking-wider shrink-0">
              {agent.type}
            </span>
          </div>
          {!isTemplate && agent.creator_name && (
            <p className="text-xs text-text-muted mt-2">by {agent.creator_name}</p>
          )}
          {!isTemplate && (agent.use_count ?? 0) > 0 && (
            <p className="text-xs text-text-muted mt-1">{agent.use_count} uses</p>
          )}
        </div>

        {/* Personality */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Personality</h4>
          <p className="text-sm text-text-secondary leading-relaxed">{agent.personality}</p>
        </div>

        {/* Focus Areas */}
        {agent.focus_areas && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Focus Areas</h4>
            <p className="text-sm text-text-secondary leading-relaxed">{agent.focus_areas}</p>
          </div>
        )}

        {/* Scoring Criteria */}
        {agent.scoring_criteria && agent.scoring_criteria.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Scoring Criteria</h4>
            <div className="bg-surface border border-border-primary rounded-xl p-4 space-y-2">
              {agent.scoring_criteria.map((c, i) => (
                <div key={i} className="flex justify-between items-start gap-3 text-sm">
                  <span className="text-text-primary font-medium shrink-0">{c.label}</span>
                  <span className="text-text-muted text-xs text-right">{c.desc}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Behavior Rules */}
        {agent.behavior_rules && agent.behavior_rules.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Behavior Rules</h4>
            <ul className="space-y-1.5">
              {agent.behavior_rules.map((rule: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                  {rule}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Opening Message */}
        {agent.opening_message && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Opening Message</h4>
            <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-4">
              <p className="text-sm text-text-secondary italic leading-relaxed">"{agent.opening_message}"</p>
            </div>
          </div>
        )}

        {/* Voice */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-text-muted">Voice:</span>
          <span className="px-2.5 py-0.5 bg-surface-tertiary rounded-lg text-text-primary font-medium text-xs">
            {agent.voice || 'Puck'}
          </span>
        </div>

        {/* Action Button */}
        {!hideAction && (
          <button
            onClick={onAction}
            disabled={actionLoading}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-base rounded-xl transition-colors shadow-lg cursor-pointer inline-flex items-center justify-center gap-2"
          >
            {isTemplate ? (
              actionLoading ? 'Adding...' : 'Add to My Agents'
            ) : (
              <>
                <PlayIcon className="w-4 h-4" />
                {actionLoading ? 'Loading...' : 'Use This Agent'}
              </>
            )}
          </button>
        )}
      </div>
    </Drawer>
  );
}
