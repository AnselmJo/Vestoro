import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

// ECharts is dynamically imported inside Chart to keep the main bundle small.
export function Kpi({ label, value, tone, delta }: {
  label: string; value: string; tone?: 'income' | 'expense' | 'accent'; delta?: number | null;
}) {
  const color = tone === 'income' ? 'var(--income)' : tone === 'expense' ? 'var(--expense)'
    : tone === 'accent' ? 'var(--accent)' : 'var(--text)';
  return (
    <div className="card p-4 flex-1 min-w-44">
      <div className="text-xs mb-1" style={{ color: 'var(--text-dim)' }}>{label}</div>
      <div className="mono text-xl font-medium" style={{ color }}>{value}</div>
      {delta !== undefined && delta !== null && Number.isFinite(delta) && (
        <div className="text-xs mt-1 mono" style={{ color: delta >= 0 ? 'var(--income)' : 'var(--expense)' }}>
          {delta >= 0 ? '▲' : '▼'} {Math.abs(delta * 100).toFixed(1).replace('.', ',')} %
        </div>
      )}
    </div>
  );
}

export function Seg<T extends string>({ options, value, onChange }: {
  options: Array<{ id: T; label: string }>; value: T; onChange: (v: T) => void;
}) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.id} className={value === o.id ? 'active' : ''} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Thin ECharts wrapper: re-renders when option changes, resizes with the window. */
export function Chart({ option, height = 320, onNodeClick }: { option: any; height?: number; onNodeClick?: (name: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    let mounted = true;
    let chart: any = null;

    async function init() {
      if (!ref.current) return;
      await Promise.all([
        import('echarts/core'),
        import('echarts/charts'),
        import('echarts/components'),
        import('echarts/renderers'),
      ]);
      // Register commonly used charts/components
      try {
        const { use: echartsUse } = await import('echarts/core');
        const { SankeyChart, BarChart, LineChart, PieChart } = await import('echarts/charts');
        const { GridComponent, TooltipComponent, LegendComponent } = await import('echarts/components');
        const { CanvasRenderer } = await import('echarts/renderers');
        echartsUse([SankeyChart, BarChart, LineChart, PieChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);
      } catch (e) {
        // ignore registration errors
      }

      const { init: echartsInit } = await import('echarts/core');
      chart = echartsInit(ref.current);
      chartRef.current = chart;

      const onResize = () => chart?.resize();
      window.addEventListener('resize', onResize);
      const handler = (params: any) => {
        const name = params?.name ?? params?.data?.name;
        if (name && typeof onNodeClick === 'function') onNodeClick(name);
      };
      chart.on('click', handler);

      if (mounted) chart.setOption(option, { notMerge: true });

      return () => {
        window.removeEventListener('resize', onResize);
        chart?.off('click', handler);
        try { chart?.dispose(); } catch (e) { /* noop */ }
      };
    }

    const cleanupPromise = init();
    return () => { mounted = false; cleanupPromise.then((fn) => fn && fn()); };
  }, []); // intentionally run once

  useEffect(() => {
    if (chartRef.current) chartRef.current.setOption(option, { notMerge: true });
  }, [option]);

  return <div ref={ref} style={{ height }} />;
}

export function Modal({ title, onClose, children, wide, autoFocusFirst = false }: {
  title: string; onClose: () => void; children: ReactNode; wide?: boolean; autoFocusFirst?: boolean;
}) {
  // handle Escape and initial focus
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!autoFocusFirst || !ref.current) return;
    const focusable = ref.current.querySelector<HTMLElement>('button,input,select,textarea,[tabindex]');
    if (focusable) focusable.focus();
  }, [autoFocusFirst]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.65)' }} onClick={onClose}>
      <div ref={ref} className={`card p-5 w-full ${wide ? 'max-w-4xl' : 'max-w-2xl'} max-h-[85vh] overflow-auto`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-base">{title}</h2>
          <button className="btn px-2 py-1" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// --- Toast system ---
import { createContext, useContext, useCallback, useState } from 'react';

type ToastAction = { label: string; onClick: () => void | Promise<void> };
type Toast = { id: string; message: string; tone?: 'info'|'error'|'success'; action?: ToastAction };
const ToastCtx = createContext<{ add: (t: Omit<Toast,'id'>) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const add = useCallback((t: Omit<Toast,'id'>) => {
    const id = crypto.randomUUID();
    setToasts((s) => [...s, { id, ...t }]);
    setTimeout(() => setToasts((s) => s.filter((x) => x.id !== id)), 6000);
  }, []);
  return (
    <ToastCtx.Provider value={{ add }}>
      {children}
      <div className="fixed right-4 bottom-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className="px-3 py-2 rounded shadow flex items-center gap-3" style={{ background: t.tone === 'error' ? '#fee2e2' : '#f1f5f9', color: '#0f1724' }}>
            <div className="flex-1">{t.message}</div>
            {t.action && (
              <button className="btn btn-ghost btn-sm" onClick={async () => { try { await t.action!.onClick(); } catch (e) { /* ignore */ } setToasts((s) => s.filter((x) => x.id !== t.id)); }}>{t.action.label}</button>
            )}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
