import { useEffect, useState } from 'react';
import { de } from '../i18n/de';
import { currentMonthKey, monthLabel, shiftMonth } from '../lib/money';
import { Dashboard } from '../views/Dashboard';
import { Accounts } from '../views/Accounts';
import { Transactions } from '../views/Transactions';
import { Settings } from '../views/Settings';

export type View = 'dashboard' | 'accounts' | 'transactions' | 'settings';

const NAV: Array<{ id: View; label: string; icon: string }> = [
  { id: 'dashboard', label: de.nav.dashboard, icon: '◧' },
  { id: 'accounts', label: de.nav.accounts, icon: '▤' },
  { id: 'transactions', label: de.nav.transactions, icon: '≡' },
  { id: 'settings', label: de.nav.settings, icon: '⚙' },
];

export function App() {
  const [view, setView] = useState<View>('dashboard');
  const [month, setMonth] = useState(currentMonthKey());
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState('');

  // Cmd/Ctrl+K focuses the search and jumps to transactions.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setView('transactions');
        requestAnimationFrame(() => document.getElementById('tx-search')?.focus());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex h-full">
      <aside
        className="flex flex-col border-r shrink-0 transition-all"
        style={{ width: collapsed ? 56 : 200, background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-2 px-4 h-14 border-b" style={{ borderColor: 'var(--border)' }}>
          <button
            className="text-lg cursor-pointer"
            style={{ color: 'var(--accent)' }}
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Aufklappen' : 'Einklappen'}
          >
            ⟨⟩
          </button>
          {!collapsed && <span className="font-semibold tracking-wide">{de.appName}</span>}
        </div>
        <nav className="flex-1 py-2">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setView(n.id)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left cursor-pointer"
              style={{
                color: view === n.id ? 'var(--text)' : 'var(--text-dim)',
                background: view === n.id ? 'var(--surface-2)' : 'transparent',
                borderLeft: view === n.id ? '2px solid var(--accent)' : '2px solid transparent',
              }}
            >
              <span aria-hidden>{n.icon}</span>
              {!collapsed && <span>{n.label}</span>}
            </button>
          ))}
        </nav>
        {!collapsed && (
          <div className="px-4 py-3 text-xs" style={{ color: 'var(--text-dim)' }}>
            {de.slogan}
          </div>
        )}
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header
          className="h-14 shrink-0 flex items-center justify-between px-5 border-b"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-2">
            <button className="btn px-2 py-1" onClick={() => setMonth(shiftMonth(month, -1))}>◀</button>
            <span className="font-medium min-w-40 text-center">{monthLabel(month)}</span>
            <button className="btn px-2 py-1" onClick={() => setMonth(shiftMonth(month, 1))}>▶</button>
            <button className="btn px-2 py-1 text-xs" onClick={() => setMonth(currentMonthKey())}>Heute</button>
          </div>
          <input
            className="input max-w-72"
            placeholder={de.common.searchPlaceholder}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setView('transactions'); }}
          />
        </header>

        <main className="flex-1 overflow-auto p-5">
          {view === 'dashboard' && <Dashboard month={month} onNavigate={setView} />}
          {view === 'accounts' && <Accounts />}
          {view === 'transactions' && <Transactions month={month} search={search} onSearch={setSearch} />}
          {view === 'settings' && <Settings />}
        </main>
      </div>
    </div>
  );
}
