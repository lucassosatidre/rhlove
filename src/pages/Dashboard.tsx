import { useMemo } from 'react';
import { useDailySales } from '@/hooks/useDailySales';
import { useCollaborators } from '@/hooks/useCollaborators';
import { useFreelancers } from '@/hooks/useFreelancers';
import { useScheduledVacations } from '@/hooks/useScheduledVacations';
import { Loader2, CalendarDays, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import TopKPICards from '@/components/dashboard/TopKPICards';
import MetricBlock from '@/components/dashboard/MetricBlock';
import MonthlyComparison from '@/components/dashboard/MonthlyComparison';
import { computeBlockMetrics, type BlockMetrics } from '@/lib/dashboardEngine';

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const DIAS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

export default function Dashboard() {
  const { usuario } = useAuth();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateStr = today.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const dayOfWeek = DIAS[today.getDay()];

  // Yesterday
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = fmt(yesterday);

  // Same weekday last week (for top KPI comparison)
  const sameWeekdayPrev = new Date(yesterday);
  sameWeekdayPrev.setDate(sameWeekdayPrev.getDate() - 7);
  const sameWeekdayPrevStr = fmt(sameWeekdayPrev);

  // 7-day range: yesterday back 7 days
  const start7 = new Date(yesterday);
  start7.setDate(start7.getDate() - 6);
  const prev7End = new Date(start7);
  prev7End.setDate(prev7End.getDate() - 1);
  const prev7Start = new Date(prev7End);
  prev7Start.setDate(prev7Start.getDate() - 6);

  // 30-day range: yesterday back 30 days
  const start30 = new Date(yesterday);
  start30.setDate(start30.getDate() - 29);
  const prev30End = new Date(start30);
  prev30End.setDate(prev30End.getDate() - 1);
  const prev30Start = new Date(prev30End);
  prev30Start.setDate(prev30Start.getDate() - 29);

  // Broad range: cover previous month start (for monthly comparison) and prev30
  const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const earliestNeeded = prevMonthStart < prev30Start ? prevMonthStart : prev30Start;
  const broadStart = fmt(earliestNeeded);
  const broadEnd = fmt(yesterday);

  const { data: allSales = [], isLoading: loadingSales } = useDailySales(broadStart, broadEnd);
  const { data: collaborators = [], isLoading: loadingCollab } = useCollaborators();
  const { data: freelancers = [] } = useFreelancers(broadStart, broadEnd);
  const { data: scheduledVacations = [] } = useScheduledVacations();

  const loading = loadingSales || loadingCollab;

  // Helper to filter sales/freelancers by date range
  const filterByRange = (start: string, end: string) => ({
    sales: allSales.filter(s => s.date >= start && s.date <= end),
    fl: freelancers.filter(f => f.date >= start && f.date <= end),
  });

  // Yesterday metrics
  const yesterdayData = useMemo(() => {
    const curr = filterByRange(yesterdayStr, yesterdayStr);
    const prev = filterByRange(sameWeekdayPrevStr, sameWeekdayPrevStr);
    return computeBlockMetrics(curr.sales, prev.sales, collaborators, curr.fl, prev.fl, scheduledVacations);
  }, [allSales, freelancers, collaborators, scheduledVacations, yesterdayStr, sameWeekdayPrevStr]);

  // 7-day avg metrics
  const avg7Data = useMemo(() => {
    const curr = filterByRange(fmt(start7), fmt(yesterday));
    const prev = filterByRange(fmt(prev7Start), fmt(prev7End));
    return computeBlockMetrics(curr.sales, prev.sales, collaborators, curr.fl, prev.fl, scheduledVacations);
  }, [allSales, freelancers, collaborators, scheduledVacations]);

  // 30-day avg metrics
  const avg30Data = useMemo(() => {
    const curr = filterByRange(fmt(start30), fmt(yesterday));
    const prev = filterByRange(fmt(prev30Start), fmt(prev30End));
    return computeBlockMetrics(curr.sales, prev.sales, collaborators, curr.fl, prev.fl, scheduledVacations);
  }, [allSales, freelancers, collaborators, scheduledVacations]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const formatPeriodLabel = (start: Date, end: Date) => {
    const s = start.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const e = end.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    return `${s} a ${e}`;
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground md:text-2xl">
          Dashboard Operacional
        </h1>
        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5" />
            {dateStr} · {dayOfWeek}
          </span>
          {usuario && (
            <span className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              {usuario.nome}
            </span>
          )}
        </div>
      </div>

      {/* Top KPI Cards */}
      <TopKPICards data={yesterdayData} periodLabel="Ontem" comparisonLabel="mesmo dia da semana anterior" />

      {/* Resultado do dia anterior */}
      <MetricBlock
        title="Resultado do dia anterior"
        periodLabel={yesterday.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
        comparisonLabel={`vs ${sameWeekdayPrev.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} (mesmo dia semana anterior)`}
        data={yesterdayData}
      />

      {/* Média dos últimos 7 dias */}
      <MetricBlock
        title="Média dos últimos 7 dias"
        periodLabel={formatPeriodLabel(start7, yesterday)}
        comparisonLabel={`vs ${formatPeriodLabel(prev7Start, prev7End)}`}
        data={avg7Data}
        isAverage
      />

      {/* Média dos últimos 30 dias */}
      <MetricBlock
        title="Média dos últimos 30 dias"
        periodLabel={formatPeriodLabel(start30, yesterday)}
        comparisonLabel={`vs ${formatPeriodLabel(prev30Start, prev30End)}`}
        data={avg30Data}
        isAverage
      />
    </div>
  );
}
