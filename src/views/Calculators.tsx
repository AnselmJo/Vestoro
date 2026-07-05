import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { de } from '../i18n/de';
import { formatCents } from '../lib/money';
import { fireProjection, savingsPlan } from '../lib/calculators';
import { periodStats } from '../lib/analytics';
import { Chart } from '../components/ui';
import type { Scope } from '../app/App';

function NumField({ label, value, onChange, step = 1 }: {
  label: string; value: number; onChange: (v: number) => void; step?: number;
}) {
  return (
    <label className="text-xs flex-1 min-w-36" style={{ color: 'var(--text-dim)' }}>
      {label}
      <input type="number" className="input mt-1 mono" value={value} step={step}
        onChange={(e) => onChange(Number(e.target.value) || 0)} />
    </label>
  );
}

export function Calculators({ scope }: { scope: Scope }) {
  // Pre-fill from real data where sensible: average monthly expenses of the last 3 months.
  const accounts = useLiveQuery(() => db.accounts.toArray(), []) ?? [];
  const txs = useLiveQuery(() => db.transactions.toArray(), []) ?? [];
  const avgExpenses = useMemo(() => {
    const ids = new Set(accounts.filter((a) => (a.isDemo ?? false) === scope.demoMode).map((a) => a.id));
    const scoped = txs.filter((t) => ids.has(t.accountId));
    const months = new Set(scoped.map((t) => t.bookingDate.slice(0, 7)));
    const last3 = [...months].sort().slice(-3);
    if (last3.length === 0) return 2000;
    const total = last3.reduce((sum, m) =>
      sum + periodStats(scoped.filter((t) => t.bookingDate.startsWith(m))).expenseCents, 0);
    return Math.round(total / last3.length / 100);
  }, [accounts, txs, scope.demoMode]);

  // Sparplan state (Euro, not cents, for input ergonomics)
  const [initial, setInitial] = useState(10000);
  const [monthly, setMonthly] = useState(500);
  const [rate, setRate] = useState(7);
  const [years, setYears] = useState(20);
  const [inflation, setInflation] = useState(2);

  // FIRE state
  const [expenses, setExpenses] = useState(avgExpenses);
  const [swr, setSwr] = useState(4);
  const [wealth, setWealth] = useState(50000);
  const [fireSavings, setFireSavings] = useState(1000);
  const [fireRate, setFireRate] = useState(7);

  const plan = savingsPlan({
    initialCents: initial * 100, monthlyCents: monthly * 100,
    annualRatePct: rate, years, annualInflationPct: inflation,
  });
  const fire = fireProjection({
    monthlyExpensesCents: expenses * 100, withdrawalRatePct: swr,
    currentWealthCents: wealth * 100, monthlySavingsCents: fireSavings * 100, annualRatePct: fireRate,
  });

  const lineOption = (points: typeof plan.yearly, targetCents?: number) => ({
    grid: { left: 70, right: 20, top: 30, bottom: 25 },
    tooltip: { trigger: 'axis', valueFormatter: (v: number) => `${Math.round(v).toLocaleString('de-DE')} €` },
    legend: { textStyle: { color: '#969ca8' }, top: 0 },
    xAxis: { type: 'category', data: points.map((p) => `J${p.year}`), axisLabel: { color: '#969ca8' } },
    yAxis: { type: 'value', axisLabel: { color: '#969ca8' }, splitLine: { lineStyle: { color: '#2a2f38' } } },
    series: [
      { name: de.calc.chartValue, type: 'line', smooth: true, showSymbol: false,
        data: points.map((p) => p.valueCents / 100), lineStyle: { color: '#4db06b', width: 2.5 },
        areaStyle: { color: 'rgba(77,176,107,0.12)' }, itemStyle: { color: '#4db06b' },
        ...(targetCents ? { markLine: { silent: true, symbol: 'none', label: { color: '#969ca8', formatter: 'FI-Ziel' },
          lineStyle: { color: '#8dc63f', type: 'dashed' }, data: [{ yAxis: targetCents / 100 }] } } : {}) },
      { name: de.calc.chartContributed, type: 'line', smooth: true, showSymbol: false,
        data: points.map((p) => p.contributedCents / 100), lineStyle: { color: '#8a8f99', width: 1.5, type: 'dashed' },
        itemStyle: { color: '#8a8f99' } },
    ],
  });

  return (
    <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
      <div className="card p-4 flex flex-col gap-3">
        <h3 className="font-medium">{de.calc.savings}</h3>
        <div className="flex gap-2 flex-wrap">
          <NumField label={de.calc.initial} value={initial} onChange={setInitial} step={100} />
          <NumField label={de.calc.monthly} value={monthly} onChange={setMonthly} step={50} />
          <NumField label={de.calc.rate} value={rate} onChange={setRate} step={0.5} />
          <NumField label={de.calc.years} value={years} onChange={setYears} />
          <NumField label={de.calc.inflation} value={inflation} onChange={setInflation} step={0.5} />
        </div>
        <div className="flex gap-4 flex-wrap text-sm">
          <div><div className="text-xs" style={{ color: 'var(--text-dim)' }}>{de.calc.final}</div>
            <div className="mono text-lg" style={{ color: 'var(--income)' }}>{formatCents(plan.finalCents)}</div></div>
          <div><div className="text-xs" style={{ color: 'var(--text-dim)' }}>{de.calc.contributed}</div>
            <div className="mono text-lg">{formatCents(plan.contributedCents)}</div></div>
          <div><div className="text-xs" style={{ color: 'var(--text-dim)' }}>{de.calc.interest}</div>
            <div className="mono text-lg" style={{ color: 'var(--accent)' }}>{formatCents(plan.interestCents)}</div></div>
          {plan.realFinalCents !== undefined && (
            <div><div className="text-xs" style={{ color: 'var(--text-dim)' }}>{de.calc.realFinal}</div>
              <div className="mono text-lg" style={{ color: 'var(--text-dim)' }}>{formatCents(plan.realFinalCents)}</div></div>
          )}
        </div>
        <Chart option={lineOption(plan.yearly)} height={240} />
      </div>

      <div className="card p-4 flex flex-col gap-3">
        <h3 className="font-medium">{de.calc.fire}</h3>
        <div className="flex gap-2 flex-wrap">
          <NumField label={de.calc.monthlyExpenses} value={expenses} onChange={setExpenses} step={50} />
          <NumField label={de.calc.swr} value={swr} onChange={setSwr} step={0.25} />
          <NumField label={de.calc.currentWealth} value={wealth} onChange={setWealth} step={1000} />
          <NumField label={de.calc.monthly} value={fireSavings} onChange={setFireSavings} step={50} />
          <NumField label={de.calc.rate} value={fireRate} onChange={setFireRate} step={0.5} />
        </div>
        <div className="flex gap-4 flex-wrap text-sm">
          <div><div className="text-xs" style={{ color: 'var(--text-dim)' }}>{de.calc.fiTarget}</div>
            <div className="mono text-lg" style={{ color: 'var(--accent)' }}>{formatCents(fire.targetCents)}</div></div>
          <div><div className="text-xs" style={{ color: 'var(--text-dim)' }}>{de.calc.yearsToFi}</div>
            <div className="mono text-lg" style={{ color: 'var(--income)' }}>
              {fire.yearsToFi === null ? de.calc.notReachable : `${String(fire.yearsToFi).replace('.', ',')} J.`}
            </div></div>
        </div>
        <Chart option={lineOption(fire.fiYearly.slice(0, Math.max(10, Math.ceil((fire.yearsToFi ?? 30) + 5))), fire.targetCents)} height={240} />
      </div>
    </div>
  );
}
