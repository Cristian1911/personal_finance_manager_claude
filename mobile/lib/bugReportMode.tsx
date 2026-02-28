// mobile/lib/bugReportMode.tsx
import { createContext, useContext, useRef, useState, ReactNode } from "react";
import ViewShot from "react-native-view-shot";

type BugReportContextValue = {
  isBugMode: boolean;
  toggleBugMode: () => void;
  captureScreen: () => Promise<string>;
  pendingScreenshotUri: string | null;
  setPendingScreenshotUri: (uri: string | null) => void;
};

const BugReportContext = createContext<BugReportContextValue | null>(null);

const viewShotRef = { current: null as ViewShot | null };

export function BugReportProvider({ children }: { children: ReactNode }) {
  const [isBugMode, setIsBugMode] = useState(false);
  const [pendingScreenshotUri, setPendingScreenshotUri] = useState<string | null>(null);

  function toggleBugMode() {
    setIsBugMode((prev) => !prev);
  }

  async function captureScreen(): Promise<string> {
    if (!viewShotRef.current) throw new Error("ViewShot ref not ready");
    const uri = await (viewShotRef.current as any).capture();
    return uri as string;
  }

  return (
    <BugReportContext.Provider
      value={{ isBugMode, toggleBugMode, captureScreen, pendingScreenshotUri, setPendingScreenshotUri }}
    >
      {children}
    </BugReportContext.Provider>
  );
}

export function BugReportViewShot({ children }: { children: ReactNode }) {
  return (
    <ViewShot
      ref={(ref) => { viewShotRef.current = ref; }}
      options={{ format: "jpg", quality: 0.85 }}
      style={{ flex: 1 }}
    >
      {children}
    </ViewShot>
  );
}

export function useBugReport() {
  const ctx = useContext(BugReportContext);
  if (!ctx) throw new Error("useBugReport must be used inside BugReportProvider");
  return ctx;
}
