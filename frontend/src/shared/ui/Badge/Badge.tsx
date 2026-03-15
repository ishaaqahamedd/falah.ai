import { getScoreColor } from '../../lib/formatters';

type Actor = 'user' | 'agent' | 'system';

interface ScoreBadgeProps {
  score: number;
  actor?: Actor;
}

function ScoreBadge({ score, actor = 'user' }: ScoreBadgeProps) {
  const color = getScoreColor(score);

  const ringClass = actor === 'agent' ? 'ring-purple-400' : color.ring;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-bold ${color.text} bg-slate-900 ring-2 ${ringClass}`}
    >
      {score.toFixed(1)}
    </span>
  );
}

export { ScoreBadge };
export type { ScoreBadgeProps };
