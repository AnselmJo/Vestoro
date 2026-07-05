import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/db/schema';
import { bulkCategorizeByCounterparty } from '../src/db/repo';

beforeEach(async () => {
  await db.delete();
  // re-open
  await db.open();
});

describe('bulkCategorizeByCounterparty', () => {
  it('updates matching transactions and optionally creates a rule', async () => {
    const catId = await db.categories.add({ id: 'c1', name: 'Food', kind: 'expense' });
    // create some transactions
    await db.transactions.bulkAdd([
      { id: 't1', accountId: 'a1', bookingDate: '2023-07-01', counterparty: 'Alice', purpose: 'Lunch', amountCents: -1200, currency: 'EUR', importHash: '', source: 'demo' },
      { id: 't2', accountId: 'a1', bookingDate: '2023-07-02', counterparty: 'alice ', purpose: 'Coffee', amountCents: -300, currency: 'EUR', importHash: '', source: 'demo' },
      { id: 't3', accountId: 'a1', bookingDate: '2023-07-03', counterparty: 'Bob', purpose: 'Taxi', amountCents: -500, currency: 'EUR', importHash: '', source: 'demo' }
    ]);

    const res = await bulkCategorizeByCounterparty(' Alice', String(catId), { createRule: true });
    expect(res.updated).toBe(2);
    expect(res.ruleId).toBeDefined();

    const t1 = await db.transactions.get('t1');
    const t2 = await db.transactions.get('t2');
    const t3 = await db.transactions.get('t3');
    expect(t1?.categoryId).toBe(String(catId));
    expect(t2?.categoryId).toBe(String(catId));
    expect(t3?.categoryId).toBeUndefined();

    if (!res.ruleId) throw new Error('expected ruleId');
    const rule = await db.rules.get(String(res.ruleId));
    expect(rule).toBeDefined();
    expect(rule?.value).toBe('Alice');
  });
});