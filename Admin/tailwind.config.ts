import type { Config } from 'tailwindcss';

/**
 * Colours are CSS variables, never hex, so a token can move in one place.
 * `border-subtle` and `border-primary` are listed under both `colors` and
 * `borderColor`: Tailwind only generates `border-*` utilities from the
 * former, and several of these are only ever used as borders.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: 'var(--primary)',
        'primary-dark': 'var(--primary-dark)',
        'primary-light': 'var(--primary-light)',
        accent: 'var(--accent)',
        'bg-primary': 'var(--bg-primary)',
        'bg-secondary': 'var(--bg-secondary)',
        'bg-card': 'var(--bg-card)',
        'bg-elevated': 'var(--bg-elevated)',
        'surface-1': 'var(--surface-1)',
        'surface-2': 'var(--surface-2)',
        'surface-3': 'var(--surface-3)',
        'surface-border': 'var(--surface-border)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted': 'var(--text-muted)',
        'border-primary': 'var(--border-primary)',
        'border-subtle': 'var(--border-subtle)',
      },
      boxShadow: { soft: 'var(--shadow-soft)' },
      ringColor: { DEFAULT: 'var(--primary-light)' },
    },
  },
  plugins: [],
} satisfies Config;
