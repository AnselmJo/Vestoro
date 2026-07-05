import { donutDataFromCategoryBars, categoryBars } from '../src/lib/analytics';
import type { Transaction, Category } from '../src/db/schema';

test('donutDataFromCategoryBars mirrors categoryBars values in euros', () => {
  const cats: Category[] = [
    { id: 'c1', name: 'Food', kind: 'expense', color: '#ff0000' },
    { id: 'c2', name: 'Salary', kind: 'income', color: '#00ff00' },
  ];
  const txs: Transaction[] = [
    { id: 't1', accountId: 'a1', amountCents: -5000, bookingDate: '2026-07-01', currency: 'EUR', counterparty: 'Shop', purpose: 'Grocery', transferGroupId: undefined, importHash: 'h1', source: 'demo', categoryId: 'c1' },
    { id: 't2', accountId: 'a1', amountCents: 250000, bookingDate: '2026-07-01', currency: 'EUR', counterparty: 'Employer', purpose: 'Pay', transferGroupId: undefined, importHash: 'h2', source: 'demo', categoryId: 'c2' },
    { id: 't3', accountId: 'a1', amountCents: -2500, bookingDate: '2026-07-02', currency: 'EUR', counterparty: 'Cafe', purpose: 'Snack', transferGroupId: undefined, importHash: 'h3', source: 'demo', categoryId: 'c1' },
  ];

  const bars = categoryBars(txs, cats);
  const donut = donutDataFromCategoryBars(txs, cats);

  expect(donut.length).toBe(bars.length);
  for (let i = 0; i < bars.length; i++) {
    expect(donut[i].name).toBe(bars[i].name);
    expect(donut[i].value).toBeCloseTo(bars[i].valueCents / 100, 2);
  }
});
