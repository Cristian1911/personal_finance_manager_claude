import type { Preview } from "@storybook/react";
import { useEffect } from "react";
import "../src/app/globals.css";

function ThemeDecorator(Story: React.ComponentType) {
  useEffect(() => {
    // Apply dark class to html element so Tailwind dark: variants work
    document.documentElement.classList.add("dark");
    // Set background color to match Zeta's ink surface
    document.body.style.backgroundColor = "#121412";
    document.body.style.color = "#F6F0E3";
  }, []);

  return (
    <div style={{ fontFamily: "var(--font-geist-sans, system-ui)" }}>
      <Story />
    </div>
  );
}

const preview: Preview = {
  parameters: {
    backgrounds: { disable: true },
    layout: "centered",
  },
  decorators: [ThemeDecorator],
};

export default preview;
