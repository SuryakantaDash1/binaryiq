import type { Config } from 'tailwindcss';

/**
 * Shared Tailwind preset. Maps the semantic CSS variables defined in
 * `@binaryiq/ui/styles/tokens.css` to Tailwind utilities so both the web app
 * and Storybook render identically. Components reference semantic tokens
 * (e.g. `bg-primary`, `text-muted`) — never raw hex. See design-system/11.
 */
const preset: Omit<Config, 'content'> = {
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        surface: {
          DEFAULT: 'var(--color-surface)',
          alt: 'var(--color-surface-alt)',
        },
        border: {
          DEFAULT: 'var(--color-border)',
          strong: 'var(--color-border-strong)',
        },
        text: {
          DEFAULT: 'var(--color-text)',
          secondary: 'var(--color-text-secondary)',
          muted: 'var(--color-text-muted)',
          inverse: 'var(--color-text-inverse)',
        },
        primary: {
          DEFAULT: 'var(--color-primary)',
          hover: 'var(--color-primary-hover)',
          active: 'var(--color-primary-active)',
          tint: 'var(--color-primary-tint)',
        },
        'on-primary': 'var(--color-on-primary)',
        // BinaryIQ brand: magenta (500) → plum (700) → violet (900). Hex so opacity modifiers work.
        brand: {
          50: '#fdf2fa',
          100: '#fbe3f3',
          200: '#f7c6e7',
          300: '#f09bd4',
          400: '#e65db8',
          500: '#d91a98',
          600: '#bf1e93',
          700: '#9a268f',
          800: '#742991',
          900: '#4a2b9d',
          950: '#2c1a63',
        },
        ink: '#110b22',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        danger: 'var(--color-danger)',
        info: 'var(--color-info)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        full: 'var(--radius-full)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      ringColor: {
        focus: 'rgba(154, 38, 143, 0.35)',
      },
    },
  },
  plugins: [],
};

export default preset;
