/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        "z-ink": "#1C1C1C",
        "z-sage": {
          DEFAULT: "#C5BFAE",
          light: "#D8D2C4",
          dark: "#9E9888",
        },
        "z-white": "#F5F3EF",
        "z-surface": {
          DEFAULT: "#242424",
          2: "#2E2E2E",
        },
        "z-border": "#333333",
        "z-income": "#52B788",
        "z-expense": "#F4A261",
        "z-debt": "#C44536",
        "z-alert": "#E9C46A",
        primary: {
          DEFAULT: "#C5BFAE",
          dark: "#9E9888",
          light: "#D8D2C4",
        },
        success: "#52B788",
        warning: "#E9C46A",
        error: "#C44536",
        info: "#F4A261",
      },
      fontFamily: {
        inter: ["Inter_400Regular"],
        "inter-medium": ["Inter_500Medium"],
        "inter-semibold": ["Inter_600SemiBold"],
        "inter-bold": ["Inter_700Bold"],
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
