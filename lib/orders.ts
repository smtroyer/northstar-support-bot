// Single source of truth for the mock order data.
// These four cases are the ENTIRE "order database" for this simulation,
// taken verbatim from the project spec. Do not add or change statuses.

export interface OrderResult {
  found: boolean;
  /** Normalized order number that was looked up (digits only). */
  order_number: string;
  /** Human-readable status, exactly as specified, or "invalid order". */
  status: string;
  /** True only for the delivered order, so the bot knows to ask a follow-up. */
  delivered: boolean;
}

const ORDER_STATUS: Record<string, string> = {
  '111': 'Shipped, arriving tomorrow',
  '222': 'Processing, ships in 24 hours',
  '333': 'Delivered',
};

/**
 * Normalize any user/model-supplied order reference to a bare digit string.
 * Takes the FIRST run of digits (ignoring "#", spaces, and other separators)
 * and drops leading zeros, so "#111", "order 111", " 111 ", and "0111" all
 * resolve to "111". Taking the first run rather than deleting every non-digit
 * avoids concatenating distinct numbers (for example "111-222" -> "111", not
 * "111222"). Guards against null/undefined/oversized input and never throws.
 */
export function normalizeOrderNumber(raw: unknown): string {
  if (typeof raw !== 'string' && typeof raw !== 'number') return '';
  const match = String(raw).slice(0, 40).match(/\d+/);
  if (!match) return '';
  return match[0].replace(/^0+/, '') || '0';
}

/** Pure in-memory lookup. No I/O, no injection surface. */
export function lookupOrder(raw: unknown): OrderResult {
  const key = normalizeOrderNumber(raw);
  const status = ORDER_STATUS[key];
  if (!status) {
    return { found: false, order_number: key, status: 'invalid order', delivered: false };
  }
  return { found: true, order_number: key, status, delivered: key === '333' };
}
