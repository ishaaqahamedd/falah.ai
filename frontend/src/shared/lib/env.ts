// ---------------------------------------------------------------------------
// Environment helpers — single source of truth for runtime config
// ---------------------------------------------------------------------------

/** Window config injected by deployment (Docker / CDN), with env-var fallback. */
function getConfig(key: string): string | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).__CONFIG__?.[key] || import.meta.env[key];
}

export const LIVEKIT_URL = getConfig('VITE_LIVEKIT_URL') ?? '';
export const GOOGLE_CLIENT_ID = getConfig('VITE_GOOGLE_CLIENT_ID') ?? '';
