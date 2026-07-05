import { formatCents } from '../../lib/money';
import { categoryBars, donutDataFromCategoryBars, donutDataFromAccounts, donutDataFromPeople } from '../../lib/analytics';
import type { Transaction, Category } from '../../db/schema';
import { useState } from 'react';
import { DonutChart } from '../../components/DonutChart';
import { Modal } from '../../components/ui';
import TransactionRow from '../../components/TransactionRow';
import { setCategory } from '../../db/repo';

export function CategoriesTab({ txs, categories, accounts, persons }:{ txs: Transaction[]; categories: Category[]; accounts?: any[]; persons?: any[] }) {
  const [showDonut, setShowDonut] = useState(true);
  const [activeGroup, setActiveGroup] = useState('categories');
  const [openSlice, setOpenSlice] = useState<string | null>(null);

  const bars = categoryBars(txs, categories);
  const donutCats = donutDataFromCategoryBars(txs, categories);
  const donutAcc = donutDataFromAccounts(txs, accounts ?? []);
  const donutPeople = donutDataFromPeople(txs, persons ?? [], accounts ?? []);

  const groupOptions = [{ id: 'categories', label: 'Categories' }, { id: 'accounts', label: 'Accounts' }, { id: 'people', label: 'People' }];

  const donut = activeGroup === 'categories' ? donutCats : activeGroup === 'accounts' ? donutAcc : donutPeople;

  const handleSliceClick = (name: string) => {
    setOpenSlice(name);
  };

  const filteredTxs = openSlice ? txs.filter((t) => {
    if (activeGroup === 'categories') return (categories.find((c) => c.id === t.categoryId)?.name ?? 'Ohne Kategorie') === openSlice;
    if (activeGroup === 'accounts') return (accounts?.find((a) => a.id === t.accountId)?.name ?? t.accountId) === openSlice;
    if (activeGroup === 'people') {
      const acc = accounts?.find((a) => a.id === t.accountId);
      const pid = acc?.personId; return persons?.find((p) => p.id === pid)?.name === openSlice;
    }
    return false;
  }) : [];

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium">Categories</h3>
        <div className="flex items-center gap-2">
          <button className="btn" onClick={() => setShowDonut((s) => !s)}>{showDonut ? 'List' : 'Donut'}</button>
        </div>
      </div>
      {showDonut ? (
        <DonutChart
          data={donut}
          centerLabel="Kategorien"
          groupOptions={groupOptions}
          activeGroup={activeGroup}
          onGroupChange={(g) => setActiveGroup(g)}
          onSliceClick={handleSliceClick}
          height={320}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {bars.map((b) => (
            <div key={b.name} className="flex items-center justify-between py-2" style={{ borderTop: '1px solid var(--border)' }}>
              <div>
                <div className="font-medium">{b.name}</div>
                <div className="text-xs" style={{ color: 'var(--text-dim)' }}>{b.kind}</div>
              </div>
              <div className="mono">{formatCents(b.valueCents)}</div>
            </div>
          ))}
        </div>
      )}

      {openSlice && (
        <Modal title={`Matches: ${openSlice}`} onClose={() => setOpenSlice(null)} wide>
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left p-2">Date</th>
                <th className="text-left p-2">Account</th>
                <th className="text-left p-2">Counterparty</th>
                <th className="text-left p-2">Purpose</th>
                <th className="text-left p-2">Category</th>
                <th className="text-right p-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filteredTxs.map((t) => (
                <TransactionRow
                  key={t.id}
                  t={t}
                  accountName={new Map((accounts ?? []).map((a:any)=>[a.id,a.name]))}
                  categories={categories}
                  transferPartner={new Map()}
                  onCategoryChange={async (_tx, categoryId) => {
                    try {
                      await setCategory(t.id, categoryId || undefined);
                    } catch (e: any) {
                      alert(e?.message ?? 'Fehler beim Setzen der Kategorie');
                    }
                  }}
                  compact
                />
              ))}
            </tbody>
          </table>
        </Modal>
      )}
    </div>
  );
}
