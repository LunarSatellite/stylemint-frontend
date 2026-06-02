import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary:          'var(--primary)',
        'primary-dark':   'var(--primary-dark)',
        'primary-light':  'var(--primary-light)',
        accent:           'var(--accent)',
        'bg-primary':     'var(--bg-primary)',
        'bg-secondary':   'var(--bg-secondary)',
        'bg-card':        'var(--bg-card)',
        'bg-elevated':    'var(--bg-elevated)',
        'text-primary':   'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted':     'var(--text-muted)',
      },
      boxShadow: {
        soft: 'var(--shadow-soft)',
      },
    },
  },
  plugins: [],
} satisfies Config
