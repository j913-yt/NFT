import { nextui } from "@nextui-org/react";

/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
    "./node_modules/@nextui-org/theme/dist/**/*.{js,ts,jsx,tsx}"
  ],
  darkMode: "class",
  theme: {
    extend: {}
  },
  plugins: [
    nextui({
      defaultTheme: "dark",
      defaultExtendTheme: "dark",
      layout: {
        radius: {
          small: "8px",
          medium: "8px",
          large: "10px"
        }
      },
      themes: {
        dark: {
          colors: {
            background: "#080808",
            foreground: "#f8f8fb",
            primary: {
              DEFAULT: "#00d5c8",
              foreground: "#071010"
            },
            secondary: {
              DEFAULT: "#ff3d9a",
              foreground: "#ffffff"
            },
            focus: "#00d5c8"
          }
        }
      }
    })
  ]
};

export default config;

