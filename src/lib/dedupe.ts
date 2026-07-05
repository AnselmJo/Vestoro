// Synchronous FNV-1a hash over the identifying fields of a transaction.
// Good enough for import dedupe; crypto-strength is not required here.

export function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function importHash(
  accountId: string,
  bookingDate: string,
  amountCents: number,
  counterpartyKey: string,
  purpose: string,
): string {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  const payload = [accountId, bookingDate, String(amountCents), norm(counterpartyKey), norm(purpose)].join('|');
  // Two passes with a salt to reduce 32-bit collision odds.
  return fnv1a(payload) + fnv1a('vestoro|' + payload);
}
