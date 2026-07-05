import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { SankeyChart, BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { ReactNode } from 'react';

echarts.use([SankeyChart, BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

export function Kpi({ label, value, tone }: { label: string; value: string; tone?: 'income' | 'expense' | 'accent' }) {
  const color = tone === 'income' ? 'var(--income)' : tone === 'expense' ? 'var(--expense)' : tone === 'accent' ? 'var(--accent)' : 'var(--text)';
  return (
    <div className="card p-4 flex-1 min-w-40">
      <div className="text-xs mb-1" style={{ color: 'var(--text-dim)' }}>{label}</div>
      <div className="mono text-xl font-medium" style={{ color }}>{value}</div>
    </div>
  );
}

/** Thin ECharts wrapper: re-renders when option changes, resizes with the window. */
export function Chart({ option, height = 320 }: { option: echarts.EChartsCoreOption; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    chart.current = echarts.init(ref.current);
    const onResize = () => chart.current?.resize();
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); chart.current?.dispose(); };
  }, []);

  useEffect(() => {
    chart.current?.setOption(option, { notMerge: true });
  }, [option]);

  return <div ref={ref} style={{ height }} />;
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="card p-5 w-full max-w-2xl max-h-[85vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-base">{title}</h2>
          <button className="btn px-2 py-1" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
