import { useEffect, useState, useRef } from 'react';

export type Option = { id: string; label: string; meta?: string; color?: string };

export default function Typeahead({
  fetchOptions,
  onSelect,
  placeholder = 'Suchen...',
}: {
  fetchOptions: (q: string) => Promise<Option[]>;
  onSelect: (opt: Option) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState('');
  const [opts, setOpts] = useState<Option[]>([]);
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const ref = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    let alive = true;
    fetchOptions(q).then((r) => { if (alive) setOpts(r); }).catch(() => { if (alive) setOpts([]); });
    return () => { alive = false; };
  }, [q, fetchOptions]);

  function choose(o: Option) {
    onSelect(o);
    setQ('');
    setOpen(false);
  }

  return (
    <div className="relative inline-block w-56 text-left">
      <input
        ref={ref}
        className="input w-full text-xs"
        placeholder={placeholder}
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, opts.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
          if (e.key === 'Enter') { e.preventDefault(); if (opts[idx]) choose(opts[idx]); }
          if (e.key === 'Escape') { setOpen(false); }
        }}
      />
      {open && opts.length > 0 && (
        <div className="absolute z-20 mt-1 w-full bg-white border rounded shadow-sm max-h-60 overflow-auto">
          {opts.map((o, i) => (
            <div key={o.id} className={`p-2 cursor-pointer flex items-center gap-2 text-sm ${i === idx ? 'bg-surface-2' : ''}`} onMouseDown={(ev) => { ev.preventDefault(); choose(o); }}>
              {o.color ? <span style={{ width: 12, height: 12, background: o.color, borderRadius: 4 }} /> : null}
              <div className="truncate">{o.label}</div>
              {o.meta ? <div className="text-xs mono text-dim truncate">{o.meta}</div> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
