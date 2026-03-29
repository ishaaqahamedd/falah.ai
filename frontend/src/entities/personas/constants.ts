export interface VoiceOption {
  id: string;
  name: string;
  desc: string;
}

export const VOICES: VoiceOption[] = [
  { id: 'Puck', name: 'Puck (Default)', desc: 'Friendly and professional' },
  { id: 'Charon', name: 'Charon', desc: 'Deep and authoritative' },
  { id: 'Kore', name: 'Kore', desc: 'Calm and steady' },
  { id: 'Fenrir', name: 'Fenrir', desc: 'Energetic and bold' },
  { id: 'Aoede', name: 'Aoede', desc: 'Warm and expressive' },
  { id: 'Leda', name: 'Leda', desc: 'Clear and articulate' },
  { id: 'Orus', name: 'Orus', desc: 'Neutral and direct' },
  { id: 'Zephyr', name: 'Zephyr', desc: 'Breezy and fast-paced' },
];

