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
    return <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>Could not render table.</p>;
  }

  return (
    <div style={{
      overflowX: 'auto', borderRadius: '10px',
      border: '1px solid rgba(255,255,255,0.08)',
      boxShadow: '0 2px 16px rgba(0,0,0,0.3)',
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
        <thead>
          <tr>
            {data.headers.map((h, i) => (
              <th
                key={i}
                style={{
                  padding: '8px 12px',
                  textAlign: 'left',
                  fontSize: '10px', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.1em',
                  color: 'rgba(255,255,255,0.4)',
                  background: 'linear-gradient(to bottom, rgba(255,255,255,0.07), rgba(255,255,255,0.04))',
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  position: 'sticky', top: 0,
                  backdropFilter: 'blur(8px)',
                  whiteSpace: 'nowrap',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, ri) => (
            <tr
              key={ri}
              style={{ background: ri % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
              onMouseLeave={e => (e.currentTarget.style.background = ri % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent')}
            >
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  style={{
                    padding: '7px 12px',
                    color: ci === 0 ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.45)',
                    fontWeight: ci === 0 ? 600 : 400,
                    borderBottom: ri < data.rows.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                    transition: 'background 0.12s',
                  }}
                >
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
