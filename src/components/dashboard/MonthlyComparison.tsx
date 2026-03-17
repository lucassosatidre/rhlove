import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { DailySales } from '@/hooks/useDailySales';
import type { Collaborator } from '@/types/collaborator';
import type { Freelancer } from '@/hooks/useFreelancers';
import type { ScheduledVacation } from '@/hooks/useScheduledVacations';
import type { AbsentCollaboratorIdsByDate } from '@/lib/attendanceEvents';
import { countPeopleBySectorOnDate } from '@/lib/productivityEngine';

const SECTORS = ['COZINHA', 'SALÃO', 'TELE - ENTREGA', 'DIURNO'] as const;

function getTotalPeople(
  collaborators: Collaborator[],
  freelancers: Freelancer[],
  scheduledVacations: ScheduledVacation[],
  dateStr: string,
  absentCollaboratorIdsByDate?: AbsentCollaboratorIdsByDate
): number {
  const d = new Date(dateStr + 'T00:00:00');
  let total = 0;
  for (const s of SECTORS) {
    total += countPeopleBySectorOnDate(collaborators, s, d, scheduledVacations, undefined, undefined, absentCollaboratorIdsByDate);
    const f = freelancers.find(fr => fr.date === dateStr && fr.sector === s);
    if (f) total += f.quantity;
  }
  return total;
}

function getCollaboratorsOnly(
  collaborators: Collaborator[],
  scheduledVacations: ScheduledVacation[],
  dateStr: string,
  absentCollaboratorIdsByDate?: AbsentCollaboratorIdsByDate
): number {
  const d = new Date(dateStr + 'T00:00:00');
  let total = 0;
  for (const s of SECTORS) {
    total += countPeopleBySectorOnDate(collaborators, s, d, scheduledVacations, undefined, undefined, absentCollaboratorIdsByDate);
  }
  return total;
}

interface MonthlyKPIs {
  tmp: number; // Ticket Médio por Pedido = faturamento / pedidos
  ppp: number; // Pedidos por Pessoa = pedidos / pessoas (colab + free)
  tmt: number; // Ticket Médio por Trabalhador = faturamento / pessoas
  pcs: number; // Pedidos por Colaborador = pedidos / colaboradores (sem free)
  hasDays: boolean;
}

function computeMonthlyKPIs(
  sales: DailySales[],
  collaborators: Collaborator[],
  freelancers: Freelancer[],
  scheduledVacations: ScheduledVacation[],
  absentCollaboratorIdsByDate?: AbsentCollaboratorIdsByDate
): MonthlyKPIs {
  if (sales.length === 0) return { tmp: 0, ppp: 0, tmt: 0, pcs: 0, hasDays: false };

  let totalFat = 0, totalPed = 0, totalPeople = 0, totalColabs = 0;

  for (const sale of sales) {
    totalFat += Number(sale.faturamento_total);
    totalPed += Number(sale.pedidos_totais);
    totalPeople += getTotalPeople(collaborators, freelancers, scheduledVacations, sale.date, absentCollaboratorIdsByDate);
    totalColabs += getCollaboratorsOnly(collaborators, scheduledVacations, sale.date, absentCollaboratorIdsByDate);
  }

  const days = sales.length;
  const avgPed = totalPed / days;
  const avgFat = totalFat / days;
  const avgPeople = totalPeople / days;
  const avgColabs = totalColabs / days;

  return {
    tmp: avgPed > 0 ? avgFat / avgPed : 0,
    ppp: avgPeople > 0 ? avgPed / avgPeople : 0,
    tmt: avgPeople > 0 ? avgFat / avgPeople : 0,
    pcs: avgColabs > 0 ? avgPed / avgColabs : 0,
    hasDays: true,
  };
}

function pctChange(current: number, prev: number): number {
  if (prev === 0) return current > 0 ? 100 : 0;
  return ((current - prev) / prev) * 100;
}

function formatCurrency(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

interface KPICardProps {
  label: string;
  abbrev: string;
  currentValue: number;
  prevValue: number;
  isCurrency: boolean;
  currentMonth: string;
  prevMonth: string;
}

function KPICard({ label, abbrev, currentValue, prevValue, isCurrency, currentMonth, prevMonth }: KPICardProps) {
  const change = pctChange(currentValue, prevValue);
  const isUp = change > 0.5;
  const isDown = change < -0.5;
  const isStable = !isUp && !isDown;

  const fmt = (v: number) => isCurrency ? formatCurrency(v) : v.toFixed(1);

  return (
    <Card className="border-border/60">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-xs font-bold text-primary tracking-wider">{abbrev}</span>
            <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
          </div>
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
            isUp ? 'bg-emerald-500/10 text-emerald-600' :
            isDown ? 'bg-red-500/10 text-red-500' :
            'bg-muted text-muted-foreground'
          }`}>
            {isUp && <TrendingUp className="w-3 h-3" />}
            {isDown && <TrendingDown className="w-3 h-3" />}
            {isStable && <Minus className="w-3 h-3" />}
            {change >= 0 ? '+' : ''}{change.toFixed(1)}%
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">{currentMonth}</span>
            <span className="text-sm font-bold text-foreground">{fmt(currentValue)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">{prevMonth}</span>
            <span className="text-sm text-muted-foreground">{fmt(prevValue)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface Props {
  allSales: DailySales[];
  collaborators: Collaborator[];
  freelancers: Freelancer[];
  scheduledVacations: ScheduledVacation[];
}

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export default function MonthlyComparison({ allSales, collaborators, freelancers, scheduledVacations }: Props) {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  const fmtMonth = (y: number, m: number) =>
    `${y}-${String(m + 1).padStart(2, '0')}`;

  const currentPrefix = fmtMonth(currentYear, currentMonth);
  const prevPrefix = fmtMonth(prevYear, prevMonth);

  const currentSales = allSales.filter(s => s.date.startsWith(currentPrefix));
  const prevSales = allSales.filter(s => s.date.startsWith(prevPrefix));

  const currentFl = freelancers.filter(f => f.date.startsWith(currentPrefix));
  const prevFl = freelancers.filter(f => f.date.startsWith(prevPrefix));

  const curr = computeMonthlyKPIs(currentSales, collaborators, currentFl, scheduledVacations);
  const prev = computeMonthlyKPIs(prevSales, collaborators, prevFl, scheduledVacations);

  const currentMonthLabel = MONTH_NAMES[currentMonth];
  const prevMonthLabel = MONTH_NAMES[prevMonth];

  if (!curr.hasDays && !prev.hasDays) return null;

  const noComparison = !prev.hasDays;

  const kpis = [
    { abbrev: 'TMP', label: 'Ticket Médio por Pedido', curr: curr.tmp, prev: prev.tmp, isCurrency: true },
    { abbrev: 'PPP', label: 'Pedidos por Pessoa', curr: curr.ppp, prev: prev.ppp, isCurrency: false },
    { abbrev: 'TMT', label: 'Ticket Médio por Trabalhador', curr: curr.tmt, prev: prev.tmt, isCurrency: true },
    { abbrev: 'PCS', label: 'Pedidos por Colaborador', curr: curr.pcs, prev: prev.pcs, isCurrency: false },
  ];

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-foreground">Comparativo Mensal de Produtividade</h2>
        <p className="text-[11px] text-muted-foreground">
          {currentMonthLabel} ({currentSales.length} dias) vs {prevMonthLabel} ({prevSales.length} dias)
        </p>
      </div>

      {noComparison ? (
        <Card className="border-border/60">
          <CardContent className="p-4 text-center text-sm text-muted-foreground">
            Sem histórico suficiente para comparação
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {kpis.map(k => (
            <KPICard
              key={k.abbrev}
              abbrev={k.abbrev}
              label={k.label}
              currentValue={k.curr}
              prevValue={k.prev}
              isCurrency={k.isCurrency}
              currentMonth={currentMonthLabel}
              prevMonth={prevMonthLabel}
            />
          ))}
        </div>
      )}
    </div>
  );
}
