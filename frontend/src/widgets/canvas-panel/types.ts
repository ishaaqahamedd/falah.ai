export type ArtifactType = 'markdown' | 'bullet_list' | 'table' | 'scorecard';
export type ArtifactMode = 'new' | 'replace' | 'append';

export interface CanvasArtifact {
  id: string;
  artifact_type: ArtifactType;
  mode?: ArtifactMode;
  title: string;
  content: string; // JSON string — parsed by each renderer
  ts: number;
}
