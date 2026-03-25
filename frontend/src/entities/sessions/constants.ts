export interface ScoreDimension {
  key: string;
  label: string;
  desc: string;
}

export const SCORE_DIMENSIONS: ScoreDimension[] = [
  { key: 'clarity', label: 'Clarity', desc: 'Clear and structured delivery' },
  { key: 'objection_handling', label: 'Objection Handling', desc: 'Addressed concerns effectively' },
  { key: 'engagement', label: 'Engagement', desc: 'Natural conversation flow' },
  { key: 'context_awareness', label: 'Context Awareness', desc: 'Referenced background info' },
  { key: 'closing_strength', label: 'Closing Strength', desc: 'Drove toward next steps' },
];
