export interface PresetPersona {
  id: string;
  name: string;
  role: string;
  history: string;
  type: string;
  personality: string;
  focus_areas: string;
  voice: string;
  scoring_criteria: { label: string; desc: string }[] | null;
}

export const PERSONA_OPTIONS: PresetPersona[] = [
  {
    id: "investor_1",
    name: "Sarah - Tier 1 VC",
    role: "Managing Partner at Tier 1 VC",
    history: "Past emails: Expressed concerns about our ARR growth and profitability metrics.",
    type: "investor",
    personality: "Strict, no-nonsense, hates buzzwords, extremely direct.",
    focus_areas: "ARR growth rate (>3x), capital efficiency, strong product-market fit evidence.",
    voice: "Puck",
    scoring_criteria: null,
  },
  {
    id: "client_1",
    name: "David - Enterprise CTO",
    role: "Chief Technology Officer at Enterprise Corp",
    history: "Previous Call: Extremely concerned about SOC2 compliance, data privacy, and SLA guarantees.",
    type: "sales_client",
    personality: "Analytical, risk-averse, highly technical, asks detailed architectural questions.",
    focus_areas: "SOC2 compliance, data privacy, SLA guarantees, and integration complexity.",
    voice: "Aoede",
    scoring_criteria: null,
  },
];
