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
          // Light brown / tan — primary surface accent
          light: "#C8A165",
          // Dark brown / espresso — text and primary surfaces
          dark: "#3E2723",
          // Cream — soft background tone
          cream: "#F5E6D3",
          // Optional supporting tones (still in-family browns)
          mid: "#8D6E63",
          accent: "#A1887F",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        display: ["Georgia", "Cambria", "Times New Roman", "serif"],
      },
      backgroundImage: {
        "ankara-pattern": "url('/patterns/ankara.svg')",
      },
    },
  },
  plugins: [],
};

export default config;
