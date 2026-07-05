import type { Transaction, Category } from '../db/schema';
import { formatIsoDate, formatCents } from '../lib/money';
import { de } from '../i18n/de';

export default function TransactionRow({
  t,
  accountName,
  categories,
  transferPartner,
  onCategoryChange,
  compact = false,
  colorTransfersBySign = false,
  currentAccountId,
  onOpenCategorize,
}: {
  t: Transaction;
  accountName: Map<string, string>;
  categories: Category[];
  transferPartner: Map<string, string>;
  onCategoryChange: (tx: Transaction, categoryId: string) => Promise<void>;
  compact?: boolean;
  colorTransfersBySign?: boolean;
  currentAccountId?: string;
  onOpenCategorize?: (tx: Transaction) => void;
}) {
  const signKind: 'income' | 'expense' = t.amountCents > 0 ? 'income' : 'expense';
  const filteredCats = categories.filter((c) => c.kind === signKind);
  const assignedCat = categories.find((c) => c.id === t.categoryId);
  const mismatch = assignedCat && assignedCat.kind !== signKind;

  const transferColor = (() => {
    if (!t.transferGroupId) return undefined;
    if (colorTransfersBySign && currentAccountId) {
      // from perspective of currentAccountId: amount negative => outflow (expense), positive => inflow (income)
      return t.amountCents < 0 ? 'var(--expense)' : 'var(--income)';
    }
    return 'var(--transfer)';
  })();

  return (
    <tr key={t.id} style={{ borderTop: '1px solid var(--border)', opacity: t.transferGroupId ? 0.6 : 1 }}>
      <td className="p-2 mono whitespace-nowrap" style={{ fontSize: compact ? 12 : undefined }}>{formatIsoDate(t.bookingDate)}</td>
      <td className="p-2 whitespace-nowrap" style={{ color: 'var(--text-dim)', fontSize: compact ? 12 : undefined }}>{accountName.get(t.accountId)}</td>
      <td className="p-2 max-w-48 truncate" style={{ fontSize: compact ? 12 : undefined }}>
        <span>{t.counterparty}</span>
        <button className="btn btn-ghost ml-2" title={de.tx.categorizeTitle} onClick={() => onOpenCategorize && onOpenCategorize(t)}>⋯</button>
      </td>
      {!compact && <td className="p-2 max-w-64 truncate" style={{ color: 'var(--text-dim)' }}>{t.purpose}</td>}
      <td className="p-2">
        {t.transferGroupId ? (
          <span className="text-xs px-2 py-1 rounded whitespace-nowrap" style={{ background: 'var(--surface-2)', color: transferColor }}>
            {t.amountCents < 0 ? `→ ${transferPartner.get(t.id) ?? '?'} ` : `← ${transferPartner.get(t.id) ?? '?'} `}
          </span>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <select className="input text-xs py-1" value={t.categoryId ?? ''} onChange={(e) => onCategoryChange(t, e.target.value)} style={{ minWidth: 130 }}>
              <option value="">Ohne Kategorie</option>
              {filteredCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {mismatch && <span title="Kategorie passt nicht zum Betrag" style={{ color: 'var(--expense)' }}>⚠</span>}
          </div>
        )}
      </td>
      <td className="p-2 mono text-right whitespace-nowrap" style={{ color: transferColor ?? (t.amountCents < 0 ? 'var(--expense)' : 'var(--income)') }}>{formatCents(t.amountCents)}</td>
    </tr>
  );
}
