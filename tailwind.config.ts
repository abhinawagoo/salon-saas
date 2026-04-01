import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: '#FAFAF8',
        ivory: '#F4EFE8',
        gold: {
          light: '#EAD9B8',
          DEFAULT: '#C9A96E',
          dark: '#A8863E',
        },
        charcoal: {
          light: '#4A423C',
          DEFAULT: '#2C2420',
          dark: '#1A1714',
        },
        stone: '#8A7E76',
        blush: '#D4A8A0',
        primary: {
          50: '#FAFAF8',
          100: '#F4EFE8',
          200: '#EAD9B8',
          300: '#D9C090',
          400: '#C9A96E',
          500: '#B89058',
          600: '#A8863E',
          700: '#8A6B30',
          800: '#6B5228',
          900: '#4A3820',
        },
      },
      fontFamily: {
        serif: ['Cormorant Garamond', 'Georgia', 'serif'],
        sans: ['Jost', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
