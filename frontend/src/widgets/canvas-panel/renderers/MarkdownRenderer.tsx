interface Props { content: string; }

export function MarkdownRenderer({ content }: Props) {
  // Minimal regex renderer — no external libs
  const lines = content.split('\n');
  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith('### ')) return <h3 key={i} className="text-xs font-bold uppercase tracking-wide text-text-muted mt-3 first:mt-0">{line.slice(4)}</h3>;
        if (line.startsWith('## '))  return <h2 key={i} className="text-sm font-bold text-text-primary mt-3 first:mt-0">{line.slice(3)}</h2>;
        if (line.startsWith('# '))   return <h1 key={i} className="text-base font-bold text-text-primary mt-2 first:mt-0">{line.slice(2)}</h1>;
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return <div key={i} className="flex gap-2 pl-2"><span className="text-text-muted mt-0.5">•</span><span className="text-text-secondary">{renderInline(line.slice(2))}</span></div>;
        }
        if (/^\d+\.\s/.test(line)) {
          const [num, ...rest] = line.split(/\.\s(.+)/);
          return <div key={i} className="flex gap-2 pl-2"><span className="text-text-muted w-4 text-right flex-shrink-0">{num}.</span><span className="text-text-secondary">{renderInline(rest[0] || '')}</span></div>;
        }
        if (line.trim() === '') return <div key={i} className="h-1" />;
        return <p key={i} className="text-text-secondary">{renderInline(line)}</p>;
      })}
    </div>
  );
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} className="font-semibold text-text-primary">{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*'))   return <em key={i} className="italic">{part.slice(1, -1)}</em>;
    if (part.startsWith('`') && part.endsWith('`'))   return <code key={i} className="bg-surface-tertiary px-1 rounded text-xs font-mono">{part.slice(1, -1)}</code>;
    return part;
  });
}
