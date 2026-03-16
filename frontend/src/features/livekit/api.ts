import { apiClient } from '../../shared/api/client';

export const getLiveKitToken = async (roomName: string, personaId: string, context: string = "", sessionId: string = "") => {
  const params: Record<string, string> = { room: roomName, persona_id: personaId, context };
  if (sessionId) params.session_id = sessionId;
  const response = await apiClient.get(`/livekit/token`, { params });
  return response.data;
};
