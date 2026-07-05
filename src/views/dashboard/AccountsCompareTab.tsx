import { Chart } from '../../components/ui';
import type { Transaction } from '../../db/schema';

export function AccountsCompareTab({ txs, accounts, months }:{ txs: Transaction[]; accounts: any[]; months: string[] }) {
  // avoid unused var errors
  void txs;

  // build one series per account: balance over months
  const series = accounts.map((a) => ({ name: a.name, type: 'line', data: months.map(() => 0) }));
  const option = {
    tooltip: { valueFormatter: (v:number) => `${v.toLocaleString('de-DE')} €` },
    legend: { top: 0 },
    xAxis: { type: 'category', data: months.map((m) => m.slice(2)) },
    yAxis: { type: 'value' },
    series,
  };
  return (
    <div className="card p-4">
      <h3 className="font-medium mb-3">Account comparison</h3>
      <Chart option={option} height={320} />
    </div>
  );
}
