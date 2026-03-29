import { CanvasArtifact } from './types';
import { MarkdownRenderer } from './renderers/MarkdownRenderer';
import { BulletListRenderer } from './renderers/BulletListRenderer';
import { TableRenderer } from './renderers/TableRenderer';
import { ScorecardRenderer } from './renderers/ScorecardRenderer';

interface Props {
  artifact: CanvasArtifact;
}

export function ArtifactRenderer({ artifact }: Props) {
  try {
    switch (artifact.artifact_type) {
      case 'markdown':    return <MarkdownRenderer content={artifact.content} />;
      case 'bullet_list': return <BulletListRenderer content={artifact.content} />;
      case 'table':       return <TableRenderer content={artifact.content} />;
      case 'scorecard':   return <ScorecardRenderer content={artifact.content} />;
      default:
        return <p className="text-xs text-text-muted italic">Unknown artifact type.</p>;
    }
  } catch {
    return <p className="text-xs text-text-muted italic">Could not render artifact.</p>;
  }
}
