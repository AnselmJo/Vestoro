import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { SankeyChart, BarChart, LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { ReactNode } from 'react';

echarts.use([SankeyChart, BarChart, LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

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
export function Chart({ option, height = 320, onNodeClick }: { option: echarts.EChartsCoreOption; height?: number; onNodeClick?: (name: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    chart.current = echarts.init(ref.current);
    const onResize = () => chart.current?.resize();
    window.addEventListener('resize', onResize);
    const handler = (params: any) => {
      // ECharts click payload contains name for nodes
      const name = params?.name ?? params?.data?.name;
      if (name && typeof onNodeClick === 'function') onNodeClick(name);
    };
    chart.current.on('click', handler);
    return () => { window.removeEventListener('resize', onResize); chart.current?.off('click', handler); chart.current?.dispose(); };
  }, []);

  useEffect(() => {
    chart.current?.setOption(option, { notMerge: true });
  }, [option]);

  return <div ref={ref} style={{ height }} />;
}

export function Modal({ title, onClose, children, wide }: {
  title: string; onClose: () => void; children: ReactNode; wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.65)' }} onClick={onClose}>
      <div className={`card p-5 w-full ${wide ? 'max-w-4xl' : 'max-w-2xl'} max-h-[85vh] overflow-auto`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-base">{title}</h2>
          <button className="btn px-2 py-1" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
