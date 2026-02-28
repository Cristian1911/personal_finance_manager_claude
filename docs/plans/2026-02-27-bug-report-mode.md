# Bug Report Mode Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a persistent FAB that enters "bug mode" — letting the user navigate the app, capture the current screen, fill in a title + description, submit to Supabase, and automatically create a GitHub issue via Edge Function.

**Architecture:** A `BugReportProvider` context wraps the app root in a `ViewShot` ref and exposes `isBugMode`, `toggleBugMode()`, and `captureScreen()`. A `BugFAB` component lives outside the `<Stack>` navigator and renders a contextual button. The existing `bug-report.tsx` screen is extended to accept a `screenshotUri` query param. A new Supabase Edge Function `notify-bug-report` is triggered by a Database Webhook on INSERT to `bug_reports` and creates a GitHub issue.

**Tech Stack:** Expo ~54, React Native 0.81.5, expo-router ~6, react-native-view-shot, react-native-safe-area-context, react-native-reanimated ~4, Supabase Edge Functions (Deno), GitHub REST API

---

## Task 1: Install react-native-view-shot

**Files:**
- Modify: `mobile/package.json` (auto-updated by Expo)

**Step 1: Install the library**

```bash
cd mobile
npx expo install react-native-view-shot
```

Expected output: package added to `package.json`, no errors.

**Step 2: Verify install**

```bash
cat package.json | grep view-shot
```

Expected: `"react-native-view-shot": "..."` present.

**Step 3: Commit**

```bash
cd ..
git add mobile/package.json mobile/package-lock.json
git commit -m "chore: install react-native-view-shot for screen capture"
```

---

## Task 2: Add github_issue_url migration

**Files:**
- Create: `supabase/migrations/20260227100000_add_github_issue_url_to_bug_reports.sql`

**Step 1: Create the migration file**

```sql
-- supabase/migrations/20260227100000_add_github_issue_url_to_bug_reports.sql
ALTER TABLE bug_reports
  ADD COLUMN IF NOT EXISTS github_issue_url text;
```

**Step 2: Push the migration**

```bash
npx supabase db push
```

Expected: migration applied without errors.

**Step 3: Regenerate types**

```bash
cd webapp && npx supabase gen types --lang=typescript --project-id tgkhaxipfgskxydotdtu > src/types/database.ts
```

Expected: `database.ts` updated with `github_issue_url: string | null` on `bug_reports` row type.

**Step 4: Commit**

```bash
cd ..
git add supabase/migrations/20260227100000_add_github_issue_url_to_bug_reports.sql webapp/src/types/database.ts mobile/src/types/database.ts
git commit -m "feat: add github_issue_url column to bug_reports"
```

> Note: `mobile/src/types/database.ts` may not exist — skip it if so.

---

## Task 3: Create BugReportProvider context

**Files:**
- Create: `mobile/lib/bugReportMode.tsx`

**Step 1: Create the context file**

```tsx
// mobile/lib/bugReportMode.tsx
import { createContext, useContext, useRef, useState, ReactNode } from "react";
import ViewShot from "react-native-view-shot";

type BugReportContextValue = {
  isBugMode: boolean;
  toggleBugMode: () => void;
  captureScreen: () => Promise<string>;
  viewShotRef: React.RefObject<ViewShot>;
};

const BugReportContext = createContext<BugReportContextValue | null>(null);

export function BugReportProvider({ children }: { children: ReactNode }) {
  const [isBugMode, setIsBugMode] = useState(false);
  const viewShotRef = useRef<ViewShot>(null);

  function toggleBugMode() {
    setIsBugMode((prev) => !prev);
  }

  async function captureScreen(): Promise<string> {
    if (!viewShotRef.current) throw new Error("ViewShot ref not ready");
    const uri = await (viewShotRef.current as any).capture();
    return uri as string;
  }

  return (
    <BugReportContext.Provider value={{ isBugMode, toggleBugMode, captureScreen, viewShotRef }}>
      <ViewShot
        ref={viewShotRef}
        options={{ format: "jpg", quality: 0.85 }}
        style={{ flex: 1 }}
      >
        {children}
      </ViewShot>
    </BugReportContext.Provider>
  );
}

export function useBugReport() {
  const ctx = useContext(BugReportContext);
  if (!ctx) throw new Error("useBugReport must be used inside BugReportProvider");
  return ctx;
}
```

**Step 2: Verify TypeScript compiles**

```bash
cd mobile && npx tsc --noEmit
```

Expected: no errors related to `bugReportMode.tsx`.

**Step 3: Commit**

```bash
cd ..
git add mobile/lib/bugReportMode.tsx
git commit -m "feat: add BugReportProvider context with ViewShot ref"
```

---

## Task 4: Create BugFAB component

**Files:**
- Create: `mobile/components/BugFAB.tsx`

**Step 1: Create the component**

```tsx
// mobile/components/BugFAB.tsx
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Bug, Camera } from "lucide-react-native";
import { useBugReport } from "../lib/bugReportMode";

export function BugFAB() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isBugMode, toggleBugMode, captureScreen } = useBugReport();
  const [capturing, setCapturing] = useState(false);

  async function handleCapture() {
    setCapturing(true);
    try {
      const uri = await captureScreen();
      toggleBugMode();
      router.push(`/bug-report?screenshotUri=${encodeURIComponent(uri)}` as never);
    } catch (err) {
      Alert.alert("Error", "No se pudo capturar la pantalla.");
    } finally {
      setCapturing(false);
    }
  }

  return (
    <View
      style={[
        styles.container,
        { bottom: insets.bottom + 80, right: insets.right + 16 },
      ]}
      pointerEvents="box-none"
    >
      {isBugMode ? (
        <Pressable
          style={styles.captureButton}
          onPress={handleCapture}
          disabled={capturing}
        >
          {capturing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Camera size={18} color="#fff" />
              <Text style={styles.captureLabel}>Capturar</Text>
            </>
          )}
        </Pressable>
      ) : (
        <Pressable style={styles.idleButton} onPress={toggleBugMode}>
          <Bug size={20} color="#6B7280" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    zIndex: 9999,
    alignItems: "flex-end",
  },
  idleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  captureButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: "#DC2626",
    shadowColor: "#DC2626",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 5,
    gap: 6,
  },
  captureLabel: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
});
```

**Step 2: Verify TypeScript compiles**

```bash
cd mobile && npx tsc --noEmit
```

Expected: no errors.

**Step 3: Commit**

```bash
cd ..
git add mobile/components/BugFAB.tsx
git commit -m "feat: add BugFAB component for bug capture mode"
```

---

## Task 5: Wire BugReportProvider and BugFAB into _layout.tsx

**Files:**
- Modify: `mobile/app/_layout.tsx`

**Step 1: Add imports at the top of `_layout.tsx`**

Find the existing imports block and add:

```tsx
import { BugReportProvider } from "../lib/bugReportMode";
import { BugFAB } from "../components/BugFAB";
```

**Step 2: Wrap RootLayoutNav in BugReportProvider**

Find the current return in `RootLayout`:

```tsx
return (
  <AuthProvider>
    <RootLayoutNav />
  </AuthProvider>
);
```

Replace with:

```tsx
return (
  <AuthProvider>
    <BugReportProvider>
      <RootLayoutNav />
    </BugReportProvider>
  </AuthProvider>
);
```

**Step 3: Add BugFAB inside SafeAreaProvider, after the Stack**

Find the return in `RootLayoutNav`:

```tsx
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <Stack>
          {/* ... */}
        </Stack>
        {isLoading && (
          <View style={styles.loadingOverlay}>
```

Add `<BugFAB />` right after the closing `</Stack>` tag, before the loading overlay:

```tsx
        </Stack>
        <BugFAB />
        {isLoading && (
```

**Step 4: Verify the app compiles**

```bash
cd mobile && npx tsc --noEmit
```

Expected: no errors.

**Step 5: Smoke test in simulator**

Run the app and verify:
- The FAB appears as a small gray circle with a bug icon in the bottom-right corner.
- Tapping it changes it to a red "Capturar" pill.
- Tapping again returns it to idle (toggle behavior check — this will be fixed in next task when navigation is wired).

```bash
npx expo start --dev-client
```

**Step 6: Commit**

```bash
cd ..
git add mobile/app/_layout.tsx
git commit -m "feat: integrate BugReportProvider and BugFAB into root layout"
```

---

## Task 6: Update bug-report.tsx to accept screenshotUri param

**Files:**
- Modify: `mobile/app/bug-report.tsx`

**Step 1: Add `useLocalSearchParams` import**

Find:
```tsx
import { useRouter } from "expo-router";
```

Replace with:
```tsx
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "react-native";
```

**Step 2: Add param reading at the top of BugReportScreen**

Find:
```tsx
export default function BugReportScreen() {
  const router = useRouter();
  const { session } = useAuth();
```

Add after `useAuth`:
```tsx
  const { screenshotUri } = useLocalSearchParams<{ screenshotUri?: string }>();
  const decodedScreenshotUri = screenshotUri ? decodeURIComponent(screenshotUri) : null;
```

**Step 3: Replace the initial `attachment` state default**

Find:
```tsx
  const [attachment, setAttachment] =
    useState<DocumentPicker.DocumentPickerAsset | null>(null);
```

Replace with:
```tsx
  const [attachment, setAttachment] =
    useState<DocumentPicker.DocumentPickerAsset | null>(null);
  // screenshotUri is handled separately from picker attachments
```

**Step 4: Update `handleSubmit` to use screenshotUri if no attachment is picked**

Find the existing attachment upload block in `handleSubmit`:
```tsx
      if (attachment) {
        const validationError = validateAttachment(attachment);
```

Before that block, add logic to handle the screenshot URI:
```tsx
      // If a screenshot was captured via bug mode, treat it as the attachment
      const screenshotAsset: DocumentPicker.DocumentPickerAsset | null =
        decodedScreenshotUri
          ? {
              uri: decodedScreenshotUri,
              name: `screenshot-${Date.now()}.jpg`,
              mimeType: "image/jpeg",
              size: undefined as any,
            }
          : null;

      const effectiveAttachment = attachment ?? screenshotAsset;

      if (effectiveAttachment) {
        const validationError = validateAttachment(effectiveAttachment);
```

Then update the rest of the `if (attachment)` block to use `effectiveAttachment` instead of `attachment`. Specifically, replace every occurrence of `attachment.` inside that block with `effectiveAttachment.`:

```tsx
        if (!contentType) {
          throw new Error("No se pudo determinar el tipo de archivo adjunto.");
        }

        const safeName = (effectiveAttachment.name || "capture")
          .replace(/[^a-zA-Z0-9_.-]/g, "-")
          .slice(0, 80);
        const path = `${session.user.id}/${Date.now()}-${safeName}`;

        const fileResponse = await fetch(effectiveAttachment.uri);
        ...
        const { error: uploadError } = await supabase.storage
          .from("bug-reports")
          .upload(path, fileBytes, {
            contentType,
            upsert: false,
          });
```

> Note: The content type resolution call uses `effectiveAttachment.mimeType` and `effectiveAttachment.name`.

**Step 5: Render screenshot preview instead of picker when screenshotUri is present**

Find the attachment picker button block:
```tsx
          <Pressable
            className="mt-4 rounded-xl border border-gray-300 bg-white px-3 py-3 flex-row items-center justify-center active:bg-gray-50"
            onPress={handlePickAttachment}
            disabled={picking || submitting}
          >
```

Wrap it conditionally:
```tsx
          {decodedScreenshotUri ? (
            <View className="mt-4 rounded-xl border border-gray-200 overflow-hidden">
              <Image
                source={{ uri: decodedScreenshotUri }}
                style={{ width: "100%", aspectRatio: 9 / 16 }}
                resizeMode="cover"
              />
              <Text className="text-center text-xs text-gray-500 font-inter py-2">
                Captura adjunta automáticamente
              </Text>
            </View>
          ) : (
            <Pressable
              className="mt-4 rounded-xl border border-gray-300 bg-white px-3 py-3 flex-row items-center justify-center active:bg-gray-50"
              onPress={handlePickAttachment}
              disabled={picking || submitting}
            >
              {/* existing picker button content */}
            </Pressable>
          )}
```

Also hide the existing attachment preview block when screenshot mode is active (it won't be needed since the picker isn't shown):
```tsx
          {!decodedScreenshotUri && attachment && (
            <View className="mt-2 rounded-lg bg-sky-50 ...">
              {/* existing attachment info block */}
            </View>
          )}
```

**Step 6: Verify TypeScript**

```bash
cd mobile && npx tsc --noEmit
```

Expected: no errors.

**Step 7: Smoke test the full flow**

1. Run the app.
2. Tap the FAB bug icon → turns red.
3. Navigate to any screen (e.g. transactions tab).
4. Tap "Capturar".
5. Bug report form opens with a screenshot thumbnail already shown.
6. Fill in title + description → tap "Enviar ticket".
7. Confirm row appears in Supabase `bug_reports` table with `attachment_path` set.

**Step 8: Commit**

```bash
cd ..
git add mobile/app/bug-report.tsx
git commit -m "feat: accept screenshotUri param in bug-report screen"
```

---

## Task 7: Create Supabase Edge Function

**Files:**
- Create: `supabase/functions/notify-bug-report/index.ts`

**Step 1: Create the functions directory and file**

```bash
mkdir -p supabase/functions/notify-bug-report
```

```ts
// supabase/functions/notify-bug-report/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN")!;
const GITHUB_REPO = Deno.env.get("GITHUB_REPO")!; // e.g. "owner/repo"

Deno.serve(async (req) => {
  try {
    const { record } = await req.json();

    if (!record?.id) {
      return new Response("Missing record.id", { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Generate signed URL for attachment if present
    let screenshotMarkdown = "";
    if (record.attachment_path) {
      const { data: signedData } = await supabase.storage
        .from("bug-reports")
        .createSignedUrl(record.attachment_path, 3600);
      if (signedData?.signedUrl) {
        screenshotMarkdown = `\n\n![Screenshot](${signedData.signedUrl})`;
      }
    }

    const deviceContext = record.device_context
      ? `\n\n### Device Context\n\`\`\`json\n${JSON.stringify(record.device_context, null, 2)}\n\`\`\``
      : "";

    const body = [
      `## Bug Report`,
      ``,
      `**Description:** ${record.description ?? "_No description_"}`,
      ``,
      `**Route:** ${record.route_hint ?? "N/A"}`,
      `**Area:** ${record.selected_area_hint ?? "N/A"}`,
      `**Status:** ${record.status}`,
      `**Source:** ${record.source}`,
      deviceContext,
      screenshotMarkdown,
      ``,
      `---`,
      `*Reported via in-app capture — ID: \`${record.id}\`*`,
    ].join("\n");

    const issueRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/issues`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        title: `[Bug] ${record.title}`,
        body,
        labels: ["bug", "in-app-report"],
      }),
    });

    if (!issueRes.ok) {
      const err = await issueRes.text();
      console.error("GitHub API error:", err);
      return new Response("GitHub API error", { status: 500 });
    }

    const issue = await issueRes.json();

    // Write back the issue URL to the bug_reports row
    await supabase
      .from("bug_reports")
      .update({ github_issue_url: issue.html_url })
      .eq("id", record.id);

    return new Response(JSON.stringify({ issue_url: issue.html_url }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("notify-bug-report error:", err);
    return new Response("Internal error", { status: 500 });
  }
});
```

**Step 2: Deploy the Edge Function**

```bash
npx supabase functions deploy notify-bug-report --project-ref tgkhaxipfgskxydotdtu
```

Expected: "Function notify-bug-report deployed successfully."

**Step 3: Set the required secrets**

```bash
npx supabase secrets set GITHUB_TOKEN=<your_github_pat> GITHUB_REPO=<owner/repo> --project-ref tgkhaxipfgskxydotdtu
```

> The `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected by Supabase at runtime.

**Step 4: Commit**

```bash
git add supabase/functions/notify-bug-report/index.ts
git commit -m "feat: add notify-bug-report Edge Function for GitHub issue creation"
```

---

## Task 8: Set up Supabase Database Webhook (manual step)

This step is done in the Supabase dashboard (no CLI support for webhooks yet).

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/tgkhaxipfgskxydotdtu) → Database → Webhooks.
2. Click "Create a new hook".
3. Settings:
   - **Name:** `notify-bug-report`
   - **Table:** `public.bug_reports`
   - **Events:** `INSERT` only
   - **Type:** Supabase Edge Functions
   - **Edge Function:** `notify-bug-report`
   - **HTTP Method:** `POST`
4. Save.

**Verify:** Submit a bug report from the app. Check the Edge Function logs in the Supabase dashboard (Functions → notify-bug-report → Logs). Confirm a GitHub issue was created in your repository.

---

## Task 9: Final smoke test and cleanup

**Step 1: End-to-end test**

1. Launch app in simulator.
2. Tap the bug FAB → goes red.
3. Navigate to transactions tab.
4. Tap "Capturar" → screenshot taken, bug mode exits, form opens with thumbnail.
5. Fill title: "Test end-to-end capture", description: "Prueba del flujo completo de captura".
6. Tap "Enviar ticket".
7. Confirm Alert shows "Reporte enviado".
8. In Supabase: check `bug_reports` table — new row with `attachment_path` and `github_issue_url` populated.
9. In GitHub: confirm issue `[Bug] Test end-to-end capture` was created with screenshot and device context.

**Step 2: Edge case — capture failure**

1. If `viewShotRef.current` is null, `captureScreen()` throws → Alert shown, bug mode stays active. Verify this doesn't crash.

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete bug report capture mode with GitHub issue integration"
```

---

## Summary of files changed/created

| File | Action |
|------|--------|
| `mobile/lib/bugReportMode.tsx` | Create |
| `mobile/components/BugFAB.tsx` | Create |
| `mobile/app/_layout.tsx` | Modify |
| `mobile/app/bug-report.tsx` | Modify |
| `supabase/functions/notify-bug-report/index.ts` | Create |
| `supabase/migrations/20260227100000_add_github_issue_url_to_bug_reports.sql` | Create |
| `webapp/src/types/database.ts` | Regenerate |

## Manual steps required

- Set GitHub PAT and repo via `supabase secrets set`
- Create Database Webhook in Supabase dashboard (Task 8)
