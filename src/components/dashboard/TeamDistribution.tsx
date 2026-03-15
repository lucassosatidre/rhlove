import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import type { TeamDistData } from '@/lib/dashboardEngine';

const SECTOR_LABELS: Record<string, string> = {
  'COZINHA': 'Cozinha',
  'SALÃO': 'Salão',
  'TELE - ENTREGA': 'Tele',
  'DIURNO': 'Diurno',
};

interface Props {
  data: TeamDistData[];
  freelancerWeek: number;
  freelancerMonth: number;
}

export default function TeamDistribution({ data, freelancerWeek, freelancerMonth }: Props) {
  const chartData = data.map(d => ({
    sector: SECTOR_LABELS[d.sector] || d.sector,
    colaboradores: d.colaboradores,
    freelancers: d.freelancers,
  }));

  const chartConfig = {
    colaboradores: { label: 'Colaboradores', color: 'hsl(220, 65%, 50%)' },
    freelancers: { label: 'Free-lancers', color: 'hsl(24, 90%, 50%)' },
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Distribuição de Equipe</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[220px] w-full">
          <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
            <XAxis dataKey="sector" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="colaboradores" fill="hsl(220, 65%, 50%)" radius={[4, 4, 0, 0]} maxBarSize={32} />
            <Bar dataKey="freelancers" fill="hsl(24, 90%, 50%)" radius={[4, 4, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ChartContainer>
        <div className="flex gap-6 mt-3 text-xs text-muted-foreground">
          <span>Free-lancers na semana: <strong className="text-foreground">{freelancerWeek}</strong></span>
          <span>Free-lancers no mês: <strong className="text-foreground">{freelancerMonth}</strong></span>
        </div>
      </CardContent>
    </Card>
  );
}
