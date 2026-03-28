// ---------------------------------------------------------------------------
// Core domain types shared across the frontend
// ---------------------------------------------------------------------------

export type VoiceName = 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Aoede' | 'Leda' | 'Orus' | 'Zephyr';

export interface ScoringCriterion {
  key: string;
  label: string;
  desc: string;
}

export interface Persona {
  id: string;
  user_id: string;
  type: string;
  name: string;
  role: string;
  personality: string;
  focus_areas: string;
  voice: string;
  scoring_criteria: ScoringCriterion[] | null;
  behavior_rules: string[];
  opening_message: string | null;
  is_public: boolean;
  use_count: number;
}

export interface CommunityPersona extends Persona {
  creator_name: string;
}

export interface PersonaTemplate {
  key: string;
  type: string;
  name: string;
  role: string;
  personality: string;
  focus_areas: string;
  voice: string;
  scoring_criteria: ScoringCriterion[] | null;
  behavior_rules: string[];
  opening_message: string | null;
}

export interface TranscriptTurn {
  role: 'user' | 'agent';
  text: string;
  timestamp?: number;
}

export interface ScorecardDimension {
  score: number;
  feedback: string;
}

export interface Scorecard {
  overall_score: number;
  overall_feedback: string;
  [dimensionKey: string]: unknown;
}

export interface Session {
  id: string;
  user_id: string;
  persona_id: string | null;
  persona_snapshot: Pick<Persona, 'name' | 'role' | 'type' | 'scoring_criteria'> | null;
  transcript: TranscriptTurn[];
  duration_seconds: number;
  status: 'active' | 'completed' | 'crashed';
  scorecard: Scorecard | null;
  ai_summary: string | null;
  started_at: string;
  ended_at: string | null;
}

export interface Briefing {
  briefing: string;
  cached: boolean;
}
