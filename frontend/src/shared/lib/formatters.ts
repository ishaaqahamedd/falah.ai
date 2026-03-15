export function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatElapsed(totalSeconds: number): string {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export type ScoreColorSet = { bar: string; text: string; ring: string };

export function getScoreColor(score: number): ScoreColorSet {
  if (score >= 7) return { bar: 'bg-emerald-500', text: 'text-emerald-400', ring: 'ring-emerald-500/30' };
  if (score >= 4) return { bar: 'bg-amber-500', text: 'text-amber-400', ring: 'ring-amber-500/30' };
  return { bar: 'bg-red-500', text: 'text-red-400', ring: 'ring-red-500/30' };
}
