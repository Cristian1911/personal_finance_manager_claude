import { createContext, useContext } from "react";

type OnboardingStatusContextValue = {
  markComplete: () => void;
};

export const OnboardingStatusContext =
  createContext<OnboardingStatusContextValue>({
    markComplete: () => {},
  });

export function useOnboardingStatus() {
  return useContext(OnboardingStatusContext);
}
