# Component Patterns — stylemint-creator-fe

## File Layout

One component per file. Co-locate the test next to the component.

```
src/features/reel-studio/HookScoreBadge.tsx
src/features/reel-studio/HookScoreBadge.test.tsx
```

---

## Props Interface

Always name the interface `<ComponentName>Props`. Export it when other files import it.

```tsx
export interface HookScoreBadgeProps {
  score: number          // raw [0,1] from API
  label: string
  className?: string
}

export function HookScoreBadge({ score, label, className }: HookScoreBadgeProps) {
  return (
    <div className={cn('rounded-full px-3 py-1', className)}>
      <span>{label}</span>
      <span>{formatPercent(score)}</span>
    </div>
  )
}
```

Never use `React.FC` — it adds an implicit `children` prop and obscures the return type.

---

## Children Typing

```tsx
// Most cases — accepts anything React can render
interface CardProps { children: React.ReactNode }

// Requires a single React element (for cloneElement patterns)
interface WrapperProps { children: React.ReactElement }

// Render prop — gives full type safety on the item
interface ListProps<T> {
  items: T[]
  renderItem: (item: T, index: number) => React.ReactNode
}
```

---

## Generic Components

```tsx
interface SelectProps<T> {
  options: T[]
  value: T | null
  onChange: (value: T) => void
  getLabel: (option: T) => string
  getKey:   (option: T) => string
}

export function Select<T>({ options, value, onChange, getLabel, getKey }: SelectProps<T>) {
  return (
    <ul role="listbox">
      {options.map((opt) => (
        <li
          key={getKey(opt)}
          role="option"
          aria-selected={opt === value}
          onClick={() => onChange(opt)}
        >
          {getLabel(opt)}
        </li>
      ))}
    </ul>
  )
}
```

---

## Forward Refs

```tsx
export interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

export const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(
  ({ label, error, className, ...props }, ref) => (
    <div className="flex flex-col gap-1">
      <label className="text-text-secondary text-sm">{label}</label>
      <input
        ref={ref}
        className={cn('rounded border border-border-subtle bg-surface-1 px-3 py-2', className)}
        aria-invalid={!!error}
        aria-describedby={error ? `${props.id}-error` : undefined}
        {...props}
      />
      {error && (
        <p id={`${props.id}-error`} role="alert" className="text-red-400 text-sm">
          {error}
        </p>
      )}
    </div>
  )
)
TextInput.displayName = 'TextInput'
```

---

## Compound Components

For components with tightly related sub-parts (Card, Dialog, Sheet, Tabs):

```tsx
interface CardContextValue { elevated: boolean }
const CardContext = React.createContext<CardContextValue | null>(null)

function useCardContext(component: string) {
  const ctx = React.useContext(CardContext)
  if (!ctx) throw new Error(`<${component}> must be used inside <Card>`)
  return ctx
}

export function Card({ elevated = false, children, className }: CardProps) {
  return (
    <CardContext.Provider value={{ elevated }}>
      <div className={cn('rounded-xl bg-bg-card', elevated && 'shadow-soft', className)}>
        {children}
      </div>
    </CardContext.Provider>
  )
}

Card.Header = function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  const { elevated } = useCardContext('Card.Header')
  return (
    <div className={cn('px-4 pt-4', elevated && 'border-b border-surface-border pb-4', className)}>
      {children}
    </div>
  )
}
Card.Header.displayName = 'Card.Header'

Card.Body = function CardBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('p-4', className)}>{children}</div>
}
Card.Body.displayName = 'Card.Body'
```

---

## Event Handler Typing

```tsx
// DOM events — always type explicitly
const handleClick  = (e: React.MouseEvent<HTMLButtonElement>) => { ... }
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => { ... }
const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); ... }
const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => { ... }

// Custom callbacks — prefix with "on", put in props interface
interface ButtonProps {
  onPress: (id: string) => void
  onLongPress?: () => void
}
```

---

## Loading + Error States

Every component that fetches async data must handle all three states explicitly:

```tsx
export function StoryArcDetail({ id }: { id: string }) {
  const { data, isLoading, isError, refetch } = useStoryArcDetail(id)

  if (isLoading) return <StoryArcDetailSkeleton />
  if (isError)   return <FeatureError message="Failed to load story arc" onRetry={refetch} />

  return <StoryArcDetailView arc={data} />
}
```

Wrap every feature section in an `<ErrorBoundary>`. A crashing chart must not crash the page.

---

## cn Utility

Always compose Tailwind classes with `cn` (clsx + tailwind-merge). Never concatenate strings.

```tsx
import { cn } from '@/lib/utils'

// CORRECT
<div className={cn('base px-4', isActive && 'bg-primary text-bg-primary', className)} />

// WRONG
<div className={`base px-4 ${isActive ? 'bg-primary text-bg-primary' : ''} ${className}`} />
```

---

## UI Primitives

Never import Radix UI directly into feature components. Always use the project's wrapped versions.

```tsx
// WRONG
import * as Dialog from '@radix-ui/react-dialog'

// CORRECT
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
```

---

## Component Splitting Rules

Split a component when:
- It exceeds ~120 lines of JSX
- A chunk of JSX is independently testable
- The same JSX block appears in more than one place
- A piece has its own distinct loading/error state

Do **not** split just to reduce line count. Premature splits create indirection without value.

---

## Key Prop

Never use array index as key. Use a stable, unique ID from data.

```tsx
// WRONG — breaks state on reorder
items.map((item, i) => <RecipeCard key={i} recipe={item} />)

// CORRECT
items.map((item) => <RecipeCard key={item.id} recipe={item} />)
```

---

## Avoid Prop Drilling Beyond 2 Levels

If a value needs to pass through more than 2 component layers, lift it to Zustand or React context. Do not thread props through components that don't use them.

---

## Discriminated Union for Async State

When multiple related states are displayed (empty, loading, populated, error), use a discriminated union to make illegal states unrepresentable:

```tsx
type DashboardState =
  | { status: 'loading' }
  | { status: 'error'; error: Error }
  | { status: 'empty' }
  | { status: 'ready'; data: AnalyticsDashboard }

function useDashboardState(): DashboardState {
  const { data, isLoading, isError, error } = useAnalyticsDashboard(window)
  if (isLoading)        return { status: 'loading' }
  if (isError)          return { status: 'error', error }
  if (!data?.hasData)   return { status: 'empty' }
  return { status: 'ready', data }
}
```
