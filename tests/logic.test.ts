import { describe, expect, it } from 'vitest';
import { importHash } from '../src/lib/dedupe';
import { detectTransfers } from '../src/lib/transfers';
import { applyRules } from '../src/lib/rules';
import { periodStats, sankeyData, categoryBars } from '../src/lib/analytics';
import type { Account, Rule, Transaction } from '../src/db/schema';

const tx = (partial: Partial<Transaction>): Transaction => ({
  id: partial.id ?? crypto.randomUUID(),
  accountId: 'a1',
  bookingDate: '2026-07-02',
  amountCents: -1000,
  currency: 'EUR',
  counterparty: 'REWE Markt GmbH',
  purpose: 'Einkauf',
  importHash: 'h',
  source: 'manual',
  ...partial,
});

describe('importHash', () => {
  it('is stable and normalizes whitespace/case', () => {
    const a = importHash('acc', '2026-07-02', -1102, 'REWE  Markt', 'Einkauf');
    const b = importHash('acc', '2026-07-02', -1102, 'rewe markt', 'einkauf');
    expect(a).toBe(b);
  });
  it('differs for different amounts', () => {
    expect(importHash('acc', '2026-07-02', -1102, 'x', 'y'))
      .not.toBe(importHash('acc', '2026-07-02', -1103, 'x', 'y'));
  });
});

describe('detectTransfers', () => {
  const accounts: Account[] = [
    { id: 'a1', personId: 'p', name: 'C24 Giro', type: 'checking', iban: 'DE01', currency: 'EUR' },
    { id: 'a2', personId: 'p', name: 'Tagesgeld', type: 'savings', iban: 'DE02', currency: 'EUR' },
  ];
  it('pairs opposite amounts across accounts via IBAN', () => {
    const txs = [
      tx({ id: 't1', accountId: 'a1', amountCents: -80000, counterpartyIban: 'DE02' }),
      tx({ id: 't2', accountId: 'a2', amountCents: 80000, counterpartyIban: 'DE01', bookingDate: '2026-07-03' }),
    ];
    const pairs = detectTransfers(txs, accounts);
    expect(pairs).toHaveLength(1);
    expect([pairs[0][0], pairs[0][1]].sort()).toEqual(['t1', 't2']);
  });
  it('ignores same-account and date-distant pairs', () => {
    const sameAccount = [
      tx({ id: 't1', accountId: 'a1', amountCents: -500 }),
      tx({ id: 't2', accountId: 'a1', amountCents: 500 }),
    ];
    expect(detectTransfers(sameAccount, accounts)).toHaveLength(0);
    const distant = [
      tx({ id: 't1', accountId: 'a1', amountCents: -500, counterpartyIban: 'DE02' }),
      tx({ id: 't2', accountId: 'a2', amountCents: 500, counterpartyIban: 'DE01', bookingDate: '2026-07-20' }),
    ];
    expect(detectTransfers(distant, accounts)).toHaveLength(0);
  });
});

describe('applyRules', () => {
  const rules: Rule[] = [
    { id: 'r1', priority: 1, field: 'counterparty', op: 'contains', value: 'rewe', categoryId: 'groceries' },
    { id: 'r2', priority: 2, field: 'purpose', op: 'startsWith', value: 'miete', categoryId: 'housing' },
  ];
  it('matches case-insensitively and respects priority', () => {
    expect(applyRules(tx({ counterparty: 'REWE Markt GmbH' }), rules)).toBe('groceries');
    expect(applyRules(tx({ counterparty: 'X', purpose: 'Miete Juli' }), rules)).toBe('housing');
    expect(applyRules(tx({ counterparty: 'X', purpose: 'Y' }), rules)).toBeNull();
  });
});

describe('analytics', () => {
  const txs: Transaction[] = [
    tx({ amountCents: 300000, categoryId: 'salary' }),
    tx({ amountCents: -100000, categoryId: 'rent' }),
    tx({ amountCents: -50000, categoryId: 'food' }),
    tx({ amountCents: -80000, transferGroupId: 'g1' }), // transfer, must be excluded
    tx({ amountCents: 80000, transferGroupId: 'g1', accountId: 'a2' }),
  ];
  it('periodStats excludes transfers and computes savings rate', () => {
    const s = periodStats(txs);
    expect(s.incomeCents).toBe(300000);
    expect(s.expenseCents).toBe(150000);
    expect(s.surplusCents).toBe(150000);
    expect(s.savingsRate).toBeCloseTo(0.5);
  });
  it('sankey links income → hub → expenses + surplus', () => {
    const cats = [
      { id: 'salary', name: 'Gehalt', kind: 'income' as const },
      { id: 'rent', name: 'Wohnen', kind: 'expense' as const },
      { id: 'food', name: 'Lebensmittel', kind: 'expense' as const },
    ];
    const s = sankeyData(txs, cats);
    expect(s.links.find((l) => l.target === 'Einkommen')?.value).toBe(3000);
    expect(s.links.find((l) => l.target === 'Überschuss')?.value).toBe(1500);
    expect(s.links.filter((l) => l.source === 'Einkommen')).toHaveLength(3); // 2 expenses + surplus
  });
  it('categoryBars sorts descending and excludes transfers', () => {
    const bars = categoryBars(txs, []);
    expect(bars[0].valueCents).toBeGreaterThanOrEqual(bars[bars.length - 1].valueCents);
    expect(bars.reduce((a, b) => a + b.valueCents, 0)).toBe(450000);
  });
});
