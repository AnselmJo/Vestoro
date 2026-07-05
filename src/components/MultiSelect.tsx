import { useEffect, useRef, useState } from 'react';

export interface MultiSelectOption { id: string; label: string; }

/**
 * Compact multi-select: button shows a summary ("Alle", "3 ausgewählt", or the
 * single selected label), click opens a checkbox popover. Empty selection
 * means "alle" (no filter) — the convention used throughout Vestoro's scope.
 */
export function MultiSelect({ label, options, selected, onChange }: {
  label: string;
  options: MultiSelectOption[];
  selected: string[]; // empty = all
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const summary = selected.length === 0
    ? `${label}: Alle`
    : selected.length === 1
      ? options.find((o) => o.id === selected[0])?.label ?? label
      : `${label}: ${selected.length} ausgewählt`;

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  }

  return (
    <div className="relative" ref={ref}>
      <button className="input text-left flex items-center justify-between gap-2 max-w-48" onClick={() => setOpen(!open)}>
        <span className="truncate">{summary}</span>
        <span aria-hidden style={{ color: 'var(--text-dim)' }}>▾</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-1 z-40 card p-2 min-w-52 max-h-72 overflow-auto" style={{ background: 'var(--surface-2)' }}>
          <button
            className="w-full text-left px-2 py-1.5 rounded text-sm"
            style={{ background: selected.length === 0 ? 'var(--surface-3)' : 'transparent' }}
            onClick={() => onChange([])}
          >
            Alle
          </button>
          <div className="my-1" style={{ borderTop: '1px solid var(--border)' }} />
          {options.map((o) => (
            <label key={o.id} className="flex items-center gap-2 px-2 py-1.5 rounded text-sm cursor-pointer"
              style={{ background: 'transparent' }}>
              <input type="checkbox" checked={selected.includes(o.id)} onChange={() => toggle(o.id)} />
              <span className="truncate">{o.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
