import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        neem: {
          50: '#EEF5F1',
          100: '#D5E7DD',
          200: '#A9CFBB',
          500: '#2F7A5E',
          600: '#22644C',
          700: '#1A4F3C',
          800: '#123B2D',
        },
        turmeric: {
          100: '#FBEFD3',
          300: '#F0C766',
          500: '#E0A22A',
          600: '#C2861A',
        },
        paper: '#F6F7F4',
        ink: '#1C2621',
        muted: '#5C6B63',
        line: '#DDE3DE',
        risk: {
          high: '#B83227',
          highbg: '#FBE9E7',
          moderate: '#9A5B08',
          moderatebg: '#FDF1DE',
          low: '#2E7D4F',
          lowbg: '#E6F4EC',
        },
      },
      fontFamily: {
        sans: ['var(--font-mukta)', 'Noto Sans', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
