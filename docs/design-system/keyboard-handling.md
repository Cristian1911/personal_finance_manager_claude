# Keyboard Handling Guide (React Native + mobile web)

Context for Claude when working on this project's keyboard/input UX. Goal: inputs and UI track the
keyboard smoothly, no jump/lag, no occluded fields.

## React Native — use `react-native-keyboard-controller`

This is the standard. Don't hand-roll `Keyboard.addListener` + `Animated` for layout — it runs on the
JS thread and lags. Keyboard-controller runs on the **UI thread**, frame-by-frame.

- Requires `react-native-reanimated` (peer dep). Install both.
- Wrap the app root once in `<KeyboardProvider>`.

### Pick the right primitive (don't over-reach)

| Need | Use | Notes |
|------|-----|-------|
| Scroll/pad so focused input stays visible | `<KeyboardAwareScrollView>` | Covers 90% of forms. Try this first. |
| Pin a single bar (e.g. chat input) above keyboard | `<KeyboardStickyView>` | No manual offset math. |
| Animate custom UI with keyboard height | `useKeyboardHandler` worklet | Height per-frame on UI thread. |
| Float UI *over* the keyboard (menus, pickers) | `<OverKeyboardView>` | e.g. long-press menus. |

Minimal sticky input:

```tsx
import { KeyboardStickyView } from "react-native-keyboard-controller";

<KeyboardStickyView>
  <TextInput placeholder="Mensaje" />
</KeyboardStickyView>
```

Frame-synced custom animation:

```tsx
import { useKeyboardHandler } from "react-native-keyboard-controller";
import { useSharedValue } from "react-native-reanimated";

const height = useSharedValue(0);
useKeyboardHandler({ onMove: (e) => { "worklet"; height.value = e.height; } }, []);
// drive a reanimated style off height.value
```

## iOS Simulator — testing gotchas (these waste hours)

- **Keyboard hidden by default.** Simulator uses your Mac keyboard. Toggle the software keyboard with
  **Cmd+K** (I/O > Keyboard > Toggle Software Keyboard). #1 "keyboard won't show" cause.
- **Simulator ≠ device.** Inset/animation behavior differs from real hardware. Verify on a physical
  device before calling keyboard UX done.
- **Locale quirks.** Simulator may default to extra keyboards (English+Hindi). Don't debug a "bug"
  that's just simulator locale config.
- Test across iOS 16/17/18 if supporting them — keyboard frame timing changed between versions.

## Mobile web (webapp tested in Chrome DevTools)

- **DevTools device emulation does NOT render a virtual keyboard.** You can test layout at mobile
  widths, but not real keyboard occlusion. For that, remote-debug a real phone.
- Use the **VirtualKeyboard API** when you want to own occlusion handling:

```js
if ("virtualKeyboard" in navigator) navigator.virtualKeyboard.overlaysContent = true;
```

  Then lay out with CSS env vars instead of guessing:

```css
.footer { bottom: env(keyboard-inset-height, 0px); }
```

  Listen to `navigator.virtualKeyboard` `geometrychange` for JS-side reactions.
- Chromium 94+ only. On unsupported browsers (Safari/iOS), fall back to `visualViewport` resize events.

## Rules of thumb

- RN form not staying visible? Reach for `KeyboardAwareScrollView` before any custom code.
- Don't import keyboard-controller without `reanimated` installed — it silently no-ops / crashes.
- "Works in simulator, broken on device" (or vice-versa) is expected — test both.
- Web: DevTools mobile view is for layout, real device is for keyboard.

---

## Project notes (Zeta) — validated 2026-06-29

- **Foundation is already in place.** `react-native-keyboard-controller` + `react-native-reanimated`
  are installed and `<KeyboardProvider>` wraps the app root (`mobile/app/_layout.tsx`, via
  `AppKeyboardProvider`). The project wrapper is
  `mobile/components/common/AppKeyboardAwareScrollView.tsx` — a drop-in `ScrollView` replacement
  (defaults `keyboardShouldPersistTaps="handled"`, `keyboardDismissMode="interactive"`,
  `bottomOffset=20`, `style: flex 1`). So this is a **coverage** job, not a setup job.
- **Coverage rule.** Every full-screen scroll form that contains a `TextInput` MUST use
  `AppKeyboardAwareScrollView`, never a plain `ScrollView`. Already compliant: auth screens,
  onboarding, puedo-pagar. **Bottom sheets are the exception** — a sheet needs `KeyboardStickyView`
  (or the sheet library's own avoidance), NOT `KeyboardAwareScrollView`, which fights the sheet's
  transform. The remaining coverage sweep (`capture.tsx` done; `import.tsx`, form sheets, etc.) is
  tracked in `BACKLOG.md`.
- **Web: `visualViewport` is the baseline, VirtualKeyboard API is the enhancement.** The VirtualKeyboard
  API is Chromium-94+ only; iOS Safari (a large mobile-web slice) needs `visualViewport`. Zeta's
  `webapp/src/hooks/use-keyboard-inset.tsx` correctly uses `visualViewport` as the cross-browser
  baseline. Layer `navigator.virtualKeyboard` (`overlaysContent` + `env(keyboard-inset-height)`) only
  as a progressive enhancement on Chromium — do not lead with it.
- **idb/automation gotcha (beyond Cmd+K).** When the iOS Simulator is driven via idb (MCP automation),
  idb attaches a HARDWARE keyboard, so the soft keyboard stays suppressed even after Cmd+K /
  `defaults write com.apple.iphonesimulator ConnectHardwareKeyboard false`. Visual soft-keyboard
  testing has to be a MANUAL Simulator session, not idb-driven.
