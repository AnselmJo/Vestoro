import type { Category, Transaction } from '../db/schema';

export interface PeriodStats {
  incomeCents: number;
  expenseCents: number;   // positive number
  surplusCents: number;
  savingsRate: number | null; // 0..1 or null when no income
}

const isTransfer = (t: Transaction) => !!t.transferGroupId;

export function inMonth(t: Transaction, monthKey: string): boolean {
  return t.bookingDate.startsWith(monthKey);
}

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
 * Values in EUR (ECharts tooltips), computed from cents.
 */
export function sankeyData(txs: Transaction[], categories: Category[]): SankeyData {
  const catById = new Map(categories.map((c) => [c.id, c]));
  const incomeByCat = new Map<string, number>();
  const expenseByCat = new Map<string, number>();

  for (const t of txs) {
    if (isTransfer(t)) continue;
    const cat = t.categoryId ? catById.get(t.categoryId) : undefined;
    const label = cat?.name ?? 'Ohne Kategorie';
    if (t.amountCents > 0) incomeByCat.set(label, (incomeByCat.get(label) ?? 0) + t.amountCents);
    else expenseByCat.set(label, (expenseByCat.get(label) ?? 0) + -t.amountCents);
  }

  const hub = 'Einkommen';
  const nodes: SankeyData['nodes'] = [{ name: hub, itemStyle: { color: '#6ea8b5' } }];
  const links: SankeyData['links'] = [];
  const seen = new Set<string>([hub]);

  for (const [name, cents] of incomeByCat) {
    const label = name === hub ? `${name} ` : name; // sankey nodes must be unique
    if (!seen.has(label)) { nodes.push({ name: label, itemStyle: { color: '#7fb069' } }); seen.add(label); }
    links.push({ source: label, target: hub, value: round2(cents / 100) });
  }
  for (const [name, cents] of expenseByCat) {
    if (!seen.has(name)) { nodes.push({ name, itemStyle: { color: '#c96f5d' } }); seen.add(name); }
    links.push({ source: hub, target: name, value: round2(cents / 100) });
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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
