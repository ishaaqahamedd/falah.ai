export type ArtifactType = 'markdown' | 'bullet_list' | 'table' | 'scorecard';

export interface CanvasArtifact {
  id: string;
  artifact_type: ArtifactType;
  title: string;
  content: string; // JSON string — parsed by each renderer
  ts: number;
}
