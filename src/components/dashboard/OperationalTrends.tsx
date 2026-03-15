import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import type { MonthlyTrend } from '@/lib/dashboardEngine';

const chartConfig = {
  pedidos: { label: 'Pedidos', color: 'hsl(220, 65%, 50%)' },
  faturamento: { label: 'Faturamento', color: 'hsl(152, 55%, 38%)' },
  produtividade: { label: 'Produtividade', color: 'hsl(24, 90%, 50%)' },
  colaboradores: { label: 'Colaboradores', color: 'hsl(280, 60%, 50%)' },
  freelancers: { label: 'Free-lancers', color: 'hsl(38, 92%, 50%)' },
};

export default function OperationalTrends({ data }: { data: MonthlyTrend[] }) {
  if (data.length === 0) {
    return (
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Tendências Operacionais</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">Dados insuficientes para tendências.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Tendências Operacionais</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[250px] w-full">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line type="monotone" dataKey="pedidos" stroke="hsl(220, 65%, 50%)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="faturamento" stroke="hsl(152, 55%, 38%)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="colaboradores" stroke="hsl(280, 60%, 50%)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="freelancers" stroke="hsl(38, 92%, 50%)" strokeWidth={2} dot={false} />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
