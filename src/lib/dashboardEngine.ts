import type { Collaborator, DayOfWeek } from '@/types/collaborator';
import type { DailySales } from '@/hooks/useDailySales';
import type { Freelancer } from '@/hooks/useFreelancers';
import type { ScheduledVacation } from '@/hooks/useScheduledVacations';
import type { HolidayCompensation } from '@/hooks/useHolidayCompensations';
import { countPeopleBySectorOnDate } from '@/lib/productivityEngine';

const JS_DAY_TO_KEY: DayOfWeek[] = [
  'DOMINGO', 'SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO',
];

function dateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function getDateRange(period: string, customStart?: string, customEnd?: string): { start: string; end: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  switch (period) {
    case 'hoje':
      return { start: fmt(today), end: fmt(today) };
    case 'ontem': {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return { start: fmt(y), end: fmt(y) };
    }
    case '7dias': {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const s = new Date(yesterday);
      s.setDate(s.getDate() - 6);
      return { start: fmt(s), end: fmt(yesterday) };
    }
    case '30dias': {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const s = new Date(yesterday);
      s.setDate(s.getDate() - 29);
      return { start: fmt(s), end: fmt(yesterday) };
    }
    case 'personalizado':
      return { start: customStart || fmt(today), end: customEnd || fmt(today) };
    default:
      return { start: fmt(today), end: fmt(today) };
  }
}

export function getPreviousRange(start: string, end: string): { start: string; end: string } {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  const diff = e.getTime() - s.getTime();
  const days = Math.round(diff / 86400000) + 1;
  const prevEnd = new Date(s);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - days + 1);
  return { start: fmt(prevStart), end: fmt(prevEnd) };
}

export interface OverviewMetrics {
  faturamento: number;
  pedidos: number;
  colaboradores: number;
  pct: number;
  tct: number;
  prevFaturamento: number;
  prevPedidos: number;
  prevColaboradores: number;
  prevPct: number;
  prevTct: number;
}

function getFreelancerCount(freelancers: Freelancer[], date: string, sector: string): number {
  const f = freelancers.find(fr => fr.date === date && fr.sector === sector);
  return f ? f.quantity : 0;
}

function getTotalPeopleForDate(
  collaborators: Collaborator[],
  freelancers: Freelancer[],
  scheduledVacations: ScheduledVacation[],
  dateStr: string
): number {
  const d = new Date(dateStr + 'T00:00:00');
  const sectors = ['COZINHA', 'SALÃO', 'TELE - ENTREGA', 'DIURNO'];
  let total = 0;
  for (const s of sectors) {
    total += countPeopleBySectorOnDate(collaborators, s, d, scheduledVacations);
    total += getFreelancerCount(freelancers, dateStr, s);
  }
  return total;
}

export function computeOverview(
  sales: DailySales[],
  prevSales: DailySales[],
  collaborators: Collaborator[],
  freelancers: Freelancer[],
  prevFreelancers: Freelancer[],
  scheduledVacations: ScheduledVacation[]
): OverviewMetrics {
  const fat = sales.reduce((a, s) => a + Number(s.faturamento_total), 0);
  const ped = sales.reduce((a, s) => a + Number(s.pedidos_totais), 0);

  let totalPeople = 0;
  for (const s of sales) {
    totalPeople += getTotalPeopleForDate(collaborators, freelancers, scheduledVacations, s.date);
  }
  const avgPeople = sales.length > 0 ? totalPeople / sales.length : 0;

  const pct = totalPeople > 0 ? ped / (totalPeople / sales.length) : 0;
  const tct = totalPeople > 0 ? fat / (totalPeople / sales.length) : 0;

  // Previous
  const prevFat = prevSales.reduce((a, s) => a + Number(s.faturamento_total), 0);
  const prevPed = prevSales.reduce((a, s) => a + Number(s.pedidos_totais), 0);
  let prevTotalPeople = 0;
  for (const s of prevSales) {
    prevTotalPeople += getTotalPeopleForDate(collaborators, prevFreelancers, scheduledVacations, s.date);
  }
  const prevPct = prevTotalPeople > 0 && prevSales.length > 0 ? prevPed / (prevTotalPeople / prevSales.length) : 0;
  const prevTct = prevTotalPeople > 0 && prevSales.length > 0 ? prevFat / (prevTotalPeople / prevSales.length) : 0;

  return {
    faturamento: fat,
    pedidos: ped,
    colaboradores: Math.round(avgPeople),
    pct: sales.length > 0 ? pct : 0,
    tct: sales.length > 0 ? tct : 0,
    prevFaturamento: prevFat,
    prevPedidos: prevPed,
    prevColaboradores: prevTotalPeople > 0 && prevSales.length > 0 ? Math.round(prevTotalPeople / prevSales.length) : 0,
    prevPct,
    prevTct,
  };
}

export interface SectorMetric {
  sector: string;
  pcs: number;
  tcs: number;
  pessoas: number;
}

export function computeSectorMetrics(
  sales: DailySales[],
  collaborators: Collaborator[],
  freelancers: Freelancer[],
  scheduledVacations: ScheduledVacation[]
): SectorMetric[] {
  const sectors = ['COZINHA', 'SALÃO', 'TELE - ENTREGA', 'DIURNO'];
  return sectors.map(sector => {
    let totalPeople = 0;
    let totalVendas = 0;
    let totalPedidos = 0;

    for (const sale of sales) {
      const d = new Date(sale.date + 'T00:00:00');
      const people = countPeopleBySectorOnDate(collaborators, sector, d, scheduledVacations) + getFreelancerCount(freelancers, sale.date, sector);
      totalPeople += people;

      if (sector === 'COZINHA' || sector === 'DIURNO') {
        totalVendas += Number(sale.faturamento_total);
        totalPedidos += Number(sale.pedidos_totais);
      } else if (sector === 'SALÃO') {
        totalVendas += Number(sale.faturamento_salao);
        totalPedidos += Number(sale.pedidos_salao);
      } else {
        totalVendas += Number(sale.faturamento_tele);
        totalPedidos += Number(sale.pedidos_tele);
      }
    }

    const avgPeople = sales.length > 0 ? totalPeople / sales.length : 0;
    return {
      sector,
      pcs: avgPeople > 0 ? (totalPedidos / sales.length) / avgPeople : 0,
      tcs: avgPeople > 0 ? (totalVendas / sales.length) / avgPeople : 0,
      pessoas: Math.round(avgPeople),
    };
  });
}

export interface DailyEvolution {
  date: string;
  dateLabel: string;
  pedidos: number;
  faturamento: number;
  pct: number;
  tct: number;
}

export function computeEvolution(
  sales: DailySales[],
  collaborators: Collaborator[],
  freelancers: Freelancer[],
  scheduledVacations: ScheduledVacation[]
): DailyEvolution[] {
  return sales.map(sale => {
    const people = getTotalPeopleForDate(collaborators, freelancers, scheduledVacations, sale.date);
    const ped = Number(sale.pedidos_totais);
    const fat = Number(sale.faturamento_total);
    const [y, m, d] = sale.date.split('-');
    return {
      date: sale.date,
      dateLabel: `${d}/${m}`,
      pedidos: ped,
      faturamento: fat,
      pct: people > 0 ? ped / people : 0,
      tct: people > 0 ? fat / people : 0,
    };
  });
}

export interface TeamDistData {
  sector: string;
  colaboradores: number;
  freelancers: number;
}

export function computeTeamDist(
  collaborators: Collaborator[],
  freelancers: Freelancer[],
  scheduledVacations: ScheduledVacation[],
  dateStr: string
): TeamDistData[] {
  const d = new Date(dateStr + 'T00:00:00');
  const sectors = ['COZINHA', 'SALÃO', 'TELE - ENTREGA', 'DIURNO'];
  return sectors.map(sector => ({
    sector,
    colaboradores: countPeopleBySectorOnDate(collaborators, sector, d, scheduledVacations),
    freelancers: getFreelancerCount(freelancers, dateStr, sector),
  }));
}

export function computeFreelancerSummary(freelancers: Freelancer[]): { week: number; month: number } {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + 1);
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  let week = 0;
  let month = 0;
  for (const f of freelancers) {
    const fd = new Date(f.date + 'T00:00:00');
    if (fd >= startOfMonth && fd <= today) month += f.quantity;
    if (fd >= startOfWeek && fd <= today) week += f.quantity;
  }
  return { week, month };
}

export interface Alert {
  type: 'info' | 'warning' | 'critical';
  message: string;
}

export function computeAlerts(
  collaborators: Collaborator[],
  scheduledVacations: ScheduledVacation[],
  compensations: HolidayCompensation[],
  sales: DailySales[],
  freelancers: Freelancer[],
): Alert[] {
  const alerts: Alert[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in7Days = new Date(today);
  in7Days.setDate(in7Days.getDate() + 7);

  // Experience contracts ending
  for (const c of collaborators) {
    if (c.status === 'EXPERIENCIA' && c.fim_periodo) {
      const fim = new Date(c.fim_periodo + 'T00:00:00');
      if (fim >= today && fim <= in7Days) {
        alerts.push({ type: 'warning', message: `Experiência de ${c.collaborator_name} vence em ${c.fim_periodo.split('-').reverse().join('/')}` });
      }
    }
  }

  // Aviso prévio ending
  for (const c of collaborators) {
    if (c.status === 'AVISO_PREVIO' && (c.fim_periodo || c.data_fim_aviso)) {
      const fimStr = c.fim_periodo || c.data_fim_aviso;
      if (fimStr) {
        const fim = new Date(fimStr + 'T00:00:00');
        if (fim >= today && fim <= in7Days) {
          alerts.push({ type: 'critical', message: `Aviso prévio de ${c.collaborator_name} termina em ${fimStr.split('-').reverse().join('/')}` });
        }
      }
    }
  }

  // Collaborators on vacation
  const onVacation = scheduledVacations.filter(v => {
    if (v.status === 'CANCELADA') return false;
    const inicio = new Date(v.data_inicio_ferias + 'T00:00:00');
    const fim = new Date(v.data_fim_ferias + 'T00:00:00');
    return today >= inicio && today <= fim;
  });
  if (onVacation.length > 0) {
    alerts.push({ type: 'info', message: `${onVacation.length} colaborador(es) em férias atualmente` });
  }

  // Pending compensations
  const pending = compensations.filter(c => c.status === 'SIM' && c.eligible);
  if (pending.length > 0) {
    alerts.push({ type: 'warning', message: `${pending.length} compensação(ões) de feriado pendente(s)` });
  }

  // High freelancer days
  const recentFreelancers = freelancers.filter(f => {
    const fd = new Date(f.date + 'T00:00:00');
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    return fd >= weekAgo && fd <= today;
  });
  const totalFL = recentFreelancers.reduce((a, f) => a + f.quantity, 0);
  if (totalFL > 10) {
    alerts.push({ type: 'warning', message: `Uso elevado de free-lancers: ${totalFL} nos últimos 7 dias` });
  }

  return alerts;
}

export interface HealthMetric {
  label: string;
  current: number;
  average: number;
  unit: string;
}

export function computeHealth(
  sales: DailySales[],
  allSales: DailySales[],
  collaborators: Collaborator[],
  freelancers: Freelancer[],
  allFreelancers: Freelancer[],
  scheduledVacations: ScheduledVacation[]
): HealthMetric[] {
  const currentMetrics = computeSectorMetrics(sales, collaborators, freelancers, scheduledVacations);
  const allMetrics = computeSectorMetrics(allSales, collaborators, allFreelancers, scheduledVacations);

  const cozinhaCurr = currentMetrics.find(m => m.sector === 'COZINHA');
  const cozinhaAll = allMetrics.find(m => m.sector === 'COZINHA');
  const salaoCurr = currentMetrics.find(m => m.sector === 'SALÃO');
  const salaoAll = allMetrics.find(m => m.sector === 'SALÃO');
  const teleCurr = currentMetrics.find(m => m.sector === 'TELE - ENTREGA');
  const teleAll = allMetrics.find(m => m.sector === 'TELE - ENTREGA');

  // Freelancer usage
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const currentFL = freelancers.reduce((a, f) => a + f.quantity, 0);
  const avgFL = allFreelancers.length > 0 ? allFreelancers.reduce((a, f) => a + f.quantity, 0) / Math.max(allSales.length, 1) * sales.length : 0;

  return [
    { label: 'Pedidos p/ colab. Cozinha', current: cozinhaCurr?.pcs || 0, average: cozinhaAll?.pcs || 0, unit: 'ped/col' },
    { label: 'Pedidos p/ colab. Salão', current: salaoCurr?.pcs || 0, average: salaoAll?.pcs || 0, unit: 'ped/col' },
    { label: 'Pedidos p/ colab. Tele', current: teleCurr?.pcs || 0, average: teleAll?.pcs || 0, unit: 'ped/col' },
    { label: 'Uso de Free-lancers', current: currentFL, average: Math.round(avgFL), unit: 'pessoas' },
    { label: 'Ticket p/ colaborador do setor', current: currentMetrics.reduce((a, m) => a + m.tcs, 0) / currentMetrics.length, average: allMetrics.reduce((a, m) => a + m.tcs, 0) / allMetrics.length, unit: 'R$' },
  ];
}

export interface MonthlyTrend {
  month: string;
  pedidos: number;
  faturamento: number;
  produtividade: number;
  colaboradores: number;
  freelancers: number;
}

export function computeMonthlyTrends(
  allSales: DailySales[],
  collaborators: Collaborator[],
  allFreelancers: Freelancer[],
  scheduledVacations: ScheduledVacation[]
): MonthlyTrend[] {
  const monthMap = new Map<string, { sales: DailySales[]; fl: Freelancer[] }>();

  for (const s of allSales) {
    const key = s.date.slice(0, 7); // YYYY-MM
    if (!monthMap.has(key)) monthMap.set(key, { sales: [], fl: [] });
    monthMap.get(key)!.sales.push(s);
  }
  for (const f of allFreelancers) {
    const key = f.date.slice(0, 7);
    if (!monthMap.has(key)) monthMap.set(key, { sales: [], fl: [] });
    monthMap.get(key)!.fl.push(f);
  }

  const months = Array.from(monthMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  return months.map(([key, data]) => {
    const [y, m] = key.split('-');
    const totalPed = data.sales.reduce((a, s) => a + Number(s.pedidos_totais), 0);
    const totalFat = data.sales.reduce((a, s) => a + Number(s.faturamento_total), 0);
    let totalPeople = 0;
    for (const s of data.sales) {
      totalPeople += getTotalPeopleForDate(collaborators, data.fl, scheduledVacations, s.date);
    }
    const avgPeople = data.sales.length > 0 ? totalPeople / data.sales.length : 0;
    const produtividade = avgPeople > 0 ? (totalPed / data.sales.length) / avgPeople : 0;
    const totalFL = data.fl.reduce((a, f) => a + f.quantity, 0);

    return {
      month: `${MONTH_NAMES[parseInt(m) - 1]}/${y.slice(2)}`,
      pedidos: totalPed,
      faturamento: totalFat,
      produtividade,
      colaboradores: Math.round(avgPeople),
      freelancers: totalFL,
    };
  });
}
