type DotColor = 'emerald' | 'amber' | 'red' | 'blue' | 'purple';

interface StatusDotProps {
  color: DotColor;
  pulse?: boolean;
}

const colorClasses: Record<DotColor, string> = {
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  purple: 'bg-purple-500',
};

function StatusDot({ color, pulse = false }: StatusDotProps) {
  const bgClass = colorClasses[color];

  if (pulse) {
    return (
      <span className="relative flex h-2 w-2">
        <span
          className={`animate-ping absolute inline-flex h-full w-full rounded-full ${bgClass} opacity-75`}
        />
        <span className={`relative inline-flex rounded-full h-2 w-2 ${bgClass}`} />
      </span>
    );
  }

  return <span className={`inline-block w-2 h-2 rounded-full ${bgClass}`} />;
}

export { StatusDot };
export type { StatusDotProps };
