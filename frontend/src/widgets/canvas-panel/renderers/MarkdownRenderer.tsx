import React from 'react';

interface Props { content: string; }

export function MarkdownRenderer({ content }: Props) {
  const lines = content.split('\n');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', lineHeight: 1.65 }}>
      {lines.map((line, i) => {
        if (line.startsWith('# ')) {
          return (
            <h1 key={i} style={{
              fontSize: '15px', fontWeight: 700, color: 'rgba(255,255,255,0.88)',
              marginTop: i > 0 ? '12px' : 0, paddingBottom: '6px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
            }}>
              {line.slice(2)}
            </h1>
          );
        }
        if (line.startsWith('## ')) {
          return (
            <h2 key={i} style={{
              fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,0.75)',
              marginTop: i > 0 ? '10px' : 0,
              paddingLeft: '8px',
              borderLeft: '2px solid rgba(124,58,237,0.55)',
            }}>
              {line.slice(3)}
            </h2>
          );
        }
        if (line.startsWith('### ')) {
          return (
            <h3 key={i} style={{
              fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.12em', color: 'rgba(255,255,255,0.35)',
              marginTop: i > 0 ? '8px' : 0,
            }}>
              {line.slice(4)}
            </h3>
          );
        }
        if (line.startsWith('> ')) {
          return (
            <div key={i} style={{
              padding: '6px 10px', margin: '2px 0',
              background: 'rgba(255,255,255,0.03)',
              borderLeft: '2px solid rgba(124,58,237,0.4)',
              borderRadius: '0 6px 6px 0',
              fontStyle: 'italic', color: 'rgba(255,255,255,0.4)', fontSize: '12px',
            }}>
              {renderInline(line.slice(2))}
            </div>
          );
        }
        if (line.startsWith('---') && line.trim() === '---') {
          return <div key={i} style={{ height: '1px', background: 'rgba(255,255,255,0.07)', margin: '6px 0' }} />;
        }
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <div key={i} style={{ display: 'flex', gap: '8px', paddingLeft: '4px', alignItems: 'flex-start' }}>
              <span style={{
                width: '5px', height: '5px', borderRadius: '50%', flexShrink: 0,
                marginTop: '7px', background: 'rgba(124,58,237,0.5)',
              }} />
              <span style={{ color: 'rgba(255,255,255,0.6)' }}>{renderInline(line.slice(2))}</span>
            </div>
          );
        }
        if (/^\d+\.\s/.test(line)) {
          const [num, ...rest] = line.split(/\.\s(.+)/);
          return (
            <div key={i} style={{ display: 'flex', gap: '8px', paddingLeft: '4px' }}>
              <span style={{ color: 'rgba(255,255,255,0.3)', width: '14px', textAlign: 'right', flexShrink: 0, fontSize: '11px', paddingTop: '1px' }}>
                {num}.
              </span>
              <span style={{ color: 'rgba(255,255,255,0.6)' }}>{renderInline(rest[0] || '')}</span>
            </div>
          );
        }
        if (line.trim() === '') return <div key={i} style={{ height: '4px' }} />;
        return <p key={i} style={{ color: 'rgba(255,255,255,0.6)' }}>{renderInline(line)}</p>;
      })}
    </div>
  );
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i} style={{ fontStyle: 'italic' }}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} style={{
          background: 'rgba(255,255,255,0.08)', padding: '1px 6px',
          borderRadius: '4px', fontSize: '11px', fontFamily: 'monospace',
          color: '#a78bfa',
        }}>
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}
