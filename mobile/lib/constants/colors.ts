/**
 * Static color values for RN props that can't use NativeWind classes
 * (e.g. icon color, SVG stroke, shadowColor, RefreshControl tintColor).
 * Values must stay in sync with tailwind.config.js.
 */
export const COLORS = {
  brass: "#937844",
  ink: "#121412",
  sageDark: "#938C7E",
  sageLight: "#D9CCB9",
  foreground: "#F6F0E3",
  income: "#5CB88A",
  expense: "#E8875A",
  debt: "#E05545",
  alert: "#D4A843",
  oliveDeep: "#3F4632",
  ringTrack: "#2a2d28",
} as const;
