import { formatElapsed } from '../../lib/formatters';

interface LiveIndicatorProps {
  elapsedSeconds: number;
}

function LiveIndicator({ elapsedSeconds }: LiveIndicatorProps) {
  return (
    <div className="flex items-center space-x-3">
      <span className="relative flex h-3 w-3">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
      </span>
      <span className="text-red-500 font-bold uppercase tracking-widest text-sm">Agent Live</span>
      <span className="text-slate-400 font-mono text-sm ml-2 bg-slate-800/80 px-3 py-1 rounded-full border border-slate-700">
        {formatElapsed(elapsedSeconds)}
      </span>
    </div>
  );
}

export { LiveIndicator };
export type { LiveIndicatorProps };
