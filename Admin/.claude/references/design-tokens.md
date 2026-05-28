# Design Tokens — stylemint-admin-fe

Never hardcode hex values. Always use CSS variables.
Never use Tailwind color utilities for brand colors.

## CSS variables

```css
/* src/index.css */
:root {
  --primary:        #00D98A;
  --primary-dark:   #00B872;
  --primary-light:  #00FFA3;
  --accent:         #0FE88C;

  --bg-primary:     #0A1612;
  --bg-secondary:   #0F1E1A;
  --bg-card:        #132420;
  --bg-elevated:    #1A332C;

  --surface-1:      rgba(255, 255, 255, 0.02);
  --surface-2:      rgba(255, 255, 255, 0.04);
  --surface-3:      rgba(255, 255, 255, 0.07);
  --surface-border: rgba(255, 255, 255, 0.06);

  --text-primary:   #FFFFFF;
  --text-secondary: #B8E6D5;
  --text-muted:     #7A9B8E;

  --border-primary: rgba(0, 217, 138, 0.2);
  --border-subtle:  rgba(184, 230, 213, 0.1);
  --glow-primary:   rgba(0, 217, 138, 0.25);
  --shadow-soft:    0 4px 24px rgba(0, 0, 0, 0.4);
}
```

## Token usage

| Use case                          | Token                    |
|-----------------------------------|--------------------------|
| Page background                   | `var(--bg-primary)`      |
| Card background                   | `var(--bg-card)`         |
| Modal / dropdown                  | `var(--bg-elevated)`     |
| Sidebar / secondary surfaces      | `var(--bg-secondary)`    |
| Surface overlays                  | `var(--surface-1)` / `--surface-2` / `--surface-3` |
| Internal borders                  | `var(--surface-border)`  |
| Primary buttons / CTAs / active   | `var(--primary)`         |
| Button hover                      | `var(--primary-dark)`    |
| Focus rings / subtle highlights   | `var(--primary-light)` or `var(--accent)` |
| Primary text                      | `var(--text-primary)`    |
| Labels / secondary copy           | `var(--text-secondary)`  |
| Placeholder / disabled / hints    | `var(--text-muted)`      |
| Branded borders / input focus     | `var(--border-primary)`  |
| Dividers                          | `var(--border-subtle)`   |
| Glow / active badges              | `var(--glow-primary)`    |
| Card shadows                      | `var(--shadow-soft)`     |

## Tailwind config mapping

```ts
// tailwind.config.ts
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
    boxShadow: { soft: 'var(--shadow-soft)' },
  },
}
```
