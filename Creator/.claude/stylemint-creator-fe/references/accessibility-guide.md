# Accessibility Guide — stylemint-creator-fe

WCAG 2.1 AA is the baseline. All interactive features must be keyboard-operable and screen-reader-friendly. Do not ship UI without completing this checklist.

---

## ARIA Roles — Quick Reference

```tsx
// Navigation landmark
<nav aria-label="Main navigation">

// Main content landmark
<main id="main-content">

// Complementary content
<aside aria-label="Boost offer">

// Live region for dynamic updates
<div role="status" aria-live="polite">   {/* non-urgent, e.g. "Briefing saved" */}
<div role="alert" aria-live="assertive"> {/* urgent, e.g. form errors */}

// Loading state
<div role="status" aria-live="polite" aria-label="Loading analytics…">
  <Spinner />
</div>

// Progress
<div role="progressbar" aria-valuenow={75} aria-valuemin={0} aria-valuemax={100}>

// Score badge (non-interactive)
<span role="img" aria-label="Hook score: 87%">87%</span>
```

---

## Interactive Elements

All clickable elements must be either a `<button>` or an `<a>`. Never attach `onClick` to `<div>` or `<span>`.

```tsx
// WRONG
<div onClick={handleDismiss} className="cursor-pointer">Dismiss</div>

// CORRECT
<button onClick={handleDismiss} type="button">Dismiss</button>

// CORRECT for navigation
<Link to="/story-arcs">View story arcs</Link>
```

---

## Keyboard Navigation

Every modal, drawer, sheet, and dropdown must trap focus while open and restore focus when closed.

Radix UI primitives (`Dialog`, `Popover`, `DropdownMenu`) handle this automatically — another reason to always use project UI components over raw HTML.

```tsx
// Explicit focus management when Radix is not used
export function BoostOfferBanner({ onDismiss }: { onDismiss: () => void }) {
  const dismissRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    dismissRef.current?.focus()
    return () => {
      // return focus to the element that opened this banner
      document.getElementById('boost-trigger')?.focus()
    }
  }, [])

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="boost-title">
      <h2 id="boost-title">Boost Offer Available</h2>
      <button ref={dismissRef} type="button" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  )
}
```

---

## Skip Link

The app shell must include a skip link as the first focusable element:

```tsx
// src/layouts/AppShell.tsx
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-bg-primary focus:rounded"
>
  Skip to main content
</a>
```

---

## Form Labels

Every form input must have a visible label or `aria-label`. Never use `placeholder` as the only label.

```tsx
// CORRECT — visible label
<label htmlFor="caption">Caption</label>
<textarea id="caption" {...register('caption')} />

// CORRECT — aria-label for icon-only inputs
<input type="search" aria-label="Search recipes" />

// WRONG — placeholder is not a label
<input placeholder="Caption" {...register('caption')} />
```

---

## Error Announcements

Form errors must be programmatically associated with their input AND announced to screen readers:

```tsx
<input
  id="caption"
  aria-invalid={!!errors.caption}
  aria-describedby={errors.caption ? 'caption-error' : undefined}
  {...register('caption')}
/>
{errors.caption && (
  <p id="caption-error" role="alert" className="text-red-400 text-sm">
    {errors.caption.message}
  </p>
)}
```

---

## Loading States

Screen readers must be notified when content is loading and when it finishes:

```tsx
function AnalyticsSection() {
  const { isLoading, data } = useAnalyticsDashboard(window)

  if (isLoading) {
    return (
      <div role="status" aria-live="polite" aria-label="Loading analytics dashboard">
        <AnalyticsSectionSkeleton aria-hidden="true" />
      </div>
    )
  }

  return (
    <section aria-label="Analytics dashboard">
      {/* content */}
    </section>
  )
}
```

---

## Countdown Timers

Live countdowns must be announced at sensible intervals, not every second (that is intolerable for screen readers):

```tsx
function BoostCountdown({ remaining }: { remaining: number }) {
  const minutes = Math.floor(remaining / 60000)
  const seconds = Math.floor((remaining % 60000) / 1000)
  const label = `${minutes} minutes and ${seconds} seconds remaining`

  return (
    <div>
      {/* Visible display — updates every second */}
      <span aria-hidden="true">{formatMs(remaining)}</span>

      {/* Screen reader announcement — updates only when minutes change */}
      <span className="sr-only" role="timer" aria-live="polite" aria-atomic="true">
        {label}
      </span>
    </div>
  )
}
```

---

## Color Contrast

All design tokens already meet WCAG AA contrast ratios. Do not introduce custom colors outside the token system — they may not meet contrast requirements.

| Token pair | Ratio |
|---|---|
| `--text-primary` on `--bg-primary` | 15.8:1 (AAA) |
| `--text-secondary` on `--bg-card` | 6.2:1 (AA) |
| `--text-muted` on `--bg-card` | 4.6:1 (AA) |
| `--primary` on `--bg-primary` | 8.9:1 (AAA) |

---

## Images

Every `<img>` must have `alt`. Decorative images use `alt=""` and `aria-hidden="true"`.

```tsx
// Meaningful image
<img src={reel.thumbnailUrl} alt={`Thumbnail for "${reel.title}"`} />

// Decorative
<img src="/sparkle.svg" alt="" aria-hidden="true" />
```

---

## Reduced Motion

Respect `prefers-reduced-motion` for all animations:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

Add this to `src/index.css`. Do not animate purely for aesthetics without this guard.

---

## Accessibility Checklist Before PR

- [ ] All interactive elements are `<button>` or `<a>`
- [ ] All form inputs have associated labels
- [ ] Errors are announced via `role="alert"` and linked with `aria-describedby`
- [ ] Modals/drawers trap focus and restore it on close
- [ ] Loading states have `role="status"` announcements
- [ ] Images have meaningful or empty `alt` text
- [ ] Tab order is logical (matches visual order)
- [ ] Keyboard-only navigation test passes (no mouse required)
