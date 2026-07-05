import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { db } from '../db/schema';
import { shiftMonth, currentMonthKey, monthLabel } from '../lib/money';
import { inPeriod, sankeyData } from '../lib/analytics';
import { Seg } from '../components/ui';
import { ImportDialog } from './ImportDialog';
import { OverviewTab } from './dashboard/OverviewTab';
import { CashflowTab } from './dashboard/CashflowTab';
import { CategoriesTab } from './dashboard/CategoriesTab';
import { AccountsCompareTab } from './dashboard/AccountsCompareTab';
import type { Scope, View } from '../app/App';

type PeriodMode = 'month' | 'year';

export function Dashboard({ scope, onNavigate, setIncludeTransfers }: { scope: Scope; onNavigate: (v: View) => void; setIncludeTransfers?: (v: boolean) => void }) {
  // reference to avoid unused parameter errors
  void onNavigate;
  void setIncludeTransfers;

  const [mode, setMode] = useState<PeriodMode>('month');
  const [monthKey, setMonthKey] = useState(currentMonthKey());
  const [importOpen, setImportOpen] = useState(false);
  const [fullscreenSankey, setFullscreenSankey] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | '__none__' | null>(null);
  const [activeTab, setActiveTab] = useState<'overview'|'cashflow'|'categories'|'accounts'>('overview');

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

  const periodKey = mode === 'month' ? monthKey : monthKey.slice(0, 4);
  const yearOfKey = Number(monthKey.slice(0, 4));
  const last12 = mode === 'month'
    ? Array.from({ length: 12 }, (_, i) => shiftMonth(monthKey, i - 11))
    : Array.from({ length: 12 }, (_, i) => `${yearOfKey}-${String(i + 1).padStart(2, '0')}`);

  const periodTxs = txs.filter((t) => inPeriod(t, periodKey));
  const sankey = sankeyData(periodTxs, categories, scope.includeTransfers, accountName);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Seg options={[{ id: 'overview', label: 'Overview' }, { id: 'cashflow', label: 'Cash Flow' }, { id: 'categories', label: 'Categories' }, { id: 'accounts', label: 'Accounts' }]} value={activeTab} onChange={(v) => setActiveTab(v as any)} />
      </div>

      {activeTab === 'overview' && (
        <OverviewTab
          mode={mode}
          setMode={setMode}
          monthKey={monthKey}
          setMonthKey={setMonthKey}
          periodLabel={mode === 'month' ? monthLabel(monthKey) : String(yearOfKey)}
          sankeyOption={{ series: [{ type: 'sankey', data: sankey.nodes, links: sankey.links }] }}
          sankey={sankey}
          periodTxs={periodTxs}
          categories={categories}
          accountName={accountName}
          transferPartner={new Map()}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          fullscreenSankey={fullscreenSankey}
          setFullscreenSankey={setFullscreenSankey}
          onImport={() => setImportOpen(true)}
        />
      )}

      {activeTab === 'cashflow' && (
        <CashflowTab txs={txs} months={last12} />
      )}

      {activeTab === 'categories' && (
        <CategoriesTab txs={periodTxs} categories={categories} />
      )}

      {activeTab === 'accounts' && (
        <AccountsCompareTab txs={txs} accounts={accounts} months={last12} />
      )}

      {importOpen && <ImportDialog scope={scope} onClose={() => setImportOpen(false)} />}
    </div>
  );
}