/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // ─── Core tokens (synced with webapp/src/app/globals.css) ──────────
        "z-ink": "#121412",
        "z-brass": "#937844",
        "z-olive-deep": "#3F4632",
        "z-sage": "#768053",
        "z-sage-light": "#D9CCB9",
        "z-sage-dark": "#938C7E",
        "z-white": "#F6F0E3",
        "z-surface": {
          DEFAULT: "#171A17",
          2: "#1E221E",
          3: "#262B26",
        },
        "z-income": "#5CB88A",
        "z-expense": "#E8875A",
        "z-debt": "#E05545",
        "z-alert": "#D4A843",
        "z-excellent": "#3D9E6E",

        // ─── Semantic aliases (shadcn dark-mode, pinned static) ───────────
        background: "#121412",
        foreground: "#F6F0E3",
        "muted-foreground": "#938C7E",

        // ─── Legacy aliases (keep for backward compat during migration) ───
        primary: {
          DEFAULT: "#937844",
          dark: "#7A6338",
          light: "#B0955D",
        },
        success: "#5CB88A",
        warning: "#D4A843",
        error: "#E05545",
        info: "#E8875A",

        // ─── Pre-computed opacity variants ────────────────────────────────
        // NativeWind v3 cannot do bg-color/opacity, so we pre-compute rgba.
        // Naming: {base}-{percent}, e.g. "z-brass-12" = z-brass at 12%

        // z-brass (base #937844 = rgb(147,120,68))
        "z-brass-6": "rgba(147,120,68,0.06)",
        "z-brass-8": "rgba(147,120,68,0.08)",
        "z-brass-10": "rgba(147,120,68,0.10)",
        "z-brass-12": "rgba(147,120,68,0.12)",
        "z-brass-15": "rgba(147,120,68,0.15)",
        "z-brass-20": "rgba(147,120,68,0.20)",
        "z-brass-25": "rgba(147,120,68,0.25)",
        "z-brass-30": "rgba(147,120,68,0.30)",
        "z-brass-50": "rgba(147,120,68,0.50)",
        "z-brass-70": "rgba(147,120,68,0.70)",
        "z-brass-80": "rgba(147,120,68,0.80)",

        // z-income (base #5CB88A = rgb(92,184,138))
        "z-income-5": "rgba(92,184,138,0.05)",
        "z-income-6": "rgba(92,184,138,0.06)",
        "z-income-10": "rgba(92,184,138,0.10)",
        "z-income-12": "rgba(92,184,138,0.12)",
        "z-income-20": "rgba(92,184,138,0.20)",
        "z-income-25": "rgba(92,184,138,0.25)",
        "z-income-30": "rgba(92,184,138,0.30)",

        // z-expense (base #E8875A = rgb(232,135,90))
        "z-expense-5": "rgba(232,135,90,0.05)",
        "z-expense-10": "rgba(232,135,90,0.10)",
        "z-expense-12": "rgba(232,135,90,0.12)",
        "z-expense-20": "rgba(232,135,90,0.20)",
        "z-expense-30": "rgba(232,135,90,0.30)",

        // z-debt (base #E05545 = rgb(224,85,69))
        "z-debt-5": "rgba(224,85,69,0.05)",
        "z-debt-6": "rgba(224,85,69,0.06)",
        "z-debt-12": "rgba(224,85,69,0.12)",
        "z-debt-20": "rgba(224,85,69,0.20)",
        "z-debt-25": "rgba(224,85,69,0.25)",
        "z-debt-30": "rgba(224,85,69,0.30)",
        "z-debt-70": "rgba(224,85,69,0.70)",

        // z-alert (base #D4A843 = rgb(212,168,67))
        "z-alert-12": "rgba(212,168,67,0.12)",
        "z-alert-25": "rgba(212,168,67,0.25)",

        // z-sage (base #D9CCB9 = rgb(217,204,185) for light)
        "z-sage-10": "rgba(217,204,185,0.10)",
        "z-sage-20": "rgba(217,204,185,0.20)",
        "z-sage-30": "rgba(217,204,185,0.30)",

        // z-surface-2 (base #1E221E = rgb(30,34,30))
        "z-surface-2-55": "rgba(30,34,30,0.55)",
        "z-surface-2-60": "rgba(30,34,30,0.60)",
        "z-surface-2-80": "rgba(30,34,30,0.80)",
        "z-surface-2-95": "rgba(30,34,30,0.95)",

        // ─── Neutral theme (A/B test — no green tint) ─────────────────────
        "z-ink-neutral": "#0d0d0e",
        "z-surface-neutral": "#121214",
        "z-surface-2-neutral": "#18181b",
        "z-surface-3-neutral": "#1f1f23",

        // white overlays
        "white-3": "rgba(255,255,255,0.03)",
        "white-4": "rgba(255,255,255,0.04)",
        "white-5": "rgba(255,255,255,0.05)",
        "white-6": "rgba(255,255,255,0.06)",
        "white-8": "rgba(255,255,255,0.08)",
        "white-10": "rgba(255,255,255,0.10)",
        "white-15": "rgba(255,255,255,0.15)",
        "white-25": "rgba(255,255,255,0.25)",

        // black overlays
        "black-10": "rgba(0,0,0,0.10)",
        "black-20": "rgba(0,0,0,0.20)",
        "black-40": "rgba(0,0,0,0.40)",

        // background opacity (base #121412 = rgb(18,20,18))
        "background-90": "rgba(18,20,18,0.90)",
        "background-92": "rgba(18,20,18,0.92)",

        // muted-foreground opacity (base #938C7E = rgb(147,140,126))
        "muted-fg-50": "rgba(147,140,126,0.50)",
        "muted-fg-70": "rgba(147,140,126,0.70)",

        // foreground opacity (base #F6F0E3 = rgb(246,240,227))
        "fg-80": "rgba(246,240,227,0.80)",
        "fg-90": "rgba(246,240,227,0.90)",

        // Tailwind standard with opacity (only those used in v2 components)
        "emerald-500-20": "rgba(16,185,129,0.20)",
        "red-500-10": "rgba(239,68,68,0.10)",
        "green-500-10": "rgba(34,197,94,0.10)",
      },
      fontFamily: {
        inter: ["Inter_400Regular"],
        "inter-italic": ["Inter_400Regular_Italic"],
        "inter-medium": ["Inter_500Medium"],
        "inter-medium-italic": ["Inter_500Medium_Italic"],
        "inter-semibold": ["Inter_600SemiBold"],
        "inter-bold": ["Inter_700Bold"],
        narrator: ["Kalam_700Bold"],
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "16px",
      },
    },
  },
  plugins: [],
};
