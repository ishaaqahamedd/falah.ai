import { apiClient } from '../../shared/api/client';

export const getLiveKitToken = async (roomName: string, personaId: string, context: string = "") => {
  const response = await apiClient.get(`/livekit/token`, {
    params: { 
      room: roomName, 
      persona_id: personaId,
      context: context 
    }
  });
  return response.data;
};
