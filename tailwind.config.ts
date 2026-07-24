import type { Config } from "tailwindcss";

// The OurLife design system — the same trail-map palette as the original plan artifact.
// Colors are exposed as CSS variables (see globals.css) so light/dark themes swap cleanly.
const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--bg) / <alpha-value>)",
        raised: "rgb(var(--bg-raised) / <alpha-value>)",
        sunken: "rgb(var(--bg-sunken) / <alpha-value>)",
        fg: "rgb(var(--fg) / <alpha-value>)",
        muted: "rgb(var(--fg-muted) / <alpha-value>)",
        line: "rgb(var(--border) / <alpha-value>)",
        teal: "rgb(var(--teal) / <alpha-value>)",
        clay: "rgb(var(--clay) / <alpha-value>)",
        gold: "rgb(var(--gold) / <alpha-value>)",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        card: "3px",
      },
    },
  },
  plugins: [],
};

export default config;
