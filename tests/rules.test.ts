import { describe, expect, it } from 'vitest';
import type { Rule, Transaction } from '../src/db/schema';
import { applyRules, previewRule } from '../src/lib/rules';

const tx = (partial: Partial<Transaction>): Transaction => ({
  id: partial.id ?? crypto.randomUUID(),
  accountId: 'a1',
  bookingDate: partial.bookingDate ?? '2026-07-02',
  amountCents: partial.amountCents ?? -1000,
  currency: 'EUR',
  counterparty: partial.counterparty ?? 'REWE Markt GmbH',
  purpose: partial.purpose ?? 'Einkauf',
  importHash: 'h',
  source: 'manual',
  ...partial,
});

describe('rules matching', () => {
  it('applyRules respects priority and returns first match', () => {
    const rules: Rule[] = [
      { id: 'r1', priority: 1, field: 'counterparty', op: 'contains', value: 'rewe', categoryId: 'groceries' },
      { id: 'r2', priority: 2, field: 'purpose', op: 'startsWith', value: 'miete', categoryId: 'housing' },
    ];
    expect(applyRules(tx({ counterparty: 'REWE Markt GmbH' }), rules)).toBe('groceries');
    expect(applyRules(tx({ counterparty: 'X', purpose: 'Miete Juli' }), rules)).toBe('housing');
  });

  it('skips disabled rules and respects exceptions', () => {
    const t1 = tx({ id: 't1', counterparty: 'REWE' });
    const rules: Rule[] = [
      { id: 'r1', priority: 1, field: 'counterparty', op: 'contains', value: 'rewe', categoryId: 'g', enabled: false },
      { id: 'r2', priority: 2, field: 'counterparty', op: 'contains', value: 'rewe', categoryId: 'g2' },
    ];
    // first is disabled, second applies
    expect(applyRules(t1, rules)).toBe('g2');

    // exception prevents match
    const r3: Rule = { id: 'r3', priority: 1, field: 'counterparty', op: 'contains', value: 'rewe', categoryId: 'g', exceptions: ['t1'] };
    expect(previewRule(r3, [t1])).toHaveLength(0);
  });
});
