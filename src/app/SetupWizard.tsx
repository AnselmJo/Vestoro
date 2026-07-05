import { useState } from 'react';
import { db } from '../db/schema';
import { setSetting, createPerson } from '../db/repo';
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
  const [step, setStep] = useState<'name' | 'people' | 'done'>('name');
  const [others, setOthers] = useState<string[]>([]);
  const [newPerson, setNewPerson] = useState('');

  async function applySetup(startInDemo: boolean) {
    setBusy(true);
    // rename existing primary person
    const person = await db.persons.toCollection().first();
    if (person) await db.persons.update(person.id, { name: name.trim() || 'Ich' });
    // create additional persons
    for (const p of others.map((s) => s.trim()).filter(Boolean)) {
      // avoid duplicating the primary name
      if (p === (name.trim() || 'Ich')) continue;
      await createPerson(p);
    }
    await setSetting('setupDone', true);
    await setSetting('demoMode', startInDemo);
    if (startInDemo) await loadDemoData();
    onDone(startInDemo);
  }

  function addOther() {
    const v = newPerson.trim();
    if (!v) return;
    setOthers((s) => [...s, v]);
    setNewPerson('');
  }

  return (
    <div className="h-full flex items-center justify-center p-6" style={{ background: 'var(--bg)' }}>
      <div className="card p-8 max-w-md w-full text-center">
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" className="w-14 h-14 mx-auto mb-4" />
        <h1 className="text-xl font-semibold mb-1">Willkommen bei Vestoro</h1>

        {step === 'name' && (
          <>
            <p className="text-sm mb-6" style={{ color: 'var(--text-dim)' }}>
              Bevor es losgeht: Wie sollen wir dich nennen?
            </p>
            <input
              className="input mb-5 text-center"
              placeholder="Dein Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && name.trim() && setStep('people')}
              autoFocus
            />
            <div className="flex flex-col gap-2.5">
              <button className="btn btn-primary" disabled={busy || !name.trim()} onClick={() => setStep('people')}>
                Weiter
              </button>
              <button className="btn" disabled={busy} onClick={() => setStep('people')}>
                Überspringen
              </button>
            </div>
            <p className="text-xs mt-5" style={{ color: 'var(--text-dim)' }}>
              Demo- und eigene Daten sind strikt getrennt. Du kannst später jederzeit in
              den Einstellungen zwischen beiden wechseln.
            </p>
          </>
        )}

        {step === 'people' && (
          <>
            <p className="text-sm mb-3" style={{ color: 'var(--text-dim)' }}>Weitere Personen hinzufügen? (optional — 2–4 reichen meist)</p>
            <div className="flex gap-2 mb-3">
              <input className="input" placeholder="Name hinzufügen" value={newPerson} onChange={(e) => setNewPerson(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addOther()} />
              <button className="btn" onClick={addOther}>+</button>
            </div>
            <div className="mb-4">
              {others.length === 0 ? <div className="text-xs" style={{ color: 'var(--text-dim)' }}>Keine zusätzlichen Personen</div>
                : <ul className="text-sm" style={{ textAlign: 'left' }}>{others.map((o, i) => <li key={i}>{o} <button className="btn btn-ghost btn-xs" onClick={() => setOthers((s) => s.filter((_, idx) => idx !== i))}>✕</button></li>)}</ul>}
            </div>
            <div className="flex gap-2 justify-end">
              <button className="btn" disabled={busy} onClick={() => setStep('name')}>Zurück</button>
              <button className="btn btn-primary" disabled={busy} onClick={() => applySetup(false)}>Fertig (ohne Demo)</button>
              <button className="btn" disabled={busy} onClick={() => applySetup(true)}>Demo ansehen</button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
