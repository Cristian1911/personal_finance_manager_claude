import { createContext, useContext } from "react";

type OnboardingStatusContextValue = {
  markComplete: () => void;
  markIncomplete: () => void;
};

export const OnboardingStatusContext =
  createContext<OnboardingStatusContextValue>({
    markComplete: () => {},
    markIncomplete: () => {},
  });

export function useOnboardingStatus() {
  return useContext(OnboardingStatusContext);
}
