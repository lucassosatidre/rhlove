import type { Collaborator } from '@/types/collaborator';
import type { DailySales } from '@/hooks/useDailySales';
import type { Freelancer } from '@/hooks/useFreelancers';
import type { ScheduledVacation } from '@/hooks/useScheduledVacations';
import type { AbsentCollaboratorIdsByDate } from '@/lib/attendanceEvents';
import { countPeopleBySectorOnDate } from '@/lib/productivityEngine';

const SECTORS = ['COZINHA', 'SALÃO', 'TELE - ENTREGA', 'DIURNO'] as const;

function getFreelancerCount(freelancers: Freelancer[], date: string, sector: string): number {
  const f = freelancers.find(fr => fr.date === date && fr.sector === sector);
  return f ? f.quantity : 0;
}

function getTotalPeopleForDate(
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
    total += getFreelancerCount(freelancers, dateStr, s);
  }
  return total;
}

function getSectorPeopleForDate(
  collaborators: Collaborator[],
  freelancers: Freelancer[],
  scheduledVacations: ScheduledVacation[],
  dateStr: string,
  sector: string,
  absentCollaboratorIdsByDate?: AbsentCollaboratorIdsByDate
): number {
  const d = new Date(dateStr + 'T00:00:00');
  return countPeopleBySectorOnDate(collaborators, sector, d, scheduledVacations, undefined, undefined, absentCollaboratorIdsByDate) +
    getFreelancerCount(freelancers, dateStr, sector);
}

export interface SectorMetric {
  sector: string;
  pedidos: number;
  ticket: number;
  pessoas: number;
  prevPedidos: number;
  prevTicket: number;
  prevPessoas: number;
}

export interface TeamMetric {
  pedidos: number;
  ticket: number;
  pessoas: number;
  prevPedidos: number;
  prevTicket: number;
  prevPessoas: number;
}

export interface TopKPIData {
  faturamento: number;
  pedidos: number;
  colaboradores: number;
  pct: number; // pedidos por colab do time
  tct: number; // ticket por colab do time
  prevFaturamento: number;
  prevPedidos: number;
  prevColaboradores: number;
  prevPct: number;
  prevTct: number;
}

export interface BlockMetrics {
  topKPI: TopKPIData;
  sectors: SectorMetric[];
  team: TeamMetric;
}

function getSectorSales(sale: DailySales, sector: string): { pedidos: number; faturamento: number } {
  switch (sector) {
    case 'SALÃO':
      return { pedidos: Number(sale.pedidos_salao), faturamento: Number(sale.faturamento_salao) };
    case 'TELE - ENTREGA':
      return { pedidos: Number(sale.pedidos_tele), faturamento: Number(sale.faturamento_tele) };
    case 'COZINHA':
    case 'DIURNO':
    default:
      return { pedidos: Number(sale.pedidos_totais), faturamento: Number(sale.faturamento_total) };
  }
}

export function computeBlockMetrics(
  sales: DailySales[],
  prevSales: DailySales[],
  collaborators: Collaborator[],
  freelancers: Freelancer[],
  prevFreelancers: Freelancer[],
  scheduledVacations: ScheduledVacation[],
  absentCollaboratorIdsByDate?: AbsentCollaboratorIdsByDate
): BlockMetrics {
  const days = sales.length || 1;
  const prevDays = prevSales.length || 1;

  // Top KPI
  const fat = sales.reduce((a, s) => a + Number(s.faturamento_total), 0);
  const ped = sales.reduce((a, s) => a + Number(s.pedidos_totais), 0);
  let totalPeople = 0;
  for (const s of sales) {
    totalPeople += getTotalPeopleForDate(collaborators, freelancers, scheduledVacations, s.date, absentCollaboratorIdsByDate);
  }
  const avgPeople = totalPeople / days;
  const pct = avgPeople > 0 ? (ped / days) / avgPeople : 0;
  const tct = avgPeople > 0 ? (fat / days) / avgPeople : 0;

  const prevFat = prevSales.reduce((a, s) => a + Number(s.faturamento_total), 0);
  const prevPed = prevSales.reduce((a, s) => a + Number(s.pedidos_totais), 0);
  let prevTotalPeople = 0;
  for (const s of prevSales) {
    prevTotalPeople += getTotalPeopleForDate(collaborators, prevFreelancers, scheduledVacations, s.date, absentCollaboratorIdsByDate);
  }
  const prevAvgPeople = prevTotalPeople / prevDays;
  const prevPct = prevAvgPeople > 0 ? (prevPed / prevDays) / prevAvgPeople : 0;
  const prevTct = prevAvgPeople > 0 ? (prevFat / prevDays) / prevAvgPeople : 0;

  // Sector metrics
  const sectors: SectorMetric[] = SECTORS.map(sector => {
    let sectorPeople = 0, sectorPed = 0, sectorFat = 0;
    for (const sale of sales) {
      sectorPeople += getSectorPeopleForDate(collaborators, freelancers, scheduledVacations, sale.date, sector, absentCollaboratorIdsByDate);
      const ss = getSectorSales(sale, sector);
      sectorPed += ss.pedidos;
      sectorFat += ss.faturamento;
    }
    const avgSP = sectorPeople / days;
    
    let prevSectorPeople = 0, prevSectorPed = 0, prevSectorFat = 0;
    for (const sale of prevSales) {
      prevSectorPeople += getSectorPeopleForDate(collaborators, prevFreelancers, scheduledVacations, sale.date, sector, absentCollaboratorIdsByDate);
      const ss = getSectorSales(sale, sector);
      prevSectorPed += ss.pedidos;
      prevSectorFat += ss.faturamento;
    }
    const prevAvgSP = prevSectorPeople / prevDays;

    return {
      sector,
      pedidos: avgSP > 0 ? (sectorPed / days) / avgSP : 0,
      ticket: avgSP > 0 ? (sectorFat / days) / avgSP : 0,
      pessoas: Math.round(avgSP),
      prevPedidos: prevAvgSP > 0 ? (prevSectorPed / prevDays) / prevAvgSP : 0,
      prevTicket: prevAvgSP > 0 ? (prevSectorFat / prevDays) / prevAvgSP : 0,
      prevPessoas: Math.round(prevAvgSP),
    };
  });

  // Team metrics
  const team: TeamMetric = {
    pedidos: pct,
    ticket: tct,
    pessoas: Math.round(avgPeople),
    prevPedidos: prevPct,
    prevTicket: prevTct,
    prevPessoas: Math.round(prevAvgPeople),
  };

  return {
    topKPI: {
      faturamento: fat,
      pedidos: ped,
      colaboradores: Math.round(avgPeople),
      pct, tct,
      prevFaturamento: prevFat,
      prevPedidos: prevPed,
      prevColaboradores: Math.round(prevAvgPeople),
      prevPct, prevTct,
    },
    sectors,
    team,
  };
}
