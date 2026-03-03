// mobile/lib/bugReportMode.tsx
import { createContext, useContext, useState, ReactNode } from "react";
import { View } from "react-native";

type BugReportContextValue = {
  isBugMode: boolean;
  toggleBugMode: () => void;
  captureScreen: () => Promise<string>;
  pendingScreenshotUri: string | null;
  setPendingScreenshotUri: (uri: string | null) => void;
  annotatedScreenshotUri: string | null;
  setAnnotatedScreenshotUri: (uri: string | null) => void;
};

const BugReportContext = createContext<BugReportContextValue | null>(null);

type ViewShotHandle = {
  capture?: () => Promise<string>;
};

let viewShotModule: typeof import("react-native-view-shot") | null | undefined;

function getViewShotModule() {
  if (viewShotModule !== undefined) {
    return viewShotModule;
  }

  try {
    viewShotModule = require("react-native-view-shot");
  } catch {
    viewShotModule = null;
  }

  return viewShotModule;
}

const viewShotRef = { current: null as ViewShotHandle | null };

export function BugReportProvider({ children }: { children: ReactNode }) {
  const [isBugMode, setIsBugMode] = useState(false);
  const [pendingScreenshotUri, setPendingScreenshotUri] = useState<string | null>(null);
  const [annotatedScreenshotUri, setAnnotatedScreenshotUri] = useState<string | null>(null);

  function toggleBugMode() {
    setIsBugMode((prev) => !prev);
  }

  async function captureScreen(): Promise<string> {
    if (!viewShotRef.current?.capture) {
      throw new Error("Screen capture is not available in this build");
    }
    const uri = await viewShotRef.current.capture();
    return uri as string;
  }

  return (
    <BugReportContext.Provider
      value={{ isBugMode, toggleBugMode, captureScreen, pendingScreenshotUri, setPendingScreenshotUri, annotatedScreenshotUri, setAnnotatedScreenshotUri }}
    >
      {children}
    </BugReportContext.Provider>
  );
}

export function BugReportViewShot({ children }: { children: ReactNode }) {
  const module = getViewShotModule();
  const ViewShot = module?.default;

  if (!ViewShot) {
    return <View style={{ flex: 1 }}>{children}</View>;
  }

  return (
    <ViewShot
      ref={(ref: ViewShotHandle | null) => {
        viewShotRef.current = ref;
      }}
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
