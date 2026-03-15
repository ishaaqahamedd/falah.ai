export interface PresetPersona {
  id: string;
  name: string;
  role: string;
  history: string;
}

export const PERSONA_OPTIONS: PresetPersona[] = [
  {
    id: "investor_1",
    name: "Sarah - Tier 1 VC",
    role: "Managing Partner",
    history: "Past emails: Expressed concerns about our ARR growth and profitability metrics.",
  },
  {
    id: "client_1",
    name: "David - Enterprise CTO",
    role: "Chief Technology Officer",
    history: "Previous Call: Extremely concerned about SOC2 compliance, data privacy, and SLA guarantees.",
  },
];
