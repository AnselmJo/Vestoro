import type { Account, Transaction } from '../db/schema';

/**
 * Detect internal transfers: pairs of transactions on two different own
 * accounts with exactly opposite amounts, booking dates ≤ 2 days apart, and
 * either a matching counterparty IBAN or the other account's name mentioned
 * in counterparty/purpose. Returns [txIdA, txIdB, transferGroupId] triples
 * for transactions that are not already grouped.
 */
export function detectTransfers(
  transactions: Transaction[],
  accounts: Account[],
): Array<[string, string, string]> {
  const ibanToAccount = new Map<string, string>();
  for (const a of accounts) if (a.iban) ibanToAccount.set(a.iban, a.id);
  const nameToAccount = accounts.map((a) => ({ id: a.id, name: a.name.toLowerCase() }));

  const open = transactions.filter((t) => !t.transferGroupId);
  const used = new Set<string>();
  const result: Array<[string, string, string]> = [];

  // Index by absolute amount for O(n) pairing instead of O(n²).
  const byAmount = new Map<number, Transaction[]>();
  for (const t of open) {
    const key = Math.abs(t.amountCents);
    if (!byAmount.has(key)) byAmount.set(key, []);
    byAmount.get(key)!.push(t);
  }

  for (const t of open) {
    if (used.has(t.id) || t.amountCents >= 0) continue; // start from the outflow side
    const candidates = byAmount.get(Math.abs(t.amountCents)) ?? [];
    for (const c of candidates) {
      if (used.has(c.id) || c.id === t.id) continue;
      if (c.amountCents !== -t.amountCents) continue;
      if (c.accountId === t.accountId) continue;
      if (daysBetween(t.bookingDate, c.bookingDate) > 2) continue;
      if (!looksLikeTransfer(t, c, ibanToAccount, nameToAccount)) continue;
      const groupId = crypto.randomUUID();
      used.add(t.id); used.add(c.id);
      result.push([t.id, c.id, groupId]);
      break;
    }
  }
  return result;
}

function daysBetween(a: string, b: string): number {
  return Math.abs((Date.parse(a) - Date.parse(b)) / 86_400_000);
}

function looksLikeTransfer(
  outflow: Transaction,
  inflow: Transaction,
  ibanToAccount: Map<string, string>,
  names: Array<{ id: string; name: string }>,
): boolean {
  // Strong signal: the counterparty IBAN of one side belongs to the other side's account.
  if (outflow.counterpartyIban && ibanToAccount.get(outflow.counterpartyIban) === inflow.accountId) return true;
  if (inflow.counterpartyIban && ibanToAccount.get(inflow.counterpartyIban) === outflow.accountId) return true;
  // Weak signal: neither side has an IBAN, but text mentions the other account's name.
  if (!outflow.counterpartyIban && !inflow.counterpartyIban) {
    const outText = (outflow.counterparty + ' ' + outflow.purpose).toLowerCase();
    const inText = (inflow.counterparty + ' ' + inflow.purpose).toLowerCase();
    const inName = names.find((n) => n.id === inflow.accountId)?.name;
    const outName = names.find((n) => n.id === outflow.accountId)?.name;
    if (inName && outText.includes(inName)) return true;
    if (outName && inText.includes(outName)) return true;
  }
  return false;
}
