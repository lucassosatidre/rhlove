import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { BlockMetrics } from '@/lib/dashboardEngine';

function formatCurrency(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function pctChange(current: number, prev: number): number {
  if (prev === 0) return current > 0 ? 100 : 0;
  return ((current - prev) / prev) * 100;
}

function TrendIndicator({ current, prev }: { current: number; prev: number }) {
  const change = pctChange(current, prev);
  const abs = Math.abs(change);
  if (abs < 0.5) {
    return <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground"><Minus className="w-3 h-3" /> 0%</span>;
  }
  const isUp = change > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${isUp ? 'text-emerald-600' : 'text-red-500'}`}>
      {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {abs.toFixed(1)}%
    </span>
  );
}

const SECTOR_LABELS: Record<string, string> = {
  'COZINHA': 'Cozinha',
  'SALÃO': 'Salão',
  'TELE - ENTREGA': 'Tele-entrega',
  'DIURNO': 'Diurno',
};

interface Props {
  title: string;
  periodLabel: string;
  comparisonLabel: string;
  data: BlockMetrics;
  isAverage?: boolean;
}

export default function MetricBlock({ title, periodLabel, comparisonLabel, data, isAverage }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        <CardDescription className="text-xs">
          Período: {periodLabel} · {comparisonLabel}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pedidos por colaborador por setor */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Pedidos por colaborador do setor</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {data.sectors.map(s => (
              <div key={s.sector + '-ped'} className="rounded-lg border border-border/60 p-3">
                <p className="text-[11px] text-muted-foreground font-medium mb-1">{SECTOR_LABELS[s.sector] || s.sector}</p>
                <p className="text-lg font-bold text-foreground leading-none">{s.pedidos.toFixed(2)}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-muted-foreground">ant: {s.prevPedidos.toFixed(2)}</span>
                  <TrendIndicator current={s.pedidos} prev={s.prevPedidos} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Ticket por colaborador por setor */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Ticket por colaborador do setor</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {data.sectors.map(s => (
              <div key={s.sector + '-tkt'} className="rounded-lg border border-border/60 p-3">
                <p className="text-[11px] text-muted-foreground font-medium mb-1">{SECTOR_LABELS[s.sector] || s.sector}</p>
                <p className="text-lg font-bold text-foreground leading-none">{formatCurrency(s.ticket)}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-muted-foreground">ant: {formatCurrency(s.prevTicket)}</span>
                  <TrendIndicator current={s.ticket} prev={s.prevTicket} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Resultado do time */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Resultado do time</h3>
          <div className="grid grid-cols-2 gap-3 max-w-md">
            <div className="rounded-lg border border-border/60 p-3">
              <p className="text-[11px] text-muted-foreground font-medium mb-1">Pedidos p/ colab.</p>
              <p className="text-lg font-bold text-foreground leading-none">{data.team.pedidos.toFixed(2)}</p>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-muted-foreground">ant: {data.team.prevPedidos.toFixed(2)}</span>
                <TrendIndicator current={data.team.pedidos} prev={data.team.prevPedidos} />
              </div>
            </div>
            <div className="rounded-lg border border-border/60 p-3">
              <p className="text-[11px] text-muted-foreground font-medium mb-1">Ticket p/ colab.</p>
              <p className="text-lg font-bold text-foreground leading-none">{formatCurrency(data.team.ticket)}</p>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-muted-foreground">ant: {formatCurrency(data.team.prevTicket)}</span>
                <TrendIndicator current={data.team.ticket} prev={data.team.prevTicket} />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
