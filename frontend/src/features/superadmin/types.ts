export interface AdminUser {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  auth_provider: string;
  created_at: string;
  session_count: number;
  agent_count: number;
}

export interface UsersListResponse {
  users: AdminUser[];
  total: number;
  page: number;
  limit: number;
}

export interface ModelSettings {
  thinking_level?: string;  // gemini-3.x: "minimal" | "low" | "medium" | "high"
  thinking_budget?: number; // gemini-2.x: int
}

export interface ModelThinkingCapability {
  type: 'level' | 'budget';
  options?: string[];       // for type "level"
  default: string | number;
}

export interface ModelCapabilities {
  thinking: ModelThinkingCapability;
  affective_dialog: boolean;
  proactivity: boolean;
}

export interface LiveModel {
  config_key: string;
  model_id: string;
  settings: ModelSettings | null;
  updated_at: string | null;
}

export interface AvailableModel {
  id: string;
  label: string;
  tier: string;
  capabilities: ModelCapabilities;
}

export interface AIModelsResponse {
  current: LiveModel;
  available: AvailableModel[];
}
