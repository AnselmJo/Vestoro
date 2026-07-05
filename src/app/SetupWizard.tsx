import { useState } from 'react';
import { db } from '../db/schema';
import { setSetting } from '../db/repo';
import { loadDemoData } from '../lib/demo';

/**
 * Shown exactly once, before the first render of the real app. Replaces the
 * hardcoded "Ich" person with the user's actual name and lets them choose
 * whether to explore a click-through demo first or start empty with their
 * own data right away.
 */
export function SetupWizard({ onDone }: { onDone: (demoMode: boolean) => void }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  async function finish(startInDemo: boolean) {
    setBusy(true);
    const person = await db.persons.toCollection().first();
    if (person) await db.persons.update(person.id, { name: name.trim() || 'Ich' });
    await setSetting('setupDone', true);
    await setSetting('demoMode', startInDemo);
    if (startInDemo) await loadDemoData();
    onDone(startInDemo);
  }

  return (
    <div className="h-full flex items-center justify-center p-6" style={{ background: 'var(--bg)' }}>
      <div className="card p-8 max-w-md w-full text-center">
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" className="w-14 h-14 mx-auto mb-4" />
        <h1 className="text-xl font-semibold mb-1">Willkommen bei Vestoro</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--text-dim)' }}>
          Bevor es losgeht: Wie sollen wir dich nennen?
        </p>
        <input
          className="input mb-5 text-center"
          placeholder="Dein Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && name.trim() && finish(false)}
          autoFocus
        />
        <div className="flex flex-col gap-2.5">
          <button className="btn btn-primary" disabled={busy || !name.trim()} onClick={() => finish(false)}>
            Direkt mit meinen eigenen Daten starten
          </button>
          <button className="btn" disabled={busy} onClick={() => finish(true)}>
            Erst die Demo ansehen
          </button>
        </div>
        <p className="text-xs mt-5" style={{ color: 'var(--text-dim)' }}>
          Demo- und eigene Daten sind strikt getrennt. Du kannst später jederzeit in
          den Einstellungen zwischen beiden wechseln.
        </p>
      </div>
    </div>
  );
}
