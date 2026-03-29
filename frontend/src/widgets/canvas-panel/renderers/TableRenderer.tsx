interface TableData {
  headers: string[];
  rows: string[][];
}

interface Props { content: string; }

export function TableRenderer({ content }: Props) {
  let data: TableData;
  try {
    data = JSON.parse(content);
  } catch {
    return <p className="text-xs text-text-muted italic">Could not render table.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border-primary/30">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface-tertiary/60">
            {data.headers.map((h, i) => (
              <th key={i} className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-text-muted border-b border-border-primary/30">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, ri) => (
            <tr key={ri} className={ri % 2 === 0 ? 'bg-surface/40' : 'bg-surface-secondary/30'}>
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-2 text-text-secondary border-b border-border-primary/20 last:border-b-0">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
