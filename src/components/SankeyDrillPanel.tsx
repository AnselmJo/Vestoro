import type { Transaction, Category } from '../db/schema';
import TransactionRow from './TransactionRow';

export function SankeyDrillPanel({
  txs,
  categories,
  accountName,
  transferPartner,
  onCategoryChange,
  onClose,
}: {
  txs: Transaction[];
  categories: Category[];
  accountName: Map<string, string>;
  transferPartner: Map<string, string>;
  onCategoryChange: (tx: Transaction, categoryId: string) => Promise<void>;
  onClose: () => void;
}) {
  return (
    <div className="card p-3" style={{ maxHeight: '60vh', overflow: 'auto' }}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-medium">Transaktionen</h4>
        <button className="btn" onClick={onClose}>Schließen</button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs" style={{ color: 'var(--text-dim)' }}>
            <th className="text-left p-2">Datum</th>
            <th className="text-left p-2">Konto</th>
            <th className="text-left p-2">Empfänger</th>
            <th className="text-left p-2">Kategorie</th>
            <th className="text-right p-2">Betrag</th>
          </tr>
        </thead>
        <tbody>
          {txs.map((t) => (
            <TransactionRow key={t.id} t={t} accountName={accountName} categories={categories} transferPartner={transferPartner} onCategoryChange={onCategoryChange} compact />
          ))}
        </tbody>
      </table>
    </div>
  );
}
