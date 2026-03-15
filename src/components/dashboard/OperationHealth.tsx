import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { HealthMetric } from '@/lib/dashboardEngine';

export default function OperationHealth({ metrics }: { metrics: HealthMetric[] }) {
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Saúde da Operação</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {metrics.map((m, i) => {
            const diff = m.current - m.average;
            const isUp = diff > 0.01;
            const isDown = diff < -0.01;
            return (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{m.label}</span>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-foreground">
                    {m.unit === 'R$' ? m.current.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : m.current.toFixed(2)} 
                  </span>
                  <span className="text-muted-foreground/60">
                    média: {m.unit === 'R$' ? m.average.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : m.average.toFixed(2)}
                  </span>
                  {isUp && <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />}
                  {isDown && <TrendingDown className="w-3.5 h-3.5 text-red-500" />}
                  {!isUp && !isDown && <Minus className="w-3.5 h-3.5 text-muted-foreground/40" />}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
