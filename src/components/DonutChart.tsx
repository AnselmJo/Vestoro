import { Seg, Chart } from './ui';

export function DonutChart({ data, centerLabel, groupOptions, activeGroup, onGroupChange, onSliceClick, height = 320 }:{
  data?: { name: string; value: number }[];
  centerLabel: string;
  groupOptions: { id: string; label: string }[];
  activeGroup: string;
  onGroupChange: (id: string) => void;
  onSliceClick?: (name: string) => void;
  height?: number;
}) {
  const d = data ?? [];
  const total = d.reduce((s, it) => s + it.value, 0);
  const titleLines = [centerLabel, `${total.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`];

  const option = {
    tooltip: { trigger: 'item', valueFormatter: (v:number) => `${v.toLocaleString('de-DE')} €` },
    legend: { show: false },
    title: [
      { text: titleLines[0], left: 'center', top: '40%', textStyle: { fontSize: 12, color: '#9aa3ad' } },
      { text: titleLines[1], left: 'center', top: '48%', textStyle: { fontSize: 18, fontWeight: '700', color: '#0f1724' } },
    ],
    series: [
      {
        type: 'pie',
        radius: ['55%', '80%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: false,
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } },
        data: d.map((x) => ({ name: x.name, value: x.value })),
      },
    ],
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <Seg options={groupOptions.map((o) => ({ id: o.id, label: o.label }))} value={activeGroup as any} onChange={(v) => onGroupChange(v as any)} />
      </div>
      <Chart option={option} height={height} onNodeClick={onSliceClick} />
    </div>
  );
}
