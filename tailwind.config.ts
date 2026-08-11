import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          light: "#B79052",
          dark: "#201D18",
          cream: "#F3EEE3",
          mid: "#655D51",
          accent: "#9D2F2B",
          olive: "#29352A",
          paper: "#FBF8F1",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        display: ["Bodoni 72", "Didot", "Iowan Old Style", "Georgia", "serif"],
        script: ["Monotype Corsiva", "Apple Chancery", "URW Chancery L", "Brush Script MT", "cursive"],
      },
      backgroundImage: {
        "ankara-pattern": "url('/patterns/ankara.svg')",
      },
    },
  },
  plugins: [],
};

export default config;
