import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Checkbox } from '@/components/ui/checkbox';
import type { DailyEvolution } from '@/lib/dashboardEngine';

const LINES = [
  { key: 'pedidos', label: 'Pedidos', color: 'hsl(220, 65%, 50%)' },
  { key: 'faturamento', label: 'Faturamento', color: 'hsl(152, 55%, 38%)' },
  { key: 'pct', label: 'Pedidos p/ colab. do time', color: 'hsl(24, 90%, 50%)' },
  { key: 'tct', label: 'Ticket p/ colab. do time', color: 'hsl(280, 60%, 50%)' },
] as const;

export default function OperationEvolution({ data }: { data: DailyEvolution[] }) {
  const [active, setActive] = useState<Set<string>>(new Set(['pedidos', 'faturamento']));

  const toggle = (key: string) => {
    const next = new Set(active);
    if (next.has(key)) next.delete(key); else next.add(key);
    setActive(next);
  };

  const chartConfig: Record<string, { label: string; color: string }> = {};
  LINES.forEach(l => { chartConfig[l.key] = { label: l.label, color: l.color }; });

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm font-semibold">Evolução da Operação</CardTitle>
          <div className="flex items-center gap-3 no-print">
            {LINES.map(l => (
              <label key={l.key} className="flex items-center gap-1.5 text-xs cursor-pointer">
                <Checkbox checked={active.has(l.key)} onCheckedChange={() => toggle(l.key)} className="w-3.5 h-3.5" />
                <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: l.color }} />
                {l.label}
              </label>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[250px] w-full">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
            <XAxis dataKey="dateLabel" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <ChartTooltip content={<ChartTooltipContent />} />
            {LINES.filter(l => active.has(l.key)).map(l => (
              <Line key={l.key} type="monotone" dataKey={l.key} stroke={l.color} strokeWidth={2} dot={false} />
            ))}
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
