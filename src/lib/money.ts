// Money is always integer cents. Never use floats for amounts.

const fmt = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

export function formatCents(cents: number): string {
  return fmt.format(cents / 100);
}

/**
 * Parse German-formatted amounts into cents.
 * Accepts: "-2000,00 €", "1.572,41 €", "-11,02", "1234", "+50,5"
 * Returns null for unparseable input.
 */
export function parseGermanAmount(raw: string): number | null {
  if (!raw) return null;
  let s = raw.replace(/[€\s\u00a0]/g, '').replace(/\u2212/g, '-'); // strip €, spaces, unicode minus
  if (!s) return null;
  const negative = s.startsWith('-');
  s = s.replace(/^[+-]/, '');
  s = s.replace(/\./g, '');       // thousands separators
  s = s.replace(',', '.');        // decimal comma → dot
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [intPart, fracPart = ''] = s.split('.');
  const cents = parseInt(intPart, 10) * 100 + parseInt((fracPart + '00').slice(0, 2), 10);
  return negative ? -cents : cents;
}

/** "02.07.2026" | "02.07.26" | "2026-07-02" → "2026-07-02" (ISO). Null if invalid. */
export function parseGermanDate(raw: string): string | null {
  const s = raw.trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return s;
  m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const year = y.length === 2 ? `20${y}` : y;
  const month = mo.padStart(2, '0');
  const day = d.padStart(2, '0');
  const mm = Number(month), dd = Number(day);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  return `${year}-${month}-${day}`;
}

/** "2026-07-02" → "02.07.2026" for display. */
export function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

/** First day of month for an ISO date: "2026-07" */
export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
}

export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function currentIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
