import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/games/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        fl: {
          bg: "#171a1e",
          p1: "#363d45",
          p2: "#2a3037",
          p3: "#21262c",
          border: "#0d1013",
          text: "#e4e9ef",
          muted: "#8f9ba8",
          orange: "#ff9b21",
          orangeLight: "#ffbd66",
          led: "#9be34a",
          field: "#12161b",
          danger: "#e5484d",
        },
      },
      fontFamily: {
        archivo: ["var(--font-archivo)", "system-ui", "-apple-system", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      boxShadow: {
        flInset: "inset 0 1px 0 rgba(255,255,255,0.13), 0 1px 1px rgba(0,0,0,0.4)",
        flLcd: "inset 0 1px 4px rgba(0,0,0,0.7)",
        flGlow: "0 0 10px rgba(255,155,33,0.35)",
        flLed: "0 0 8px #9be34a",
      },
    },
  },
  plugins: [],
};
export default config;
