import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import type { Scope, View } from '../app/App';

/**
 * Fintech UX principle (2026 consensus): surface what needs attention without
 * being alarming — informational tone, one clear action, dismissible per
 * session rather than nagging on every view. See docs/PLAN.md categorization
 * concept for the full design.
 */
export function UncategorizedBanner({ scope, onOpenTransactions }: {
  scope: Scope; onOpenTransactions: (v: View) => void;
}) {
  const accounts = useLiveQuery(() => db.accounts.toArray(), []) ?? [];
  const txs = useLiveQuery(() => db.transactions.toArray(), []) ?? [];

  const count = useMemo(() => {
    const ids = new Set(
      accounts
        .filter((a) => (a.isDemo ?? false) === scope.demoMode)
        .filter((a) => scope.personIds.length === 0 || scope.personIds.includes(a.personId))
        .filter((a) => scope.accountIds.length === 0 || scope.accountIds.includes(a.id))
        .map((a) => a.id),
    );
    return txs.filter((t) => ids.has(t.accountId) && !t.categoryId && !t.transferGroupId).length;
  }, [accounts, txs, scope]);

  if (count === 0) return null;

  return (
    <div className="card p-3 mb-4 flex items-center gap-3 flex-wrap" style={{ borderColor: 'var(--accent)' }}>
      <span aria-hidden style={{ color: 'var(--accent-strong)' }}>◔</span>
      <span className="text-sm flex-1 min-w-0">
        {count} {count === 1 ? 'Transaktion wartet' : 'Transaktionen warten'} auf eine Kategorie.
      </span>
      <button className="btn btn-primary text-xs" onClick={() => onOpenTransactions('transactions')}>
        Jetzt zuordnen
      </button>
    </div>
  );
}
