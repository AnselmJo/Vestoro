import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { ensureSeed } from '../src/db/repo';
import { loadDemoData } from '../src/lib/demo';
import { db } from '../src/db/schema';
import { sankeyData } from '../src/lib/analytics';
import { currentMonthKey } from '../src/lib/money';

describe('regression: repeated demo data loads', () => {
  it('reuses the same three demo accounts instead of duplicating them', async () => {
    await ensureSeed();
    await loadDemoData();
    await loadDemoData(); // simulate a second click
    const accounts = await db.accounts.toArray();
    const demoAccounts = accounts.filter((a) => a.name.includes('(Demo)'));
    expect(demoAccounts).toHaveLength(3);
    const ibans = new Set(demoAccounts.map((a) => a.iban));
    expect(ibans.size).toBe(3); // no duplicate IBANs
  });

  it('produces a sankey with no node that is both a source and a target (no cycle)', async () => {
    await ensureSeed();
    await loadDemoData();
    await loadDemoData();
    const all = await db.transactions.toArray();
    const categories = await db.categories.toArray();
    const month = currentMonthKey();
    const monthTxs = all.filter((t) => t.bookingDate.startsWith(month));
    const s = sankeyData(monthTxs, categories);
    const sources = new Set(s.links.map((l) => l.source));
    const targets = new Set(s.links.map((l) => l.target));
    const bothSourceAndTarget = [...sources].filter((n) => targets.has(n) && n !== 'Einkommen');
    expect(bothSourceAndTarget).toEqual([]);
  });
});
