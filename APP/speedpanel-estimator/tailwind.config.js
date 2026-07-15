/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      // Brand palette as real Tailwind tokens (mirrors the CSS custom
      // properties in src/index.css) -- most existing code still reaches
      // for these via inline style={{color: NAVY}} from styleTokens.ts,
      // but new code can use e.g. `text-brand-navy` directly.
      colors: {
        brand: {
          navy: "var(--navy)",
          blue: "var(--blue)",
          gold: "var(--gold)",
          muted: "var(--muted)",
        },
      },
    },
  },
  plugins: [],
};
