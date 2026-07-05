import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { db } from '../db/schema';
import { de } from '../i18n/de';
import { currentMonthKey, formatCents, monthLabel, shiftMonth } from '../lib/money';
import { categoryBars, inPeriod, monthlyBars, periodStats, sankeyData, transferFlows, auditCoverage } from '../lib/analytics';
import { Chart, Kpi, Modal, Seg } from '../components/ui';
import { SankeyDrillPanel } from '../components/SankeyDrillPanel';
import { setCategory } from '../db/repo';
import { ImportDialog } from './ImportDialog';
import type { Scope, View } from '../app/App';

type PeriodMode = 'month' | 'year';

export function Dashboard({ scope, onNavigate }: { scope: Scope; onNavigate: (v: View) => void }) {
  const [mode, setMode] = useState<PeriodMode>('month');
  const [monthKey, setMonthKey] = useState(currentMonthKey());
  const [importOpen, setImportOpen] = useState(false);
  const [fullscreenSankey, setFullscreenSankey] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | '__none__' | null>(null);

  const accounts = useLiveQuery(() => db.accounts.toArray(), []) ?? [];
  const allTxs = useLiveQuery(() => db.transactions.toArray(), []) ?? [];
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? [];

  const scopedAccountIds = useMemo(() => new Set(
    accounts
      .filter((a) => (a.isDemo ?? false) === scope.demoMode)
      .filter((a) => scope.personIds.length === 0 || scope.personIds.includes(a.personId))
      .filter((a) => scope.accountIds.length === 0 || scope.accountIds.includes(a.id))
      .map((a) => a.id),
  ), [accounts, scope]);
  const accountName = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);

  const txs = allTxs.filter((t) => scopedAccountIds.has(t.accountId));

  // For transfers: map groupId → the two involved account names to render direction.
  const transferPartner = useMemo(() => {
    const byGroup = new Map<string, typeof txs>();
    for (const t of txs) {
      if (!t.transferGroupId) continue;
      if (!byGroup.has(t.transferGroupId)) byGroup.set(t.transferGroupId, [] as any);
      byGroup.get(t.transferGroupId)!.push(t);
    }
    const partner = new Map<string, string>();
    for (const pair of byGroup.values()) {
      if (pair.length !== 2) continue;
      partner.set(pair[0].id, accountName.get(pair[1].accountId) ?? '?');
      partner.set(pair[1].id, accountName.get(pair[0].accountId) ?? '?');
    }
    return partner;
  }, [txs, accountName]);
  const periodKey = mode === 'month' ? monthKey : monthKey.slice(0, 4);
  const prevKey = mode === 'month' ? shiftMonth(monthKey, -1) : String(Number(monthKey.slice(0, 4)) - 1);
  const periodTxs = txs.filter((t) => inPeriod(t, periodKey));
  const stats = periodStats(periodTxs);
  const prevStats = periodStats(txs.filter((t) => inPeriod(t, prevKey)));

  const delta = (cur: number, prev: number): number | null => (prev !== 0 ? (cur - prev) / Math.abs(prev) : null);

  if (txs.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="card p-10 max-w-md text-center">
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" className="w-12 h-12 mx-auto mb-3" />
          <div className="text-2xl mb-1 font-semibold">{de.appName}</div>
          <div className="mb-4 text-sm" style={{ color: 'var(--text-dim)' }}>{de.slogan}</div>
          <p className="mb-6 text-sm" style={{ color: 'var(--text-dim)' }}>{de.dashboard.emptyBody}</p>
          <button className="btn btn-primary" onClick={() => setImportOpen(true)}>{de.dashboard.importCsv}</button>
        </div>
        {importOpen && <ImportDialog scope={scope} onClose={() => setImportOpen(false)} />}
      </div>
    );
  }

  const sankey = sankeyData(periodTxs, categories);
  const cats = categoryBars(periodTxs, categories).filter((c) => c.kind !== 'income');
  const catTotal = cats.reduce((a, c) => a + c.valueCents, 0);
  const yearOfKey = Number(monthKey.slice(0, 4));
  const last12 = mode === 'month'
    ? Array.from({ length: 12 }, (_, i) => shiftMonth(monthKey, i - 11))
    : Array.from({ length: 12 }, (_, i) => `${yearOfKey}-${String(i + 1).padStart(2, '0')}`);
  const monthly = monthlyBars(txs, last12);
  const flows = transferFlows(txs, periodKey);

  const periodLabel = mode === 'month' ? monthLabel(monthKey) : String(yearOfKey);
  const shiftPeriod = (d: number) =>
    setMonthKey(mode === 'month' ? shiftMonth(monthKey, d) : shiftMonth(monthKey, d * 12));

  const sankeyOption = {
    tooltip: { trigger: 'item', valueFormatter: (v: number) => `${v.toLocaleString('de-DE')} €` },
    series: [{
      type: 'sankey', data: sankey.nodes, links: sankey.links,
      emphasis: { focus: 'adjacency' },
      lineStyle: { color: 'gradient', opacity: 0.35 },
      label: { color: '#e9ebee', fontFamily: 'IBM Plex Sans Variable' },
      nodeAlign: 'justify', left: 10, right: 130, top: 10, bottom: 10,
    }],
  };

  const monthlyOption = {
    grid: { left: 60, right: 20, top: 30, bottom: 25 },
    tooltip: { valueFormatter: (v: number) => `${v.toLocaleString('de-DE')} €` },
    legend: { textStyle: { color: '#969ca8' }, top: 0 },
    xAxis: { type: 'category', data: last12.map((m) => m.slice(2)), axisLabel: { color: '#969ca8' } },
    yAxis: { type: 'value', axisLabel: { color: '#969ca8' }, splitLine: { lineStyle: { color: '#2a2f38' } } },
    series: [
      { name: de.kpi.income, type: 'bar', data: monthly.map((m) => Math.round(m.incomeCents / 100)), itemStyle: { color: '#6fbf73', borderRadius: 3 }, barMaxWidth: 12 },
      { name: de.kpi.expenses, type: 'bar', data: monthly.map((m) => Math.round(m.expenseCents / 100)), itemStyle: { color: '#d0705c', borderRadius: 3 }, barMaxWidth: 12 },
    ],
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Seg options={[{ id: 'month', label: de.period.month }, { id: 'year', label: de.period.year }]}
          value={mode} onChange={setMode} />
        <button className="btn px-2 py-1" onClick={() => shiftPeriod(-1)}>◀</button>
        <span className="font-medium min-w-36 text-center">{periodLabel}</span>
        <button className="btn px-2 py-1" onClick={() => shiftPeriod(1)}>▶</button>
        <button className="btn px-2 py-1 text-xs" onClick={() => setMonthKey(currentMonthKey())}>{de.period.today}</button>
        <div className="ml-auto">
          <button className="btn" onClick={() => setImportOpen(true)}>{de.dashboard.importCsv}</button>
        </div>
      </div>

      <div className="flex gap-4 flex-wrap">
        <Kpi label={de.kpi.income} value={formatCents(stats.incomeCents)} tone="income"
          delta={delta(stats.incomeCents, prevStats.incomeCents)} />
        <Kpi label={de.kpi.expenses} value={formatCents(stats.expenseCents)} tone="expense"
          delta={delta(-stats.expenseCents, -prevStats.expenseCents)} />
        <Kpi label={de.kpi.surplus} value={formatCents(stats.surplusCents)}
          tone={stats.surplusCents >= 0 ? 'income' : 'expense'}
          delta={delta(stats.surplusCents, prevStats.surplusCents)} />
        <Kpi label={de.kpi.savingsRate}
          value={stats.savingsRate === null ? '—' : `${(stats.savingsRate * 100).toFixed(1).replace('.', ',')} %`}
          tone="accent" />
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="font-medium">{de.dashboard.sankeyTitle} · {periodLabel}</h3>
            <div className="text-xs" style={{ color: 'var(--text-dim)' }}>
              {(() => {
                const audit = auditCoverage(periodTxs, periodKey);
                return `${formatCents(audit.categorizedCents)} of ${formatCents(audit.totalCents)} categorized`;
              })()}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedCategory && <button className="btn" onClick={() => setSelectedCategory(null)}>Zurück</button>}
            <button className="btn text-xs" onClick={() => setFullscreenSankey(true)}>⛶ {de.dashboard.fullscreen}</button>
          </div>
        </div>
        {sankey.links.length > 0
          ? (
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ flex: selectedCategory ? 1 : 'auto', minWidth: 360 }}>
                <Chart option={sankeyOption} height={360} onNodeClick={(name) => {
                  const cat = categories.find((c) => c.name === name);
                  setSelectedCategory(cat ? cat.id : (name === 'Uncategorized' ? '__none__' : null));
                }} />
              </div>
              {selectedCategory && (
                <div style={{ width: 480 }}>
                  <SankeyDrillPanel
                    txs={periodTxs.filter((t) => (selectedCategory === '__none__' ? !t.categoryId : t.categoryId === selectedCategory))}
                    categories={categories}
                    accountName={accountName}
                    transferPartner={transferPartner}
                    onCategoryChange={async (tx, catId) => { await setCategory(tx.id, catId || undefined); }}
                    onClose={() => setSelectedCategory(null)}
                  />
                </div>
              )}
            </div>
          )
          : <div className="py-16 text-center" style={{ color: 'var(--text-dim)' }}>{de.tx.none}</div>}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="card p-4">
          <h3 className="font-medium mb-3">{de.dashboard.categoryShares}</h3>
          <div className="flex flex-col gap-2.5">
            {cats.slice(0, 10).map((c) => {
              const share = catTotal > 0 ? c.valueCents / catTotal : 0;
              return (
                <div key={c.name}>
                  <div className="flex items-baseline justify-between text-sm mb-1">
                    <span>{c.name}</span>
                    <span className="mono text-xs" style={{ color: 'var(--text-dim)' }}>
                      <span style={{ color: 'var(--text)' }}>{formatCents(c.valueCents)}</span>
                      {'  ·  '}{(share * 100).toFixed(1).replace('.', ',')} %
                    </span>
                  </div>
                  <div className="sharebar"><div style={{ width: `${share * 100}%`, background: 'var(--expense)' }} /></div>
                </div>
              );
            })}
            {cats.length === 0 && <div style={{ color: 'var(--text-dim)' }}>{de.tx.none}</div>}
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <div className="card p-4">
            <h3 className="font-medium mb-2">{de.dashboard.monthlyBars}</h3>
            <Chart option={monthlyOption} height={230} />
          </div>
          <div className="card p-4">
            <h3 className="font-medium mb-2">{de.dashboard.transferFlows}</h3>
            {flows.length === 0 && <div className="text-sm" style={{ color: 'var(--text-dim)' }}>{de.dashboard.noTransfers}</div>}
            {flows.map((f) => (
              <div key={`${f.fromAccountId}-${f.toAccountId}`}
                className="flex items-center justify-between text-sm py-1.5"
                style={{ borderTop: '1px solid var(--border)' }}>
                <span>
                  {accountName.get(f.fromAccountId)}
                  <span style={{ color: 'var(--accent)' }}> → </span>
                  {accountName.get(f.toAccountId)}
                  <span className="text-xs ml-2" style={{ color: 'var(--text-dim)' }}>({f.count}×)</span>
                </span>
                <span className="mono">{formatCents(f.cents)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {importOpen && <ImportDialog scope={scope} onClose={() => setImportOpen(false)} />}
      {fullscreenSankey && (
        <Modal title={`${de.dashboard.sankeyTitle} · ${periodLabel}`} onClose={() => setFullscreenSankey(false)} wide>
          <Chart option={sankeyOption} height={window.innerHeight * 0.6} />
        </Modal>
      )}
      <button className="hidden" onClick={() => onNavigate('transactions')} />
    </div>
  );
}
