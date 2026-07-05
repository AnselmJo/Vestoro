import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { setSetting } from '../db/repo';
import { de } from '../i18n/de';
import { MultiSelect } from '../components/MultiSelect';
import { UncategorizedBanner } from '../components/UncategorizedBanner';
import { Dashboard } from '../views/Dashboard';
import { Accounts } from '../views/Accounts';
import { Transactions } from '../views/Transactions';
import RulesManagerPage from '../views/RulesManager';
import { Settings } from '../views/Settings';
import { Calculators } from '../views/Calculators';
import { ComingSoon } from '../views/ComingSoon';

export type View =
  | 'dashboard' | 'transactions' | 'accounts' | 'rules'
  | 'calculators' | 'budgets' | 'goals'
  | 'portfolio' | 'contracts' | 'reports'
  | 'settings';

/** Global filters shared by all views. Empty arrays mean "no filter / all". */
export interface Scope {
  demoMode: boolean;
  personIds: string[];
  accountIds: string[];
  includeTransfers: boolean;
}

interface NavItem { id: View; label: string; icon: string; soon?: boolean; }
interface NavGroup { label: string; items: NavItem[]; collapsible?: boolean; }

const NAV: NavGroup[] = [
  {
    label: de.nav.overview,
    items: [
      { id: 'dashboard', label: de.nav.dashboard, icon: '◧' },
      { id: 'transactions', label: de.nav.transactions, icon: '≡' },
      { id: 'rules', label: 'Kategorien & Regeln', icon: '⚙' },
      { id: 'accounts', label: de.nav.accounts, icon: '▤' },
    ],
  },
  {
    label: de.nav.planning, collapsible: true,
    items: [
      { id: 'calculators', label: de.nav.calculators, icon: '∑' },
      { id: 'budgets', label: de.nav.budgets, icon: '◔', soon: true },
      { id: 'goals', label: de.nav.goals, icon: '◎', soon: true },
    ],
  },
  {
    label: de.nav.wealth, collapsible: true,
    items: [
      { id: 'portfolio', label: de.nav.portfolio, icon: '▲', soon: true },
      { id: 'contracts', label: de.nav.contracts, icon: '§', soon: true },
      { id: 'reports', label: de.nav.reports, icon: '✦', soon: true },
    ],
  },
];

const TITLES: Record<View, string> = {
  dashboard: de.nav.dashboard, transactions: de.nav.transactions, accounts: de.nav.accounts,
  calculators: de.nav.calculators, budgets: de.nav.budgets, goals: de.nav.goals,
  portfolio: de.nav.portfolio, contracts: de.nav.contracts, reports: de.nav.reports,
  rules: 'Kategorien & Regeln',
  settings: de.nav.settings,
};

export function App({ initialDemoMode }: { initialDemoMode: boolean }) {
  const [view, setView] = useState<View>('dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');
  const [demoMode, setDemoModeState] = useState(initialDemoMode);
  const [personIds, setPersonIds] = useState<string[]>([]);
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [includeTransfers, setIncludeTransfers] = useState(false);

  const persons = useLiveQuery(() => db.persons.toArray(), []) ?? [];
  const accounts = useLiveQuery(() => db.accounts.toArray(), []) ?? [];
  const scopedAccounts = accounts.filter(
    (a) => (a.isDemo ?? false) === demoMode && (personIds.length === 0 || personIds.includes(a.personId)),
  );

  const scope: Scope = { demoMode, personIds, accountIds, includeTransfers };

  function setDemoMode(v: boolean) {
    setDemoModeState(v);
    setAccountIds([]);
    void setSetting('demoMode', v);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setView('transactions');
        requestAnimationFrame(() => document.getElementById('tx-search')?.focus());
      }
    };
    const onNav = (e: Event) => {
      try {
        // allow programmatic navigation: dispatch new CustomEvent('navigate', { detail: 'rules' })
        // detail must be a valid view
        // @ts-ignore
        const d = (e as CustomEvent).detail;
        if (typeof d === 'string') setView(d as View);
      } catch (_) { }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('navigate', onNav as EventListener);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('navigate', onNav as EventListener); };
  }, []);

  return (
    <div className="flex h-full">
      <aside
        className="flex flex-col border-r shrink-0 transition-all overflow-y-auto"
        style={{ width: collapsed ? 60 : 216, background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-2.5 px-4 h-14 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" className="w-6 h-6 cursor-pointer"
            onClick={() => setCollapsed(!collapsed)} />
          {!collapsed && <span className="font-semibold tracking-wide">{de.appName}</span>}
        </div>
        <nav className="flex-1 py-1">
          {NAV.map((group) => {
            const isOpen = openGroups[group.label] ?? true;
            return (
              <div key={group.label}>
                {!collapsed && (
                  <button
                    className="navgroup w-full flex items-center justify-between pr-4 cursor-pointer"
                    onClick={() => group.collapsible && setOpenGroups({ ...openGroups, [group.label]: !isOpen })}
                  >
                    <span>{group.label}</span>
                    {group.collapsible && <span style={{ fontSize: 9 }}>{isOpen ? '▾' : '▸'}</span>}
                  </button>
                )}
                {(isOpen || collapsed) && group.items.map((n) => (
                  <button key={n.id} onClick={() => setView(n.id)}
                    className={`navlink ${view === n.id ? 'active' : ''}`} title={n.label}>
                    <span aria-hidden className="w-4 text-center">{n.icon}</span>
                    {!collapsed && <span>{n.label}</span>}
                    {!collapsed && n.soon && <span className="badge-soon">{de.nav.soon}</span>}
                  </button>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="border-t shrink-0" style={{ borderColor: 'var(--border)' }}>
          <button onClick={() => setView('settings')}
            className={`navlink ${view === 'settings' ? 'active' : ''}`} title={de.nav.settings}>
            <span aria-hidden className="w-4 text-center">⚙</span>
            {!collapsed && <span>{de.nav.settings}</span>}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header
          className="h-14 shrink-0 flex items-center justify-between gap-3 px-5 border-b"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-2.5">
            <h1 className="font-semibold text-base">{TITLES[view]}</h1>
            {demoMode && (
              <button
                className="text-xs px-2.5 py-1 rounded-full"
                style={{ background: 'var(--surface-3)', color: 'var(--accent-strong)', border: '1px solid var(--border)' }}
                title="Zu deinen eigenen Daten wechseln"
                onClick={() => setDemoMode(false)}
              >
                {de.header.demoMode} · zu meinen Daten →
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {persons.length > 1 && (
              <MultiSelect label={de.header.person} selected={personIds} onChange={setPersonIds}
                options={persons.map((p) => ({ id: p.id, label: p.name }))} />
            )}
            <MultiSelect label={de.header.account} selected={accountIds} onChange={setAccountIds}
              options={scopedAccounts.map((a) => ({ id: a.id, label: a.name }))} />
          </div>
        </header>

        <main className="flex-1 overflow-auto p-5">
          <UncategorizedBanner scope={scope} onOpenTransactions={() => setView('transactions')} />
          {view === 'dashboard' && <Dashboard scope={scope} onNavigate={setView} setIncludeTransfers={setIncludeTransfers} />}
          {view === 'transactions' && <Transactions scope={scope} search={search} onSearch={setSearch} />}
          {view === 'rules' && <RulesManagerPage />}
          {view === 'accounts' && <Accounts scope={scope} />}
          {view === 'calculators' && <Calculators scope={scope} />}
          {view === 'settings' && <Settings />}
          {(view === 'budgets' || view === 'goals' || view === 'portfolio' || view === 'contracts' || view === 'reports') && (
            <ComingSoon title={TITLES[view]} />
          )}
        </main>
      </div>
    </div>
  );
}
