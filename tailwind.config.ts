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
          light: "#C49A63",
          dark: "#211714",
          cream: "#F2E8DA",
          mid: "#6C554B",
          accent: "#8E3F2D",
          cocoa: "#3A241C",
          sand: "#D8B892",
          paper: "#FBF5EC",
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
