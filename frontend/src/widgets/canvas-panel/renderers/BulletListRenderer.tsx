interface Props { content: string; }

export function BulletListRenderer({ content }: Props) {
  let items: string[] = [];
  try {
    items = JSON.parse(content);
  } catch {
    return <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>Could not render list.</p>;
  }

  return (
    <ol style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {items.map((item, i) => (
        <li
          key={i}
          style={{
            display: 'flex', gap: '10px', alignItems: 'flex-start',
            animation: `canvasFadeIn 0.3s ease-out ${i * 0.06}s both`,
          }}
        >
          {/* Gradient numbered badge */}
          <span style={{
            flexShrink: 0,
            width: '20px', height: '20px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #0891b2, #2563eb)',
            boxShadow: '0 2px 6px rgba(8,145,178,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '9px', fontWeight: 800, color: '#fff',
            marginTop: '1px',
          }}>
            {i + 1}
          </span>
          {/* Left accent + text */}
          <div style={{
            flex: 1, paddingLeft: '8px',
            borderLeft: '2px solid rgba(8,145,178,0.2)',
          }}>
            <span style={{
              fontSize: '12px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.55,
            }}>
              {item}
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}
