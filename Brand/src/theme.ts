import { createTheme, type CSSVariablesResolver, type MantineColorsTuple, rem } from '@mantine/core';

/**
 * The StyleMint web apps share Voyager CX's design language (decided 2026-10-12): the "forest"
 * palette, a warm-green neutral ramp, 12px radii and soft layered shadows. Admin and Seller Center
 * use the same values so the two products read as one family.
 */
const forest: MantineColorsTuple = [
  '#eaf7f0',
  '#cfeade',
  '#a2d7c0',
  '#6fc2a0',
  '#45ae86',
  '#28a173',
  '#159a6a',
  '#03875a',
  '#00784f',
  '#006742',
];

/** Attention only: things waiting on the seller, low stock. */
const amber: MantineColorsTuple = [
  '#fff8e1',
  '#ffeeb8',
  '#ffe28a',
  '#ffd65c',
  '#ffcc3a',
  '#ffc424',
  '#ffbe18',
  '#e3a600',
  '#c99200',
  '#ad7c00',
];

/** Errors, rejections, destructive actions. Never decorative. */
const signal: MantineColorsTuple = [
  '#ffeceb',
  '#ffd5d1',
  '#ffa9a1',
  '#ff7a6d',
  '#fb5343',
  '#f93a28',
  '#f92d1a',
  '#de1f0e',
  '#c6180a',
  '#ad0c00',
];

/** A neutral ramp carrying a trace of the brand hue, so borders and muted text settle in. */
const slate: MantineColorsTuple = [
  '#f2f7f5',
  '#dfe8e4',
  '#bccbc4',
  '#96ada3',
  '#769287',
  '#618176',
  '#55786c',
  '#43665b',
  '#385b50',
  '#284a40',
];

export const lightSurfaceHex = {
  canvas: '#f4f7f5',
  chrome: '#ffffff',
  raised: '#ffffff',
  inset: '#eef3f0',
  border: '#d5e0da',
  borderStrong: '#a9bdb3',
  textMuted: '#4b6158',
  text: '#0d1f18',
} as const;

/** Surface tokens as CSS variables (index.css defines both schemes). */
export const surfaces = {
  canvas: 'var(--sm-canvas)',
  chrome: 'var(--sm-chrome)',
  raised: 'var(--sm-raised)',
  inset: 'var(--sm-inset)',
  border: 'var(--sm-border)',
  borderStrong: 'var(--sm-border-strong)',
  textMuted: 'var(--sm-text-muted)',
  text: 'var(--sm-text)',
  hover: 'var(--sm-hover)',
  subtle: 'var(--sm-subtle)',
  activeText: 'var(--sm-active-text)',
  activeBg: 'var(--sm-active-bg)',
  warnText: 'var(--sm-warn-text)',
  dangerText: 'var(--sm-danger-text)',
  goodText: 'var(--sm-good-text)',
} as const;

/** The gradient used for accent rails (page headers, section cards, active nav item). */
export const accentRail = 'linear-gradient(180deg, #6fc2a0, #159a6a)';

const fontStack =
  '"Inter Variable", "Inter", "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif';

export const theme = createTheme({
  primaryColor: 'forest',
  // Shade 8 keeps the label on a filled button above 4.5:1.
  primaryShade: { light: 8, dark: 8 },
  colors: { forest, amber, signal, slate },
  defaultRadius: 'md',
  fontFamily: fontStack,
  fontFamilyMonospace: '"JetBrains Mono", "Cascadia Mono", "SF Mono", Consolas, monospace',
  white: '#ffffff',
  black: lightSurfaceHex.text,
  lineHeights: { md: '1.55' },
  radius: {
    xs: rem(6),
    sm: rem(8),
    md: rem(12),
    lg: rem(16),
    xl: rem(22),
  },
  headings: {
    fontFamily: fontStack,
    fontWeight: '650',
    sizes: {
      h1: { fontSize: rem(26), lineHeight: '1.2' },
      h2: { fontSize: rem(21), lineHeight: '1.28' },
      h3: { fontSize: rem(17), lineHeight: '1.34' },
      h4: { fontSize: rem(15), lineHeight: '1.4' },
    },
  },
  components: {
    Card: { defaultProps: { radius: 'lg', withBorder: true, padding: 'lg' } },
    Paper: { defaultProps: { radius: 'lg' } },
    Table: { defaultProps: { highlightOnHover: true, verticalSpacing: 'sm', horizontalSpacing: 'md' } },
    Button: { defaultProps: { radius: 'md', fw: 600 } },
    Badge: {
      defaultProps: { radius: 'sm', fw: 600 },
      styles: {
        label: { textTransform: 'none', letterSpacing: '0.01em', overflow: 'visible', textOverflow: 'clip' },
        root: { overflow: 'visible' },
      },
    },
    Tooltip: { defaultProps: { withArrow: true, openDelay: 200, radius: 'sm' } },
    Modal: { defaultProps: { radius: 'lg', centered: true, overlayProps: { blur: 3, backgroundOpacity: 0.55 } } },
    Drawer: { defaultProps: { radius: 0, overlayProps: { blur: 3, backgroundOpacity: 0.55 } } },
    Menu: { defaultProps: { radius: 'md', shadow: 'md' } },
    Input: { defaultProps: { radius: 'md' } },
    Select: { defaultProps: { radius: 'md', checkIconPosition: 'right' } },
    Title: { defaultProps: { c: 'var(--sm-text)' } },
  },
});

/** Mantine writes its own variables after our stylesheet; this is the supported override point. */
export const cssVariables: CSSVariablesResolver = () => ({
  variables: {},
  light: {
    '--mantine-color-body': lightSurfaceHex.canvas,
    '--mantine-color-text': lightSurfaceHex.text,
    '--mantine-color-dimmed': '#55695f',
    '--mantine-color-placeholder': '#6b7d74',
    '--mantine-color-amber-text': '#7a5800',
    '--mantine-color-amber-light-color': '#7a5800',
    '--mantine-color-forest-text': '#00663f',
    '--mantine-color-signal-text': '#b3261e',
    '--mantine-color-signal-light-color': '#b3261e',
  },
  dark: {
    '--mantine-color-body': '#050f0c',
    '--mantine-color-text': '#e8f2ec',
    '--mantine-color-dimmed': '#9a9a9a',
    '--mantine-color-placeholder': '#949494',
  },
});
