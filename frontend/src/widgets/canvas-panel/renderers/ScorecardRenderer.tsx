interface ScoreItem {
  label: string;
  score: number;
  feedback?: string;
}

interface Props { content: string; }

function scoreColor(score: number): string {
  if (score >= 8) return 'bg-emerald-500';
  if (score >= 6) return 'bg-blue-500';
  if (score >= 4) return 'bg-amber-500';
  return 'bg-red-500';
}

function scoreTextColor(score: number): string {
  if (score >= 8) return 'text-emerald-400';
  if (score >= 6) return 'text-blue-400';
  if (score >= 4) return 'text-amber-400';
  return 'text-red-400';
}

export function ScorecardRenderer({ content }: Props) {
  let items: ScoreItem[] = [];
  try {
    items = JSON.parse(content);
  } catch {
    return <p className="text-xs text-text-muted italic">Could not render scorecard.</p>;
  }

  const overall = items.reduce((sum, item) => sum + item.score, 0) / items.length;

  return (
    <div className="space-y-3">
      {/* Overall score */}
      <div className="flex items-center justify-between pb-3 border-b border-border-primary/30">
        <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">Overall</span>
        <span className={`text-2xl font-bold ${scoreTextColor(overall)}`}>
          {overall.toFixed(1)}<span className="text-sm font-normal text-text-muted">/10</span>
        </span>
      </div>

      {/* Individual scores */}
      {items.map((item, i) => (
        <div key={i} className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-text-primary">{item.label}</span>
            <span className={`text-sm font-bold ${scoreTextColor(item.score)}`}>{item.score}/10</span>
          </div>
          <div className="h-1.5 bg-surface-tertiary rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${scoreColor(item.score)}`}
              style={{ width: `${item.score * 10}%` }}
            />
          </div>
          {item.feedback && (
            <p className="text-xs text-text-muted leading-snug">{item.feedback}</p>
          )}
        </div>
      ))}
    </div>
  );
}
