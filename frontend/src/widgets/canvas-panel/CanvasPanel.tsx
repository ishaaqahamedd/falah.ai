import { useRef, useCallback, useEffect } from 'react';
import { CanvasArtifact } from './types';
import { ArtifactRenderer } from './ArtifactRenderer';
import { MAX_ARTIFACTS } from '../../entities/canvas/constants';

const TYPE_COLOR: Record<string, string> = {
  markdown:    '#7c3aed',
  bullet_list: '#0891b2',
  table:       '#2563eb',
  scorecard:   '#d97706',
};

const TYPE_LABEL: Record<string, string> = {
  markdown:    'MARKDOWN',
  bullet_list: 'BULLET LIST',
  table:       'TABLE',
  scorecard:   'SCORECARD',
};

interface Props {
  artifacts: CanvasArtifact[];
  activeIndex: number;
  onTabChange: (index: number) => void;
  visible: boolean;
  isUpdating: boolean;
  isGenerating: boolean;
  generatingTitle: string;
  panelWidth: number;
  onWidthChange: (w: number) => void;
}

export function CanvasPanel({
  artifacts,
  activeIndex,
  onTabChange,
  visible,
  isUpdating,
  isGenerating,
  generatingTitle,
  panelWidth,
  onWidthChange,
}: Props) {
  const capped = artifacts.slice(-MAX_ARTIFACTS);
  const active = capped[activeIndex] ?? capped[capped.length - 1];
  const activeColor = active ? (TYPE_COLOR[active.artifact_type] ?? '#7c3aed') : '#7c3aed';

  // ── Resize drag handle ──────────────────────────────────────────────────
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(panelWidth);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartWidth.current = panelWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [panelWidth]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      // Panel is on the left — dragging right = wider
      const delta = e.clientX - dragStartX.current;
      const next = Math.min(560, Math.max(280, dragStartWidth.current + delta));
      onWidthChange(next);
    };
    const onMouseUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [onWidthChange]);

  return (
    <div
      className="absolute top-[57px] left-0 bottom-[88px] z-10 flex"
      style={{
        width: visible ? `${panelWidth}px` : '0px',
        transition: isDragging.current ? 'none' : 'width 0.3s ease',
        overflow: 'hidden',
      }}
    >
      {/* Panel body */}
      <div
        className="flex flex-col flex-1 relative"
        style={{
          background: 'rgba(10,10,20,0.96)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderRight: '1px solid rgba(255,255,255,0.07)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.25s ease',
          boxShadow: isUpdating
            ? `inset -3px 0 16px ${activeColor}55`
            : '2px 0 24px rgba(0,0,0,0.4)',
        }}
      >
        {/* Top accent bar — type color */}
        <div
          style={{
            height: '2px',
            background: `linear-gradient(to right, ${activeColor}, transparent)`,
            flexShrink: 0,
            transition: 'background 0.4s ease',
          }}
        />

        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-2.5 flex-shrink-0"
          style={{
            background: 'linear-gradient(to right, rgba(255,255,255,0.025), transparent)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div className="flex items-center gap-2">
            <span style={{ fontSize: '9px', letterSpacing: '0.15em', color: 'rgba(255,255,255,0.28)', fontWeight: 600 }}>
              CANVAS
            </span>
            {/* Status dot */}
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                flexShrink: 0,
                background: isGenerating ? '#f59e0b' : isUpdating ? '#10b981' : 'rgba(255,255,255,0.15)',
                boxShadow: isGenerating ? '0 0 6px #f59e0b' : isUpdating ? '0 0 6px #10b981' : 'none',
                animation: isGenerating ? 'canvasPulse 1s ease-in-out infinite' : 'none',
              }}
            />
          </div>

          {/* Active type badge */}
          {active && (
            <span
              style={{
                fontSize: '9px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                padding: '2px 8px',
                borderRadius: '999px',
                color: activeColor,
                background: `${activeColor}20`,
                border: `1px solid ${activeColor}30`,
              }}
            >
              {TYPE_LABEL[active.artifact_type] ?? active.artifact_type.toUpperCase()}
            </span>
          )}

          {/* Artifact counter */}
          {capped.length > 0 && (
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', fontVariantNumeric: 'tabular-nums' }}>
              {Math.min(activeIndex + 1, capped.length)}/{capped.length}
            </span>
          )}
        </div>

        {/* Tabs */}
        {capped.length > 1 && (
          <div
            className="flex overflow-x-auto flex-shrink-0"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
            {capped.map((a, i) => {
              const color = TYPE_COLOR[a.artifact_type] ?? '#7c3aed';
              const isActive = i === activeIndex;
              return (
                <button
                  key={a.id}
                  onClick={() => onTabChange(i)}
                  className="flex items-center gap-1.5 flex-shrink-0 px-3 py-2 whitespace-nowrap transition-all duration-150"
                  style={{
                    fontSize: '11px',
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? color : 'rgba(255,255,255,0.3)',
                    background: isActive ? 'rgba(255,255,255,0.05)' : 'transparent',
                    borderBottom: `2px solid ${isActive ? color : 'transparent'}`,
                  }}
                >
                  <span
                    style={{
                      width: '5px',
                      height: '5px',
                      borderRadius: '50%',
                      background: color,
                      opacity: isActive ? 1 : 0.35,
                      flexShrink: 0,
                    }}
                  />
                  {a.title.length > 16 ? a.title.slice(0, 16) + '…' : a.title}
                </button>
              );
            })}
          </div>
        )}

        {/* Content area */}
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
          {/* Generating shimmer */}
          {isGenerating ? (
            <div className="p-5 space-y-4">
              {/* Pulsing top bar */}
              <div style={{
                height: '3px', borderRadius: '99px', marginBottom: '4px',
                background: `linear-gradient(to right, ${activeColor}, transparent)`,
                animation: 'canvasPulse 1.2s ease-in-out infinite',
              }} />
              {generatingTitle && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                    background: activeColor,
                    boxShadow: `0 0 8px ${activeColor}`,
                    animation: 'canvasPulse 1s ease-in-out infinite',
                  }} />
                  <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.04em' }}>
                    Generating <span style={{ color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>{generatingTitle}</span>
                  </p>
                </div>
              )}
              {/* Title shimmer */}
              <div style={{
                height: '16px', width: '70%', borderRadius: '8px',
                background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.05) 100%)',
                backgroundSize: '200% 100%',
                animation: 'canvasShimmer 1.3s ease-in-out infinite',
              }} />
              <div style={{ height: '1px', background: `${activeColor}30` }} />
              {/* Body shimmer bars */}
              {[100, 85, 95, 70, 90, 60, 80, 75].map((w, i) => (
                <div
                  key={i}
                  style={{
                    height: '11px',
                    width: `${w}%`,
                    borderRadius: '6px',
                    background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.09) 50%, rgba(255,255,255,0.04) 100%)',
                    backgroundSize: '200% 100%',
                    animation: `canvasShimmer 1.3s ease-in-out ${i * 0.08}s infinite`,
                  }}
                />
              ))}
            </div>
          ) : capped.length === 0 ? (
            /* Empty state */
            <div
              className="flex flex-col items-center justify-center h-full gap-5 text-center px-6"
              style={{
                background: 'radial-gradient(ellipse at 50% 40%, rgba(124,58,237,0.07) 0%, transparent 65%)',
                backgroundImage: 'radial-gradient(ellipse at 50% 40%, rgba(124,58,237,0.07) 0%, transparent 65%), radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)',
                backgroundSize: '100% 100%, 18px 18px',
              }}
            >
              <div style={{ position: 'relative', animation: 'canvasFadeIn 0.5s ease-out' }}>
                {/* Outer pulse rings */}
                <div style={{
                  position: 'absolute', inset: '-16px', borderRadius: '30px',
                  border: '1px solid rgba(124,58,237,0.12)',
                  animation: 'canvasRing 2.4s ease-out 0.2s infinite',
                }} />
                <div style={{
                  position: 'absolute', inset: '-8px', borderRadius: '22px',
                  border: '1px solid rgba(124,58,237,0.2)',
                  animation: 'canvasRing 2.4s ease-out infinite',
                }} />
                <div style={{
                  width: '56px', height: '56px', borderRadius: '16px',
                  background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(124,58,237,0.08))',
                  border: '1px solid rgba(124,58,237,0.25)',
                  boxShadow: '0 0 24px rgba(124,58,237,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative', zIndex: 1,
                }}>
                  <CanvasIcon style={{ width: '26px', height: '26px', color: 'rgba(167,139,250,0.8)' }} />
                </div>
              </div>
              <div style={{ animation: 'canvasFadeIn 0.6s ease-out 0.15s both' }}>
                <p style={{ fontSize: '14px', fontWeight: 700, color: 'rgba(255,255,255,0.7)', marginBottom: '6px' }}>
                  Canvas is ready.
                </p>
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', lineHeight: 1.7 }}>
                  Ask for an analysis, comparison,<br />scorecard, or summary —<br />it will appear here instantly.
                </p>
              </div>
              {/* Hint chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center', animation: 'canvasFadeIn 0.6s ease-out 0.3s both' }}>
                {['Scorecard', 'Summary', 'Compare', 'Action plan'].map(hint => (
                  <span key={hint} style={{
                    fontSize: '10px', padding: '3px 10px', borderRadius: '999px',
                    background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)',
                    color: 'rgba(167,139,250,0.6)', fontWeight: 500,
                  }}>
                    {hint}
                  </span>
                ))}
              </div>
            </div>
          ) : active ? (
            <div
              className="p-4 space-y-3"
              style={{
                animation: 'canvasFadeIn 0.25s ease-out',
              }}
            >
              <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,0.85)', lineHeight: 1.3 }}>
                {active.title}
              </h3>
              <div style={{ height: '1px', background: `linear-gradient(to right, ${activeColor}40, transparent)` }} />
              <ArtifactRenderer artifact={active} />
            </div>
          ) : null}
        </div>
      </div>

      {/* Drag handle — right edge */}
      <div
        onMouseDown={onMouseDown}
        style={{
          width: '5px',
          flexShrink: 0,
          cursor: 'col-resize',
          background: 'transparent',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      />

      {/* Keyframes */}
      <style>{`
        @keyframes canvasPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }
        @keyframes canvasShimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes canvasRing {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        @keyframes canvasFadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function CanvasIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg style={style} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <rect x="3" y="3" width="18" height="18" rx="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9h18M9 21V9" />
    </svg>
  );
}
