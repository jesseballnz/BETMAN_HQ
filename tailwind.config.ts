import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--betman-bg)",
        foreground: "var(--betman-text)",
        surface: "var(--betman-surface)",
        border: "var(--betman-border)",
        'betman-green': "var(--betman-green)",
        'betman-red': "var(--betman-red)",
        'betman-gold': "var(--betman-gold)",
        'betman-blue': "var(--betman-blue)",
      },
    },
  },
  plugins: [],
};
export default config;
