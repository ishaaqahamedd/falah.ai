interface Props { content: string; }

export function BulletListRenderer({ content }: Props) {
  let items: string[] = [];
  try {
    items = JSON.parse(content);
  } catch {
    return <p className="text-xs text-text-muted italic">Could not render list.</p>;
  }

  return (
    <ol className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 items-start">
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold flex items-center justify-center mt-0.5">
            {i + 1}
          </span>
          <span className="text-sm text-text-secondary leading-snug">{item}</span>
        </li>
      ))}
    </ol>
  );
}
