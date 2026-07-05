import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { de } from '../i18n/de';
import { currentMonthKey, monthLabel, shiftMonth, formatCents } from '../lib/money';
import { transferFlows, inPeriod } from '../lib/analytics';
import { Chart, Seg } from '../components/ui';
import type { Scope } from '../app/App';

export function TransferFlows({ scope }: { scope: Scope }) {
  const [mode, setMode] = useState<'month'|'year'>('month');
  const [monthKey, setMonthKey] = useState(currentMonthKey());
  const [sortKey, setSortKey] = useState<'date'|'amount'>('date');
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc');
  const [personFilter, setPersonFilter] = useState<string>('');

  const accounts = useLiveQuery(() => db.accounts.toArray(), []) ?? [];
  const persons = useLiveQuery(() => db.persons.toArray(), []) ?? [];
  const allTxs = useLiveQuery(() => db.transactions.toArray(), []) ?? [];

  const scopedAccountIds = useMemo(() => new Set(
    accounts
      .filter((a) => (a.isDemo ?? false) === scope.demoMode)
      .filter((a) => scope.personIds.length === 0 || scope.personIds.includes(a.personId))
      .filter((a) => scope.accountIds.length === 0 || scope.accountIds.includes(a.id))
      .map((a) => a.id),
  ), [accounts, scope]);

  const txs = allTxs.filter((t) => scopedAccountIds.has(t.accountId));
  const periodKey = mode === 'month' ? monthKey : monthKey.slice(0, 4);
  const periodTxs = txs.filter((t) => inPeriod(t, periodKey));

  // flows for sankey (aggregated)
  const flows = transferFlows(periodTxs, periodKey);

  // build sankey option: nodes = accounts involved, links from->to
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));
  const nodes = flows.map((f) => ({ name: accountName.get(f.fromAccountId) ?? f.fromAccountId }));
  // ensure unique nodes
  const uniqueNodes = Array.from(new Map(nodes.map((n) => [n.name, n])).values());
  const links = flows.map((f) => ({ source: accountName.get(f.fromAccountId) ?? f.fromAccountId, target: accountName.get(f.toAccountId) ?? f.toAccountId, value: Math.round(f.cents / 100) }));

  const sankeyOption = {
    tooltip: { trigger: 'item', valueFormatter: (v: number) => `${v.toLocaleString('de-DE')} €` },
    series: [{ type: 'sankey', data: uniqueNodes, links, emphasis: { focus: 'adjacency' }, lineStyle: { color: 'gradient', opacity: 0.6 } }],
  };

  // Build individual transfer pairs (one row per transfer pair)
  const pairs = useMemo(() => {
    const byGroup = new Map<string, any[]>();
    for (const t of periodTxs) {
      if (!t.transferGroupId) continue;
      if (!byGroup.has(t.transferGroupId)) byGroup.set(t.transferGroupId, []);
      byGroup.get(t.transferGroupId)!.push(t);
    }
    const out: Array<{ date: string; fromAccountId: string; toAccountId: string; cents: number }> = [];
    for (const pair of byGroup.values()) {
      if (pair.length !== 2) continue;
      const outflow = pair.find((p) => p.amountCents < 0);
      const inflow = pair.find((p) => p.amountCents > 0);
      if (!outflow || !inflow) continue;
      out.push({ date: outflow.bookingDate, fromAccountId: outflow.accountId, toAccountId: inflow.accountId, cents: -outflow.amountCents });
    }
    return out;
  }, [periodTxs]);

  // person filter: if set, only include pairs where both accounts belong to that person
  const filteredPairs = useMemo(() => {
    if (!personFilter) return pairs;
    const accountById = new Map(accounts.map((a) => [a.id, a]));
    return pairs.filter((p) => {
      const fa = accountById.get(p.fromAccountId);
      const ta = accountById.get(p.toAccountId);
      return fa?.personId === personFilter && ta?.personId === personFilter;
    });
  }, [pairs, personFilter, accounts]);

  const sorted = useMemo(() => {
    const s = [...filteredPairs];
    s.sort((a, b) => {
      if (sortKey === 'date') {
        return sortDir === 'asc' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date);
      }
      return sortDir === 'asc' ? a.cents - b.cents : b.cents - a.cents;
    });
    return s;
  }, [filteredPairs, sortKey, sortDir]);

  const personOptions = persons.length > 1 ? [{ id: '', name: 'All' }, ...persons.map((p) => ({ id: p.id, name: p.name }))] : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Seg options={[{ id: 'month', label: de.period.month }, { id: 'year', label: de.period.year }]} value={mode} onChange={(v) => setMode(v as any)} />
        <button className="btn px-2 py-1" onClick={() => setMonthKey(shiftMonth(monthKey, -1))}>◀</button>
        <span className="font-medium min-w-36 text-center">{monthLabel(monthKey)}</span>
        <button className="btn px-2 py-1" onClick={() => setMonthKey(shiftMonth(monthKey, 1))}>▶</button>

        <div className="ml-auto flex items-center gap-3">
          {personOptions.length > 0 && (
            <select className="input" value={personFilter} onChange={(e) => setPersonFilter(e.target.value)}>
              {personOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
        </div>
      </div>

      <div className="card p-4">
        <h3 className="font-medium mb-3">Transfer flows · {mode === 'month' ? monthLabel(monthKey) : monthKey.slice(0,4)}</h3>
        <Chart option={sankeyOption} height={360} />
      </div>

      <div className="card p-4">
        <h3 className="font-medium mb-3">Transfers</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs" style={{ color: 'var(--text-dim)' }}>
              <th className="p-2 cursor-pointer" onClick={() => { setSortKey('date'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); }}>Date {sortKey === 'date' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</th>
              <th className="p-2">From</th>
              <th className="p-2">To</th>
              <th className="p-2 text-right cursor-pointer" onClick={() => { setSortKey('amount'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); }}>Amount {sortKey === 'amount' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => (
              <tr key={`${p.fromAccountId}-${p.toAccountId}-${p.date}-${i}`} style={{ borderTop: '1px solid var(--border)' }}>
                <td className="p-2 mono">{p.date}</td>
                <td className="p-2">{accountName.get(p.fromAccountId)}</td>
                <td className="p-2">{accountName.get(p.toAccountId)}</td>
                <td className="p-2 mono text-right">{formatCents(p.cents)}</td>
              </tr>
            ))}
            {sorted.length === 0 && <tr><td className="p-4 text-center" colSpan={4} style={{ color: 'var(--text-dim)' }}>No transfers in this period.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
