import type { Rule, Transaction } from '../db/schema';

/** First matching rule (by priority order of the input array) wins. */
export function applyRules(tx: Transaction, rules: Rule[]): string | null {
  for (const rule of rules) {
    const haystack = (tx[rule.field] ?? '').toLowerCase();
    const needle = rule.value.toLowerCase();
    const hit =
      rule.op === 'contains' ? haystack.includes(needle)
      : rule.op === 'equals' ? haystack === needle
      : haystack.startsWith(needle);
    if (hit) return rule.categoryId;
  }
  return null;
}
