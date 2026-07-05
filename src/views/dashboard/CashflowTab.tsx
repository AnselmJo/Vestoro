import { Chart } from '../../components/ui';
import type { Transaction } from '../../db/schema';
import { monthlyBars } from '../../lib/analytics';

export function CashflowTab({ txs, months }:{ txs: Transaction[]; months: string[] }) {
  const monthly = monthlyBars(txs, months);
  const option = {
    grid: { left: 60, right: 20, top: 30, bottom: 25 },
    tooltip: { valueFormatter: (v:number) => `${v.toLocaleString('de-DE')} €` },
    legend: { textStyle: { color: '#969ca8' }, top: 0 },
    xAxis: { type: 'category', data: months.map((m) => m.slice(2)), axisLabel: { color: '#969ca8' } },
    yAxis: { type: 'value', axisLabel: { color: '#969ca8' }, splitLine: { lineStyle: { color: '#2a2f38' } } },
    series: [
      { name: 'Income', type: 'bar', data: monthly.map((m) => Math.round(m.incomeCents / 100)), itemStyle: { color: '#6fbf73', borderRadius: 3 }, barMaxWidth: 12 },
      { name: 'Expenses', type: 'bar', data: monthly.map((m) => Math.round(m.expenseCents / 100)), itemStyle: { color: '#d0705c', borderRadius: 3 }, barMaxWidth: 12 },
    ],
  };
  return (
    <div className="card p-4">
      <h3 className="font-medium mb-3">12 month cashflow</h3>
      <Chart option={option} height={320} />
    </div>
  );
}
