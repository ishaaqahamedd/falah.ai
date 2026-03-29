interface ScoreItem {
  label: string;
  score: number;
  feedback?: string;
}

interface Props { content: string; }

function scoreColor(score: number) {
  if (score >= 8) return { bar: ['#059669', '#34d399'], text: '#34d399' };
  if (score >= 6) return { bar: ['#2563eb', '#60a5fa'], text: '#60a5fa' };
  if (score >= 4) return { bar: ['#b45309', '#fbbf24'], text: '#fbbf24' };
  return { bar: ['#dc2626', '#f87171'], text: '#f87171' };
}

function RingGauge({ value, max = 10 }: { value: number; max?: number }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(value / max, 1);
  const { text } = scoreColor(value);
  return (
    <svg width="72" height="72" viewBox="0 0 72 72">
      {/* Track */}
      <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="5" />
      {/* Fill */}
      <circle
        cx="36" cy="36" r={r} fill="none"
        stroke={text} strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct)}
        transform="rotate(-90 36 36)"
        style={{ transition: 'stroke-dashoffset 1s ease, stroke 0.4s ease' }}
      />
      <text x="36" y="33" textAnchor="middle" style={{ fontSize: '15px', fontWeight: 700, fill: text, fontFamily: 'inherit' }}>
        {value.toFixed(1)}
      </text>
      <text x="36" y="46" textAnchor="middle" style={{ fontSize: '9px', fill: 'rgba(255,255,255,0.3)', fontFamily: 'inherit' }}>
        / {max}
      </text>
    </svg>
  );
}

export function ScorecardRenderer({ content }: Props) {
  let items: ScoreItem[] = [];
  try {
    items = JSON.parse(content);
  } catch {
    return <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>Could not render scorecard.</p>;
  }

  const overall = items.reduce((sum, item) => sum + item.score, 0) / items.length;

  return (
    <div className="space-y-4">
      {/* Overall */}
      <div
        className="flex items-center gap-4 p-3 rounded-xl"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <RingGauge value={overall} />
        <div>
          <p style={{ fontSize: '10px', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>OVERALL SCORE</p>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginTop: '2px' }}>
            {items.length} criteria evaluated
          </p>
        </div>
      </div>

      {/* Individual scores */}
      <div className="space-y-3">
        {items.map((item, i) => {
          const { bar, text } = scoreColor(item.score);
          return (
            <div key={i} className="space-y-1.5" style={{ animation: `canvasFadeIn 0.3s ease-out ${i * 0.07}s both` }}>
              <div className="flex items-center justify-between">
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>{item.label}</span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: text, fontVariantNumeric: 'tabular-nums' }}>
                  {item.score}/10
                </span>
              </div>
              <div style={{ height: '6px', background: 'rgba(255,255,255,0.07)', borderRadius: '999px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${item.score * 10}%`,
                    borderRadius: '999px',
                    background: `linear-gradient(to right, ${bar[0]}, ${bar[1]})`,
                    transition: `width 0.8s ease ${i * 0.07}s`,
                    boxShadow: `0 0 8px ${bar[1]}60`,
                  }}
                />
              </div>
              {item.feedback && (
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', lineHeight: 1.5, paddingLeft: '2px' }}>
                  {item.feedback}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
