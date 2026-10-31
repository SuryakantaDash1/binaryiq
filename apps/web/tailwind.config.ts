import type { Config } from 'tailwindcss';
import preset from '@binaryiq/config/tailwind-preset';

const config: Config = {
  presets: [preset],
  content: [
    './app/**/*.{ts,tsx}',
    './features/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      // Auth showcase + entrance motion. Always used behind `motion-safe:`.
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'toast-in': {
          '0%': { opacity: '0', transform: 'translateY(16px) scale(0.96)' },
          '12%, 88%': { opacity: '1', transform: 'translateY(0) scale(1)' },
          '100%': { opacity: '0', transform: 'translateY(-8px) scale(0.98)' },
        },
        // Grows a bar from its left edge to its own (inline) width.
        'bar-grow': {
          from: { transform: 'scaleX(0)' },
          to: { transform: 'scaleX(1)' },
        },
        // Chat assistant: panel/teaser pop-in and the waving hand.
        'pop-in': {
          from: { opacity: '0', transform: 'translateY(8px) scale(0.96)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        wave: {
          '0%, 60%, 100%': { transform: 'rotate(0deg)' },
          '10%, 30%': { transform: 'rotate(14deg)' },
          '20%': { transform: 'rotate(-8deg)' },
          '40%': { transform: 'rotate(-4deg)' },
          '50%': { transform: 'rotate(10deg)' },
        },
      },
      animation: {
        'pop-in': 'pop-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) both',
        wave: 'wave 2.2s ease-in-out infinite',
        'fade-up': 'fade-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) both',
        float: 'float 6s ease-in-out infinite',
        'toast-in': 'toast-in 6s ease-in-out infinite',
        'bar-grow': 'bar-grow 1.1s cubic-bezier(0.16, 1, 0.3, 1) both',
      },
    },
  },
};

export default config;
