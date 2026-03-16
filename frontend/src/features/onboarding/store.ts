import { create } from 'zustand';

interface OnboardingState {
  isActive: boolean;
  token: string | null;
  roomName: string | null;
  currentStep: string;
  expanded: boolean;

  startOnboarding: (token: string, room: string) => void;
  endOnboarding: () => void;
  setStep: (step: string) => void;
  setExpanded: (expanded: boolean) => void;
}

export const useOnboardingStore = create<OnboardingState>()((set) => ({
  isActive: false,
  token: null,
  roomName: null,
  currentStep: 'welcome',
  expanded: false,

  startOnboarding: (token, room) =>
    set({ isActive: true, token, roomName: room }),

  endOnboarding: () =>
    set({ isActive: false, token: null, roomName: null, expanded: false }),

  setStep: (step) => set({ currentStep: step }),

  setExpanded: (expanded) => set({ expanded }),
}));
