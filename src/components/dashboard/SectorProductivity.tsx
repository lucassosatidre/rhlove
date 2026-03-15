import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { SectorMetric } from '@/lib/dashboardEngine';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Button } from '@/components/ui/button';
import type { SectorMetric } from '@/lib/dashboardEngine';

const SECTOR_LABELS: Record<string, string> = {
  'COZINHA': 'Cozinha',
  'SALÃO': 'Salão',
  'TELE - ENTREGA': 'Tele',
  'DIURNO': 'Diurno',
};

export default function SectorProductivity({ data }: { data: SectorMetric[] }) {
  const [mode, setMode] = useState<'pcs' | 'tcs'>('pcs');

  const chartData = data.map(d => ({
    sector: SECTOR_LABELS[d.sector] || d.sector,
    value: mode === 'pcs' ? d.pcs : d.tcs,
    pessoas: d.pessoas,
  }));

  const chartConfig = {
    value: {
      label: mode === 'pcs' ? 'Pedidos/Colaborador' : 'Ticket/Colaborador (R$)',
      color: 'hsl(var(--primary))',
    },
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Produtividade por Setor</CardTitle>
          <div className="flex gap-1 no-print">
            <Button size="sm" variant={mode === 'pcs' ? 'default' : 'outline'} onClick={() => setMode('pcs')} className="h-7 text-xs px-3">PCS</Button>
            <Button size="sm" variant={mode === 'tcs' ? 'default' : 'outline'} onClick={() => setMode('tcs')} className="h-7 text-xs px-3">TCS</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[220px] w-full">
          <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
            <XAxis dataKey="sector" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
