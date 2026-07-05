import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../db/schema';
import { de } from '../i18n/de';
import { formatCents, shiftMonth } from '../lib/money';
import { categoryBars, inMonth, monthlyBars, periodStats, sankeyData } from '../lib/analytics';
import { loadDemoData } from '../lib/demo';
import { Chart, Kpi, Modal } from '../components/ui';
import { ImportDialog } from './ImportDialog';
import type { View } from '../app/App';

export function Dashboard({ month, onNavigate }: { month: string; onNavigate: (v: View) => void }) {
  const txs = useLiveQuery(() => db.transactions.toArray(), []) ?? [];
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? [];
  const [importOpen, setImportOpen] = useState(false);
  const [fullscreenSankey, setFullscreenSankey] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

  async function onLoadDemo() {
    setDemoBusy(true);
    setDemoError(null);
    try {
      await loadDemoData();
    } catch (err) {
      console.error('Demo-Daten konnten nicht geladen werden:', err);
      setDemoError(err instanceof Error ? err.message : String(err));
    } finally {
      setDemoBusy(false);
    }
  }

  const monthTxs = txs.filter((t) => inMonth(t, month));
  const stats = periodStats(monthTxs);

  if (txs.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="card p-10 max-w-md text-center">
          <div className="text-2xl mb-1 font-semibold" style={{ color: 'var(--accent)' }}>{de.appName}</div>
          <div className="mb-4" style={{ color: 'var(--text-dim)' }}>{de.slogan}</div>
          <p className="mb-6 text-sm" style={{ color: 'var(--text-dim)' }}>{de.dashboard.emptyBody}</p>
          {demoError && (
            <p className="mb-4 text-sm" style={{ color: 'var(--expense)' }}>
              Demo-Daten konnten nicht geladen werden: {demoError}
            </p>
          )}
          <div className="flex gap-3 justify-center">
            <button className="btn btn-primary" onClick={() => setImportOpen(true)}>{de.dashboard.importCsv}</button>
            <button className="btn" disabled={demoBusy} onClick={onLoadDemo}>
              {demoBusy ? 'Lädt …' : de.dashboard.loadDemo}
            </button>
          </div>
        </div>
        {importOpen && <ImportDialog onClose={() => setImportOpen(false)} />}
      </div>
    );
  }

  const sankey = sankeyData(monthTxs, categories);
  const cats = categoryBars(monthTxs, categories).slice(0, 10);
  const last12 = Array.from({ length: 12 }, (_, i) => shiftMonth(month, i - 11));
  const monthly = monthlyBars(txs, last12);

  const sankeyOption = {
    tooltip: { trigger: 'item', valueFormatter: (v: number) => `${v.toLocaleString('de-DE')} €` },
    series: [{
      type: 'sankey',
      data: sankey.nodes,
      links: sankey.links,
      emphasis: { focus: 'adjacency' },
      lineStyle: { color: 'gradient', opacity: 0.35 },
      label: { color: '#e8eaed', fontFamily: 'IBM Plex Sans Variable' },
      nodeAlign: 'justify',
      left: 10, right: 120, top: 10, bottom: 10,
    }],
  };

  const catOption = {
    grid: { left: 130, right: 30, top: 10, bottom: 25 },
    tooltip: { valueFormatter: (v: number) => `${v.toLocaleString('de-DE')} €` },
    xAxis: { type: 'value', axisLabel: { color: '#9aa0ab' }, splitLine: { lineStyle: { color: '#32363f' } } },
    yAxis: { type: 'category', inverse: true, data: cats.map((c) => c.name), axisLabel: { color: '#e8eaed' } },
    series: [{
      type: 'bar',
      data: cats.map((c) => ({
        value: Math.round(c.valueCents / 100),
        itemStyle: { color: c.kind === 'income' ? '#7fb069' : '#c96f5d', borderRadius: 3 },
      })),
      barMaxWidth: 16,
    }],
  };

  const monthlyOption = {
    grid: { left: 60, right: 20, top: 30, bottom: 25 },
    tooltip: { valueFormatter: (v: number) => `${v.toLocaleString('de-DE')} €` },
    legend: { textStyle: { color: '#9aa0ab' }, top: 0 },
    xAxis: { type: 'category', data: last12.map((m) => m.slice(2)), axisLabel: { color: '#9aa0ab' } },
    yAxis: { type: 'value', axisLabel: { color: '#9aa0ab' }, splitLine: { lineStyle: { color: '#32363f' } } },
    series: [
      { name: de.kpi.income, type: 'bar', data: monthly.map((m) => Math.round(m.incomeCents / 100)), itemStyle: { color: '#7fb069', borderRadius: 3 }, barMaxWidth: 12 },
      { name: de.kpi.expenses, type: 'bar', data: monthly.map((m) => Math.round(m.expenseCents / 100)), itemStyle: { color: '#c96f5d', borderRadius: 3 }, barMaxWidth: 12 },
    ],
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-4 flex-wrap">
        <Kpi label={de.kpi.income} value={formatCents(stats.incomeCents)} tone="income" />
        <Kpi label={de.kpi.expenses} value={formatCents(stats.expenseCents)} tone="expense" />
        <Kpi label={de.kpi.surplus} value={formatCents(stats.surplusCents)} tone={stats.surplusCents >= 0 ? 'income' : 'expense'} />
        <Kpi label={de.kpi.savingsRate} value={stats.savingsRate === null ? '—' : `${(stats.savingsRate * 100).toFixed(1).replace('.', ',')} %`} tone="accent" />
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium">{de.dashboard.sankeyTitle}</h3>
          <div className="flex gap-2">
            <button className="btn text-xs" onClick={() => setImportOpen(true)}>{de.dashboard.importCsv}</button>
            <button className="btn text-xs" onClick={() => setFullscreenSankey(true)}>⛶ Vollbild</button>
          </div>
        </div>
        {sankey.links.length > 0
          ? <Chart option={sankeyOption} height={360} />
          : <div className="py-16 text-center" style={{ color: 'var(--text-dim)' }}>{de.tx.none}</div>}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="card p-4">
          <h3 className="font-medium mb-2">{de.dashboard.categoryBars}</h3>
          <Chart option={catOption} height={300} />
        </div>
        <div className="card p-4">
          <h3 className="font-medium mb-2">{de.dashboard.monthlyBars}</h3>
          <Chart option={monthlyOption} height={300} />
        </div>
      </div>

      {importOpen && <ImportDialog onClose={() => setImportOpen(false)} />}
      {fullscreenSankey && (
        <Modal title={de.dashboard.sankeyTitle} onClose={() => setFullscreenSankey(false)}>
          <Chart option={sankeyOption} height={window.innerHeight * 0.6} />
        </Modal>
      )}
      <button className="hidden" onClick={() => onNavigate('transactions')} />
    </div>
  );
}
