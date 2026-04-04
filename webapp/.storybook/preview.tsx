import type { Preview } from "@storybook/react";
import "../src/app/globals.css";

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: "zeta-dark",
      values: [
        { name: "zeta-dark", value: "#121412" },
        { name: "zeta-surface", value: "#171A17" },
      ],
    },
    layout: "centered",
  },
  decorators: [
    (Story) => (
      <div className="dark" style={{ fontFamily: "var(--font-geist-sans, system-ui)" }}>
        <Story />
      </div>
    ),
  ],
};

export default preview;
