import type { Rule, Transaction } from '../db/schema';

/** Helper: does this single rule match the transaction? Respects exceptions. */
function ruleMatches(tx: Transaction, rule: Rule): boolean {
  if (rule.enabled === false) return false;
  if (Array.isArray(rule.exceptions) && rule.exceptions.includes(tx.id)) return false;
  const haystack = (tx[rule.field] ?? '').toLowerCase();
  const needle = rule.value.toLowerCase();
  return rule.op === 'contains' ? haystack.includes(needle)
    : rule.op === 'equals' ? haystack === needle
    : haystack.startsWith(needle);
}

/** First matching rule (by priority order of the input array) wins. */
export function applyRules(tx: Transaction, rules: Rule[]): string | null {
  for (const rule of rules) {
    if (ruleMatches(tx, rule)) return rule.categoryId;
  }
  return null;
}

/** Return transactions that would be captured by a rule (excludes exceptions). */
export function previewRule(rule: Rule, transactions: Transaction[]): Transaction[] {
  return transactions
    .filter((t) => ruleMatches(t, rule))
    .sort((a, b) => b.bookingDate.localeCompare(a.bookingDate));
}
