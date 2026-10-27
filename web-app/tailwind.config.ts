import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#13201A",
        forest: "#14523B",
        "forest-hover": "#0E3F2D",
        "forest-deep": "#003A27",
        moss: "#E4EDE6",
        paper: "#F6F7F2",
        surface: "#FFFFFF",
        "surface-muted": "#EEF2ED",
        line: "#DCE4DD",
        "line-strong": "#C5D2C8",
        muted: "#6E7B73",
        secondary: "#4C5A52",
        amber: "#B45309",
        "amber-bg": "#FEF3C7",
        brick: "#B42318",
        "brick-bg": "#FEE4E2",
        success: "#067647",
        "success-bg": "#DCFAE6",
        sidebar: "#13201A",
      },
      fontFamily: {
        sans: ['"Archivo Narrow"', "system-ui", "sans-serif"],
        display: ['"Archivo Narrow"', "system-ui", "sans-serif"],
      },
      borderRadius: {
        control: "8px",
        panel: "12px",
      },
      boxShadow: {
        overlay: "0 12px 32px rgba(19, 32, 26, 0.14)",
      },
    },
  },
  plugins: [],
};

export default config;
