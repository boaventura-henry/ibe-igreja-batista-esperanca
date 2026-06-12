import type { Config } from "tailwindcss";
import forms from "@tailwindcss/forms";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        hope: {
          50: "#f4fbf7",
          100: "#dff4e9",
          500: "#2f9e68",
          600: "#237f52",
          700: "#1e6745"
        },
        ink: {
          900: "#10201a",
          700: "#31433b",
          500: "#64756d"
        },
        gold: {
          100: "#fff3cc",
          500: "#d79b19",
          600: "#b77d10"
        }
      },
      boxShadow: {
        soft: "0 18px 50px rgba(16, 32, 26, 0.10)"
      }
    }
  },
  plugins: [forms]
};

export default config;
