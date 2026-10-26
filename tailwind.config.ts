import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "var(--primary)",
          50: "#edf8f1",
          100: "#d7eee1",
          200: "#afdcc4",
          300: "#7ec4a4",
          400: "#4aa580",
          500: "#278564",
          600: "#176b50",
          700: "#13563f",
          800: "#124533",
          900: "#10392c",
        },
        ink: { DEFAULT: "var(--foreground)", soft: "#284c40" },
        muted: { DEFAULT: "var(--muted-foreground)", foreground: "#71817d" },
        line: "var(--border)",
        soft: "var(--background)",
      },
      borderRadius: {
        md: "6px",
        lg: "8px",
        xl: "8px",
        "2xl": "8px",
        "3xl": "12px",
      },
      fontSize: {
        "display-lg": [
          "3.5rem",
          { lineHeight: "1.05", letterSpacing: "-0.03em" },
        ],
        display: ["2.75rem", { lineHeight: "1.08", letterSpacing: "-0.025em" }],
        "display-sm": [
          "2rem",
          { lineHeight: "1.15", letterSpacing: "-0.02em" },
        ],
      },
      maxWidth: {
        shell: "1280px",
      },
      transitionTimingFunction: {
        premium: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
