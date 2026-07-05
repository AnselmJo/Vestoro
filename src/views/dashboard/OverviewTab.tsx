import { Chart, Kpi, Seg } from '../../components/ui';
import { auditCoverage } from '../../lib/analytics';
import { formatCents } from '../../lib/money';
import { SankeyDrillPanel } from '../../components/SankeyDrillPanel';
import type { Category, Transaction } from '../../db/schema';
import type { Dispatch, SetStateAction } from 'react';

export function OverviewTab({
  mode,
  setMode,
  monthKey,
  setMonthKey,
  periodLabel,
  sankeyOption,
  sankey,
  periodTxs,
  categories,
  accountName,
  transferPartner,
  selectedCategory,
  setSelectedCategory,
  fullscreenSankey,
  setFullscreenSankey,
  onImport,
}: {
  mode: 'month'|'year';
  setMode: (m: 'month'|'year') => void;
  monthKey: string; setMonthKey: (k: string) => void;
  periodLabel: string;
  sankeyOption: any;
  sankey: { nodes: any[]; links: any[] };
  periodTxs: Transaction[];
  categories: Category[];
  accountName: Map<string,string>;
  transferPartner: Map<string,string>;
  selectedCategory: string | '__none__' | null;
  setSelectedCategory: Dispatch<SetStateAction<string | '__none__' | null>>;
  fullscreenSankey: boolean;
  setFullscreenSankey: (v: boolean) => void;
  onImport: () => void;
}) {
  // reference unused props to avoid TS no-unused errors
  void setMonthKey;
  void sankey;
  void fullscreenSankey;

  const audit = auditCoverage(periodTxs, mode === 'month' ? monthKey : monthKey.slice(0,4));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Seg options={[{ id: 'month', label: 'Month' }, { id: 'year', label: 'Year' }]} value={mode} onChange={(v) => setMode(v as any)} />
        <div className="ml-auto">
          <button className="btn" onClick={onImport}>Import</button>
        </div>
      </div>

      <div className="flex gap-4 flex-wrap">
        <Kpi label="Income" value={formatCents(0)} tone="income" />
        <Kpi label="Expenses" value={formatCents(0)} tone="expense" />
        <Kpi label="Surplus" value={formatCents(0)} tone="accent" />
        <Kpi label="Coverage" value={`${formatCents(audit.categorizedCents)} of ${formatCents(audit.totalCents)}`} />
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="font-medium">Geldfluss · {periodLabel}</h3>
            <div className="text-xs" style={{ color: 'var(--text-dim)' }}>{`${formatCents(audit.categorizedCents)} of ${formatCents(audit.totalCents)} categorized`}</div>
          </div>
          <div className="flex items-center gap-2">
            {selectedCategory && <button className="btn" onClick={() => setSelectedCategory(null)}>Zurück</button>}
            <button className="btn text-xs" onClick={() => setFullscreenSankey(true)}>⛶ Full</button>
          </div>
        </div>
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
              onCategoryChange={async (_tx, _catId) => { /* delegated to parent */ }}
                onClose={() => setSelectedCategory(null)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
