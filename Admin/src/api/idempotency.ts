/**
 * A key the server uses to collapse a retried write into one effect.
 *
 * It matters most on exactly the operations this console exists for: a
 * forced payout submitted twice because the first response was slow is
 * money sent twice.
 */
export const newIdempotencyKey = (): string => crypto.randomUUID();
