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
        // Brand
        emerald: {
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          950: "#022c22",
        },
        // Status
        amber: { 400: "#fbbf24", 500: "#f59e0b" },
        rose:  { 400: "#fb7185", 500: "#f43f5e", 950: "#4c0519" },
        blue:  { 400: "#60a5fa", 500: "#3b82f6", 600: "#2563eb" },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Menlo", "monospace"],
      },
      animation: {
        shimmer: "shimmer 1.6s infinite",
        "pulse-slow": "pulse 2.5s cubic-bezier(0.4,0,0.6,1) infinite",
      },
      keyframes: {
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      boxShadow: {
        "glow-emerald": "0 0 24px rgba(16, 185, 129, 0.25)",
        "glow-blue":    "0 0 24px rgba(59, 130, 246, 0.2)",
      },
    },
  },
  plugins: [],
  // Safe-list dynamic Mapbox-injected classes so purge doesn't strip them
  safelist: [
    "mapboxgl-map",
    "mapboxgl-canvas",
    "mapboxgl-ctrl",
    "mapboxgl-marker",
  ],
};

export default config;
