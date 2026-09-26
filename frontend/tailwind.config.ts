import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        petrol: {
          900: '#0B3A3F',
          600: '#0F6E71',
        },
        saffron: {
          500: '#E08A2C',
        },
        ink: {
          900: '#12181A',
        },
        mist: {
          100: '#F3F6F5',
        },
        paper: {
          0: '#FFFFFF',
        },
        line: {
          200: '#DDE5E3',
        },
        // Public-site design tokens
        navy: {
          DEFAULT: '#071A2B',
          surface: '#0D2638',
        },
        electric: '#00C9B7', // Electric Teal
        vision: '#4DE8FF', // Vision Cyan
        honey: '#FFCA6B', // Soft Amber
        snow: '#F7FAFC', // Soft White
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-space-grotesk)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'spin-slow': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'scan-y': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.9)', opacity: '0.5' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
        'blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.2' },
        },
        'draw': {
          to: { 'stroke-dashoffset': '0' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.6s ease-out both',
        'fade-in': 'fade-in 0.6s ease-out both',
        'scale-in': 'scale-in 0.5s ease-out both',
        'spin-slow': 'spin-slow 8s linear infinite',
        'scan-y': 'scan-y 2.4s ease-in-out infinite',
        'pulse-ring': 'pulse-ring 2.4s ease-out infinite',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        'blink': 'blink 1.2s step-end infinite',
      },
    },
  },
  plugins: [],
};
export default config;
