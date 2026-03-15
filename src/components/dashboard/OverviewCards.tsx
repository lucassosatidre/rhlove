import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Users, BarChart3, Ticket } from 'lucide-react';
import type { OverviewMetrics } from '@/lib/dashboardEngine';

function pctChange(current: number, prev: number): number {
  if (prev === 0) return current > 0 ? 100 : 0;
  return ((current - prev) / prev) * 100;
}

function TrendBadge({ current, prev }: { current: number; prev: number }) {
  const change = pctChange(current, prev);
  const isUp = change >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${isUp ? 'text-emerald-600' : 'text-red-500'}`}>
      {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {Math.abs(change).toFixed(1)}%
    </span>
  );
}

function formatCurrency(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function OverviewCards({ data }: { data: OverviewMetrics }) {
  const cards = [
    { label: 'Faturamento', value: formatCurrency(data.faturamento), current: data.faturamento, prev: data.prevFaturamento, icon: DollarSign },
    { label: 'Pedidos', value: data.pedidos.toLocaleString('pt-BR'), current: data.pedidos, prev: data.prevPedidos, icon: ShoppingCart },
    { label: 'Colaboradores', value: data.colaboradores.toString(), current: data.colaboradores, prev: data.prevColaboradores, icon: Users },
    { label: 'Pedidos por colaborador do time', value: data.pct.toFixed(2), current: data.pct, prev: data.prevPct, icon: BarChart3 },
    { label: 'Ticket por colaborador do time', value: formatCurrency(data.tct), current: data.tct, prev: data.prevTct, icon: Ticket },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      {cards.map(c => (
        <Card key={c.label} className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{c.label}</span>
              <c.icon className="w-4 h-4 text-muted-foreground/50" />
            </div>
            <p className="text-lg font-bold text-foreground leading-none mb-1">{c.value}</p>
            <TrendBadge current={c.current} prev={c.prev} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
