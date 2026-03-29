import { CanvasArtifact } from './types';
import { ArtifactRenderer } from './ArtifactRenderer';
import { MAX_ARTIFACTS } from '../../entities/canvas/constants';

interface Props {
  artifacts: CanvasArtifact[];
  activeIndex: number;
  onTabChange: (index: number) => void;
  visible: boolean;
}

export function CanvasPanel({ artifacts, activeIndex, onTabChange, visible }: Props) {
  const capped = artifacts.slice(-MAX_ARTIFACTS);
  const active = capped[activeIndex] ?? capped[capped.length - 1];

  return (
    <div
      className={`absolute top-[57px] right-0 bottom-[88px] z-10 flex flex-col
        bg-surface-secondary/95 backdrop-blur-xl border-l border-border-primary/30
        transition-all duration-300 ease-in-out overflow-hidden`}
      style={{ width: visible ? '340px' : '0px', opacity: visible ? 1 : 0 }}
    >
      {/* Header */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-border-primary/20 flex-shrink-0">
        <span className="text-[10px] uppercase tracking-widest text-text-muted font-medium">Canvas</span>
        <span className="text-[10px] text-text-muted tabular-nums">{capped.length} artifact{capped.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Tabs */}
      {capped.length > 1 && (
        <div className="flex overflow-x-auto border-b border-border-primary/20 flex-shrink-0 scrollbar-hide">
          {capped.map((a, i) => (
            <button
              key={a.id}
              onClick={() => onTabChange(i)}
              className={`flex-shrink-0 px-3 py-2 text-[11px] font-medium whitespace-nowrap transition-colors duration-150
                ${i === activeIndex
                  ? 'text-amber-400 border-b-2 border-amber-400 bg-amber-500/5'
                  : 'text-text-muted hover:text-text-secondary border-b-2 border-transparent'
                }`}
            >
              {a.title.length > 18 ? a.title.slice(0, 18) + '…' : a.title}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {capped.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <CanvasIcon className="w-5 h-5 text-amber-400/60" />
            </div>
            <p className="text-xs text-text-muted max-w-[200px] leading-relaxed">
              Ask the agent for analysis, comparisons, or a scorecard and it will appear here.
            </p>
          </div>
        ) : active ? (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-text-primary leading-tight">{active.title}</h3>
            <ArtifactRenderer artifact={active} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CanvasIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <rect x="3" y="3" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9h18M9 21V9" />
    </svg>
  );
}
