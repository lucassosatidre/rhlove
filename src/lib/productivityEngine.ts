import type { Collaborator } from '@/types/collaborator';
import type { DailySales } from '@/hooks/useDailySales';
import type { Freelancer } from '@/hooks/useFreelancers';
import type { FreelancerEntry } from '@/hooks/useFreelancerEntries';
import type { ScheduledVacation } from '@/hooks/useScheduledVacations';
import type { Afastamento } from '@/hooks/useAfastamentos';
import type { DayOffOverridesMap } from '@/lib/scheduleEngine';
import { getScheduledCollaboratorIdsBySectorOnDate } from '@/lib/scheduleEngine';
import type { AbsentCollaboratorIdsByDate } from '@/lib/attendanceEvents';

/** Set of "collaboratorId|date" keys for punch-confirmed faltas */
export type PunchFaltaSet = Set<string>;

export interface ProductivityRow {
  date: string;
  sector: string;
  vendas: number;
  pedidos: number;
  numero_pessoas: number;
  tcs: number;
  pcs: number;
}

const SECTOR_ORDER = ['COZINHA', 'SALÃO', 'TELE - ENTREGA', 'DIURNO', 'TIME', 'TCT', 'PCT'];

function getFreelancerCount(freelancers: Freelancer[], freelancerEntries: FreelancerEntry[], date: string, sector: string): number {
  const qtyFrees = freelancers.find(fr => fr.date === date && fr.sector === sector)?.quantity ?? 0;
  const namedFrees = freelancerEntries.filter(fe => fe.date === date && fe.sector === sector).length;
  return qtyFrees + namedFrees;
}

function buildScheduledCountMap(
  collaborators: Collaborator[],
  salesData: DailySales[],
  scheduledVacations: ScheduledVacation[] = [],
  dayOffOverrides?: DayOffOverridesMap,
  afastamentos: Afastamento[] = [],
  absentCollaboratorIdsByDate?: AbsentCollaboratorIdsByDate
): Record<string, number> {
  const map: Record<string, number> = {};

  for (const sale of salesData) {
    const date = new Date(sale.date + 'T00:00:00');
    const absentCollaboratorIds = absentCollaboratorIdsByDate?.get(sale.date);
    const collaboratorsBySector = getScheduledCollaboratorIdsBySectorOnDate(
      collaborators,
      date,
      scheduledVacations,
      dayOffOverrides,
      afastamentos
    );

    for (const [sector, collaboratorIds] of Object.entries(collaboratorsBySector)) {
      map[`${sale.date}|${sector}`] = collaboratorIds.filter(id => !absentCollaboratorIds?.has(id)).length;
    }
  }

  return map;
}

export function countPeopleBySectorOnDate(
  collaborators: Collaborator[],
  sector: string,
  date: Date,
  scheduledVacations: ScheduledVacation[] = [],
  dayOffOverrides?: DayOffOverridesMap,
  afastamentos: Afastamento[] = [],
  absentCollaboratorIdsByDate?: AbsentCollaboratorIdsByDate
): number {
  const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const absentCollaboratorIds = absentCollaboratorIdsByDate?.get(dateKey);
  const collaboratorsBySector = getScheduledCollaboratorIdsBySectorOnDate(
    collaborators,
    date,
    scheduledVacations,
    dayOffOverrides,
    afastamentos
  );

  return (collaboratorsBySector[sector] ?? []).filter(id => !absentCollaboratorIds?.has(id)).length;
}

export function generateProductivityData(
  salesData: DailySales[],
  collaborators: Collaborator[],
  freelancers: Freelancer[] = [],
  scheduledVacations: ScheduledVacation[] = [],
  dayOffOverrides?: DayOffOverridesMap,
  afastamentos: Afastamento[] = [],
  absentCollaboratorIdsByDate?: AbsentCollaboratorIdsByDate,
  freelancerEntries: FreelancerEntry[] = []
): ProductivityRow[] {
  const rows: ProductivityRow[] = [];
  const scheduledCountMap = buildScheduledCountMap(
    collaborators,
    salesData,
    scheduledVacations,
    dayOffOverrides,
    afastamentos,
    absentCollaboratorIdsByDate
  );

  const getScheduledCount = (date: string, sector: string) => scheduledCountMap[`${date}|${sector}`] || 0;

  for (const sale of salesData) {
    const pCozinha = getScheduledCount(sale.date, 'COZINHA') + getFreelancerCount(freelancers, freelancerEntries, sale.date, 'COZINHA');
    const pDiurno = getScheduledCount(sale.date, 'DIURNO') + getFreelancerCount(freelancers, freelancerEntries, sale.date, 'DIURNO');
    const pSalao = getScheduledCount(sale.date, 'SALÃO') + getFreelancerCount(freelancers, freelancerEntries, sale.date, 'SALÃO');
    const pTele = getScheduledCount(sale.date, 'TELE - ENTREGA') + getFreelancerCount(freelancers, freelancerEntries, sale.date, 'TELE - ENTREGA');

    const ft = Number(sale.faturamento_total) || 0;
    const pt = Number(sale.pedidos_totais) || 0;
    const fs = Number(sale.faturamento_salao) || 0;
    const ps = Number(sale.pedidos_salao) || 0;
    const fte = Number(sale.faturamento_tele) || 0;
    const pte = Number(sale.pedidos_tele) || 0;

    rows.push({ date: sale.date, sector: 'COZINHA', vendas: ft, pedidos: pt, numero_pessoas: pCozinha, tcs: pCozinha > 0 ? ft / pCozinha : 0, pcs: pCozinha > 0 ? pt / pCozinha : 0 });
    rows.push({ date: sale.date, sector: 'DIURNO', vendas: ft, pedidos: pt, numero_pessoas: pDiurno, tcs: pDiurno > 0 ? ft / pDiurno : 0, pcs: pDiurno > 0 ? pt / pDiurno : 0 });
    rows.push({ date: sale.date, sector: 'SALÃO', vendas: fs, pedidos: ps, numero_pessoas: pSalao, tcs: pSalao > 0 ? fs / pSalao : 0, pcs: pSalao > 0 ? ps / pSalao : 0 });
    rows.push({ date: sale.date, sector: 'TELE - ENTREGA', vendas: fte, pedidos: pte, numero_pessoas: pTele, tcs: pTele > 0 ? fte / pTele : 0, pcs: pTele > 0 ? pte / pTele : 0 });

    const totalPeople = pCozinha + pDiurno + pSalao + pTele;
    rows.push({ date: sale.date, sector: 'TIME', vendas: 0, pedidos: 0, numero_pessoas: totalPeople, tcs: 0, pcs: 0 });

    const tct = totalPeople > 0 ? ft / totalPeople : 0;
    rows.push({ date: sale.date, sector: 'TCT', vendas: ft, pedidos: 0, numero_pessoas: totalPeople, tcs: tct, pcs: 0 });

    const pct = totalPeople > 0 ? pt / totalPeople : 0;
    rows.push({ date: sale.date, sector: 'PCT', vendas: 0, pedidos: pt, numero_pessoas: totalPeople, tcs: 0, pcs: pct });
  }

  return rows;
}

export function getSectorOrder(sector: string): number {
  const idx = SECTOR_ORDER.indexOf(sector);
  return idx >= 0 ? idx : 99;
}

export function formatCurrency(value: number): string {
  if (value === 0) return '-';
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDecimal(value: number): string {
  if (value === 0) return '-';
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDateBR(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}`;
}
