import type { Category, Transaction } from '../db/schema';

export interface PeriodStats {
  incomeCents: number;
  expenseCents: number;   // positive number
  surplusCents: number;
  savingsRate: number | null; // 0..1 or null when no income
}

const isTransfer = (t: Transaction) => !!t.transferGroupId;

/** Period key is either a month ("2026-07") or a year ("2026"). */
export function inPeriod(t: Transaction, periodKey: string): boolean {
  return t.bookingDate.startsWith(periodKey);
}

export const inMonth = inPeriod; // backwards-compatible alias


export function periodStats(txs: Transaction[]): PeriodStats {
  let income = 0;
  let expense = 0;
  for (const t of txs) {
    if (isTransfer(t)) continue;
    if (t.amountCents > 0) income += t.amountCents;
    else expense += -t.amountCents;
  }
  const surplus = income - expense;
  return {
    incomeCents: income,
    expenseCents: expense,
    surplusCents: surplus,
    savingsRate: income > 0 ? surplus / income : null,
  };
}

export interface SankeyData {
  nodes: Array<{ name: string; itemStyle?: { color: string } }>;
  links: Array<{ source: string; target: string; value: number }>;
}

/**
 * Income categories → "Einkommen" hub → expense categories (+ "Überschuss").
 * Each category gets exactly ONE edge, based on its NET amount (income − expense)
 * in the period. This is a deliberate structural guard: a Sankey graph must be
 * a DAG, and a category that had both inflows and outflows in the same period
 * (e.g. a category correction, or an undetected transfer) would otherwise
 * produce edges in both directions between the same two nodes — a 2-cycle
 * that crashes ECharts ("Sankey is a DAG, the original data has cycle!").
 * Netting also matches how the KPI cards already work (income vs. expense are
 * period totals, not raw transaction signs) and never double-counts.
 */
export function sankeyData(txs: Transaction[], categories: Category[]): SankeyData {
  const catById = new Map(categories.map((c) => [c.id, c]));
  const netByName = new Map<string, number>(); // positive = net income, negative = net expense

  for (const t of txs) {
    if (isTransfer(t)) continue;
    const cat = t.categoryId ? catById.get(t.categoryId) : undefined;
    const label = cat?.name ?? 'Ohne Kategorie';
    netByName.set(label, (netByName.get(label) ?? 0) + t.amountCents);
  }

  const hub = 'Einkommen';
  const nodes: SankeyData['nodes'] = [{ name: hub, itemStyle: { color: '#6ea8b5' } }];
  const links: SankeyData['links'] = [];

  for (const [name, cents] of netByName) {
    if (cents === 0) continue;
    const isIncome = cents > 0;
    nodes.push({ name, itemStyle: { color: isIncome ? '#7fb069' : '#c96f5d' } });
    links.push(
      isIncome
        ? { source: name, target: hub, value: round2(cents / 100) }
        : { source: hub, target: name, value: round2(-cents / 100) },
    );
  }

  const stats = periodStats(txs);
  if (stats.surplusCents > 0) {
    nodes.push({ name: 'Überschuss', itemStyle: { color: '#8fbf9f' } });
    links.push({ source: hub, target: 'Überschuss', value: round2(stats.surplusCents / 100) });
  }
  return { nodes, links };
}

export interface CategoryBar { name: string; valueCents: number; kind: 'income' | 'expense' | 'unknown'; }

export function categoryBars(txs: Transaction[], categories: Category[]): CategoryBar[] {
  const catById = new Map(categories.map((c) => [c.id, c]));
  const sums = new Map<string, { cents: number; kind: CategoryBar['kind'] }>();
  for (const t of txs) {
    if (isTransfer(t)) continue;
    const cat = t.categoryId ? catById.get(t.categoryId) : undefined;
    const name = cat?.name ?? 'Ohne Kategorie';
    const kind: CategoryBar['kind'] = cat?.kind ?? (t.amountCents > 0 ? 'income' : 'unknown');
    const prev = sums.get(name) ?? { cents: 0, kind };
    prev.cents += Math.abs(t.amountCents);
    sums.set(name, prev);
  }
  return [...sums.entries()]
    .map(([name, v]) => ({ name, valueCents: v.cents, kind: v.kind }))
    .sort((a, b) => b.valueCents - a.valueCents);
}

export interface MonthBar { month: string; incomeCents: number; expenseCents: number; }

export function monthlyBars(txs: Transaction[], months: string[]): MonthBar[] {
  return months.map((m) => {
    const stats = periodStats(txs.filter((t) => inMonth(t, m)));
    return { month: m, incomeCents: stats.incomeCents, expenseCents: stats.expenseCents };
  });
}

export interface TransferFlow {
  fromAccountId: string;
  toAccountId: string;
  cents: number; // positive, total moved in the period
  count: number;
}

/**
 * Aggregated money movement between own accounts (detected transfer pairs),
 * grouped by direction. Period filtering uses the outflow booking date.
 */
export function transferFlows(txs: Transaction[], periodKey?: string): TransferFlow[] {
  const byGroup = new Map<string, Transaction[]>();
  for (const t of txs) {
    if (!t.transferGroupId) continue;
    if (!byGroup.has(t.transferGroupId)) byGroup.set(t.transferGroupId, []);
    byGroup.get(t.transferGroupId)!.push(t);
  }
  const agg = new Map<string, TransferFlow>();
  for (const pair of byGroup.values()) {
    if (pair.length !== 2) continue;
    const outflow = pair.find((t) => t.amountCents < 0);
    const inflow = pair.find((t) => t.amountCents > 0);
    if (!outflow || !inflow) continue;
    if (periodKey && !outflow.bookingDate.startsWith(periodKey)) continue;
    const key = `${outflow.accountId}→${inflow.accountId}`;
    const prev = agg.get(key) ?? { fromAccountId: outflow.accountId, toAccountId: inflow.accountId, cents: 0, count: 0 };
    prev.cents += -outflow.amountCents;
    prev.count += 1;
    agg.set(key, prev);
  }
  return [...agg.values()].sort((a, b) => b.cents - a.cents);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
