/** "NPR 1,200" — whole rupees drop the paisa, fractional amounts keep two decimals. */
export function money(amount: number | null | undefined, currency = 'NPR'): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return '—';
  const whole = Math.abs(amount - Math.round(amount)) < 0.005;
  const text = amount.toLocaleString('en-IN', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 });
  return `${currency || 'NPR'} ${text}`;
}

export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=app.stylemint.stylemint_mobile_frontend';
/** Set VITE_APP_STORE_URL at build time once the App Store listing id is known. */
export const APP_STORE_URL: string = import.meta.env.VITE_APP_STORE_URL || 'https://apps.apple.com/search?term=StyleMint';
