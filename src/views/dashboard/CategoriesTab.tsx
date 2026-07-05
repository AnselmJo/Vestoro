import { formatCents } from '../../lib/money';
import { categoryBars } from '../../lib/analytics';
import type { Transaction, Category } from '../../db/schema';

export function CategoriesTab({ txs, categories }:{ txs: Transaction[]; categories: Category[] }) {
  const bars = categoryBars(txs, categories);
  return (
    <div className="card p-4">
      <h3 className="font-medium mb-3">Categories</h3>
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
    </div>
  );
}
