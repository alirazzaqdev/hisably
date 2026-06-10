import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--color-bg)",
        surface: "var(--color-surface)",
        foreground: "var(--color-fg)",
        border: "var(--color-border)",
        muted: {
          DEFAULT: "var(--color-muted)",
          foreground: "var(--color-muted-foreground)",
        },
        accent: {
          50: "#F0FDFA",
          100: "#CCFBF1",
          200: "#99F6E4",
          500: "#14B8A6",
          600: "var(--color-accent)",
          700: "#0F766E",
          900: "#134E4A",
        },
        success: { 50: "#ECFDF5", 500: "#10B981" },
        danger: { 50: "#FEF2F2", 500: "#EF4444" },
        warning: { 50: "#FFFBEB", 500: "#F59E0B" },
        info: { 500: "#3B82F6" },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "Inter", "system-ui", "sans-serif"],
        arabic: ["var(--font-plex-arabic)", "Noto Sans Arabic", "sans-serif"],
      },
      fontSize: {
        display: ["32px", { lineHeight: "40px", fontWeight: "600" }],
        h1: ["24px", { lineHeight: "32px", fontWeight: "600" }],
        h2: ["20px", { lineHeight: "28px", fontWeight: "600" }],
        h3: ["16px", { lineHeight: "24px", fontWeight: "600" }],
        "body-lg": ["16px", { lineHeight: "24px", fontWeight: "400" }],
        body: ["14px", { lineHeight: "20px", fontWeight: "400" }],
        "body-sm": ["13px", { lineHeight: "18px", fontWeight: "400" }],
        caption: ["12px", { lineHeight: "16px", fontWeight: "500" }],
      },
      borderRadius: {
        sm: "6px",
        md: "8px",
        lg: "12px",
        xl: "16px",
      },
      boxShadow: {
        sm: "0 1px 2px rgba(15,23,42,0.04)",
        md: "0 4px 12px rgba(15,23,42,0.08)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
