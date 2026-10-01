/**
 * Zeta v2 design tokens (decision S5-1): "Oliva afinada" (default) and
 * "Nítido" (optional), each light and dark. Values are the approved
 * prototype's (docs/mlp/sessions/05-visual.html, directions A and B) and the
 * Claude Design prompt (docs/mlp/05c-claude-design-v2-prompt.md §1).
 * Components read these through useV2Theme(); never hard-code a color.
 */

export type ThemeName = "oliva" | "nitido";
export type ColorMode = "light" | "dark";
export type StateName = "ok" | "warn" | "bad";

export interface StateColors {
  /** Soft fill: Oliva's Disponible card, chips. */
  tint: string;
  /** Text on the tint (and state-colored text on cards). */
  text: string;
  /** Saturated fill: Nítido's Disponible block, dots. */
  solid: string;
  /** Text on the solid fill. */
  onSolid: string;
}

export interface V2Colors {
  bg: string;
  card: string;
  ink: string;
  muted: string;
  line: string;
  /** Borders of tappable controls (≥ 3:1 on card and bg). */
  control: string;
  sunk: string;
  button: string;
  onButton: string;
  /** Estimated amounts (Tu flujo's projected spending, light segments). */
  est: string;
  /** Behind sheets. */
  scrim: string;
  ok: StateColors;
  warn: StateColors;
  bad: StateColors;
}

export interface V2Theme {
  name: ThemeName;
  mode: ColorMode;
  colors: V2Colors;
  /** How the Disponible block shows state: Oliva tints the card, Nítido fills it solid. */
  disponibleStyle: "tint" | "solid";
  /** Card elevation (none in dark). */
  shadow: {
    shadowColor: string;
    shadowOpacity: number;
    shadowRadius: number;
    shadowOffset: { width: number; height: number };
    elevation: number;
  } | null;
  fonts: {
    ui: string;
    uiMedium: string;
    uiSemibold: string;
    uiBold: string;
    mono: string;
    /** The Disponible number only (S5-R: the only heavy number). */
    number: string;
    /** Widget values: the number face at semibold. */
    numberSemibold: string;
  };
}

const s = (tint: string, text: string, solid: string, onSolid: string): StateColors => ({ tint, text, solid, onSolid });

const GEIST = {
  ui: "Geist_400Regular",
  uiMedium: "Geist_500Medium",
  uiSemibold: "Geist_600SemiBold",
  uiBold: "Geist_700Bold",
  mono: "GeistMono_600SemiBold",
};

const COLORS: Record<ThemeName, Record<ColorMode, V2Colors>> = {
  oliva: {
    light: {
      bg: "#E9E0CC", card: "#FFFCF5", ink: "#14160F", muted: "#4B463B", line: "#E6DDC9",
      control: "#8C7F63", sunk: "#EFE7D6", button: "#14160F", onButton: "#FFFCF5", est: "#CDBF9F", scrim: "rgba(20,22,15,0.45)",
      ok: s("#CFE0A6", "#2E4A12", "#4E7A1E", "#FFFFFF"),
      warn: s("#F6D98C", "#5C3F00", "#B27800", "#FFFFFF"),
      bad: s("#F4BFA8", "#7A2410", "#C4452A", "#FFFFFF"),
    },
    dark: {
      bg: "#12130E", card: "#1F2119", ink: "#F3EFE3", muted: "#B8B09C", line: "#2E3027",
      control: "#858270", sunk: "#2A2C22", button: "#F3EFE3", onButton: "#12130E", est: "#4A4B3E", scrim: "rgba(0,0,0,0.6)",
      ok: s("#2A3A14", "#CFE39A", "#8DB84A", "#12130E"),
      warn: s("#3D2F0A", "#F2CE74", "#E0A626", "#12130E"),
      bad: s("#43190F", "#F4A58C", "#E0664A", "#12130E"),
    },
  },
  nitido: {
    light: {
      bg: "#EEF0F3", card: "#FFFFFF", ink: "#0E1116", muted: "#475061", line: "#E3E6EB",
      control: "#7A8394", sunk: "#EEF0F3", button: "#0E1116", onButton: "#FFFFFF", est: "#C9CED6", scrim: "rgba(14,17,22,0.45)",
      ok: s("#DDF3E6", "#0F5C30", "#16804A", "#FFFFFF"),
      warn: s("#FFF0C2", "#6B4A00", "#F2A900", "#1A1300"),
      bad: s("#FCE0DB", "#8E2213", "#D1382A", "#FFFFFF"),
    },
    dark: {
      bg: "#0B0D10", card: "#171B21", ink: "#F4F6F8", muted: "#A7AFBC", line: "#252A32",
      control: "#6B7383", sunk: "#20252D", button: "#F4F6F8", onButton: "#0B0D10", est: "#3A404A", scrim: "rgba(0,0,0,0.6)",
      ok: s("#123522", "#7FE0A8", "#2BB36A", "#04150B"),
      warn: s("#3A2C05", "#FFD978", "#FFC23D", "#1A1300"),
      bad: s("#3D140E", "#FFA799", "#FF6A55", "#1A0502"),
    },
  },
};

/** Soft two-layer shadow of the prototype, approximated for React Native (one layer). */
const LIGHT_SHADOW: Record<ThemeName, NonNullable<V2Theme["shadow"]>> = {
  oliva: { shadowColor: "#281E0A", shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  nitido: { shadowColor: "#0E1116", shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
};

export function getV2Theme(name: ThemeName, mode: ColorMode): V2Theme {
  return {
    name,
    mode,
    colors: COLORS[name][mode],
    disponibleStyle: name === "oliva" ? "tint" : "solid",
    shadow: mode === "light" ? LIGHT_SHADOW[name] : null,
    fonts: {
      ...GEIST,
      number: name === "oliva" ? "Geist_800ExtraBold" : "BricolageGrotesque_800ExtraBold",
      numberSemibold: name === "oliva" ? "Geist_600SemiBold" : "BricolageGrotesque_600SemiBold",
    },
  };
}

/** Verdict state (engine) → token state. */
export const VERDICT_STATE: Record<"vas_bien" | "cuidado" | "te_pasaste", StateName> = {
  vas_bien: "ok",
  cuidado: "warn",
  te_pasaste: "bad",
};
