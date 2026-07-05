import { formatCents } from '../../lib/money';
import { categoryBars, donutDataFromCategoryBars } from '../../lib/analytics';
import type { Transaction, Category } from '../../db/schema';
import { useState } from 'react';
import { DonutChart } from '../../components/DonutChart';

export function CategoriesTab({ txs, categories }:{ txs: Transaction[]; categories: Category[] }) {
  const [showDonut, setShowDonut] = useState(true);
  const [activeGroup, setActiveGroup] = useState('categories');

  const bars = categoryBars(txs, categories);
  const donut = donutDataFromCategoryBars(txs, categories);

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
          groupOptions={[{ id: 'categories', label: 'Categories' }, { id: 'accounts', label: 'Accounts' }, { id: 'people', label: 'People' }]}
          activeGroup={activeGroup}
          onGroupChange={(g) => setActiveGroup(g)}
          onSliceClick={(_name) => { /* open drill */ }}
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
    </div>
  );
}
