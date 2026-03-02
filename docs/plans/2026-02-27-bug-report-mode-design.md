# Bug Report Mode — Design Doc

**Date:** 2026-02-27
**Status:** Approved

## Overview

Expand the existing in-app bug report feature from a standalone form screen into an interactive "bug mode" that lets the user navigate the app normally and capture a screenshot of any screen, then submit a report. Captured reports also create a GitHub issue via a Supabase Edge Function.

---

## Architecture

### New files

| File | Purpose |
|------|---------|
| `mobile/lib/bugReportMode.tsx` | React context + `ViewShot` ref provider |
| `mobile/components/BugFAB.tsx` | Persistent floating action button |
| `supabase/functions/notify-bug-report/index.ts` | Edge Function: insert → GitHub issue |

### Changed files

| File | Change |
|------|--------|
| `mobile/app/_layout.tsx` | Wrap in `BugReportProvider`, add `<BugFAB>` |
| `mobile/app/bug-report.tsx` | Read `screenshotUri` param, display preview, skip picker |

### New migration

`ALTER TABLE bug_reports ADD COLUMN github_issue_url text` — written back by the Edge Function after issue creation.

---

## Data Flow

1. User taps FAB bug icon → `isBugMode = true`. FAB changes to red "Capturar" pill.
2. User navigates the app as normal. The entire `<Stack>` is wrapped in a `ViewShot` ref.
3. User taps "Capturar":
   - `viewShotRef.current.capture()` returns a local `file://` URI (JPEG, 85% quality).
   - `isBugMode` resets to `false`.
   - `router.push('/bug-report?screenshotUri=<encoded_uri>')`.
4. `bug-report.tsx` reads `screenshotUri` via `useLocalSearchParams`. Displays a thumbnail. The existing `fetch → arrayBuffer → supabase.storage.upload` code runs unchanged.
5. User fills title + description → taps "Enviar ticket".
6. Row inserted into `bug_reports`. A Supabase Database Webhook fires.
7. Edge Function `notify-bug-report`:
   - Reads `attachment_path` from the webhook record.
   - Generates a 1-hour signed URL for the attachment (if present).
   - Creates a GitHub issue (`POST /repos/{owner}/{repo}/issues`) with formatted body.
   - Updates `bug_reports.github_issue_url` with the new issue URL.

---

## Component Design

### `BugReportProvider` (`mobile/lib/bugReportMode.tsx`)

```tsx
// Wraps children in ViewShot; exposes context
const BugReportContext = createContext<{
  isBugMode: boolean;
  toggleBugMode: () => void;
  captureScreen: () => Promise<string>; // returns file:// URI
}>(...)
```

- `<ViewShot ref={viewShotRef} options={{ format: 'jpg', quality: 0.85 }}>` wraps the children.
- `captureScreen()` calls `viewShotRef.current.capture()` and returns the URI.

### `BugFAB` (`mobile/components/BugFAB.tsx`)

- `position: absolute`, bottom + right with safe-area insets.
- **Idle state:** 48×48 circular button, `Bug` icon (lucide), gray (`#6B7280`).
- **Active state:** pill-shaped, red (`#DC2626`), camera icon + "Capturar" label. Subtle `useAnimatedStyle` pulse border to signal the active mode.
- On idle tap: calls `toggleBugMode()`.
- On active tap: calls `captureScreen()` → encodes URI → `router.push(...)`.

### `bug-report.tsx` changes

- `const { screenshotUri } = useLocalSearchParams<{ screenshotUri?: string }>()`.
- If `screenshotUri` is present: render `<Image source={{ uri: screenshotUri }} />` thumbnail; skip the document picker button; pass URI through the existing upload logic.
- No other changes to the form or submit handler.

---

## Edge Function (`notify-bug-report`)

**Trigger:** Supabase Database Webhook on `INSERT` to `public.bug_reports`.
**Runtime:** Deno
**Required secrets:** `GITHUB_TOKEN`, `GITHUB_REPO` (format: `owner/repo`), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

**Issue body template:**
```
## Bug Report

**Description:** {description}

**Route:** {route_hint ?? "N/A"}
**Area:** {selected_area_hint ?? "N/A"}
**Status:** OPEN

### Device Context
\`\`\`json
{device_context}
\`\`\`

{![Screenshot](signed_url) if attachment_path exists}

---
*Reported via in-app capture — ID: {id}*
```

After creating the issue, calls `supabase.from('bug_reports').update({ github_issue_url })`.

---

## Migration

```sql
ALTER TABLE bug_reports ADD COLUMN IF NOT EXISTS github_issue_url text;
```

---

## Dependencies

- `react-native-view-shot` — install via `npx expo install react-native-view-shot`
- No new backend dependencies; Edge Function uses Deno's built-in `fetch`

---

## Error Handling

- If `capture()` fails (e.g. native error), show an `Alert` and keep bug mode active.
- If Edge Function fails to create a GitHub issue, log the error but do **not** fail the bug report insert (best-effort notification).
- If `github_issue_url` update fails, same: log only.
