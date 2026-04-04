import type { StorybookConfig } from "@storybook/react-vite";
import tailwindcss from "@tailwindcss/vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-essentials"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  viteFinal: async (config) => {
    // Alias @/ to src/ to match Next.js paths
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": new URL("../src", import.meta.url).pathname,
      // Mock Next.js modules for Storybook
      "next/link": new URL("./mocks/next-link.tsx", import.meta.url).pathname,
      "next/navigation": new URL("./mocks/next-navigation.ts", import.meta.url)
        .pathname,
      "next/image": new URL("./mocks/next-image.tsx", import.meta.url).pathname,
    };

    // Add Tailwind v4 Vite plugin for CSS processing
    config.plugins = config.plugins ?? [];
    config.plugins.push(tailwindcss());

    return config;
  },
};

export default config;
