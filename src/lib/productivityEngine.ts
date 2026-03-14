import type { Collaborator, DayOfWeek } from '@/types/collaborator';
import type { DailySales } from '@/hooks/useDailySales';
import type { Freelancer } from '@/hooks/useFreelancers';
import type { ScheduledVacation } from '@/hooks/useScheduledVacations';
import { isOnScheduledVacation } from '@/hooks/useScheduledVacations';

const JS_DAY_TO_KEY: DayOfWeek[] = [
  'DOMINGO', 'SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO',
];

function dateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

function getSundayNumber(date: Date): number {
  return Math.ceil(date.getDate() / 7);
}

/** Count how many collaborators are scheduled for a given sector on a given date */
export function countPeopleBySectorOnDate(
  collaborators: Collaborator[],
  sector: string,
  date: Date,
  scheduledVacations: ScheduledVacation[] = []
): number {
  const sd = dateOnly(date);
  const dayKey = JS_DAY_TO_KEY[sd.getDay()];
  let count = 0;

  for (const c of collaborators) {
    if (c.sector !== sector) continue;

    // Empresa period
    const inicioEmpresa = parseDate(c.inicio_na_empresa);
    if (inicioEmpresa && sd < inicioEmpresa) continue;

    // Desligado
    if (c.status === 'DESLIGADO') {
      const deslig = parseDate(c.data_desligamento);
      if (!deslig || sd > deslig) continue;
    }

    // Scheduled vacations
    if (isOnScheduledVacation(scheduledVacations, c.id, sd)) continue;

    // Status check with periodo
    if (c.status === 'FERIAS' || c.status === 'AFASTADO') {
      const inicio = parseDate(c.inicio_periodo);
      const fim = parseDate(c.fim_periodo);
      if (inicio && fim) {
        if (sd >= inicio && sd <= fim) continue;
      } else {
        const retorno = parseDate(c.data_retorno);
        if (!retorno || sd < retorno) continue;
      }
    }
    if (c.status === 'AVISO_PREVIO') {
      const fim = parseDate(c.fim_periodo) || parseDate(c.data_fim_aviso);
      if (fim && sd > fim) continue;
    }

    // Weekly day off
    if (c.folgas_semanais.includes(dayKey)) continue;

    // Sunday off
    if (dayKey === 'DOMINGO' && c.sunday_n === getSundayNumber(sd)) continue;

    count++;
  }

  return count;
}

export interface ProductivityRow {
  date: string;
  sector: string;
  vendas: number;
  pedidos: number;
  numero_pessoas: number;
  tcs: number; // Ticket por Colaborador - Setor (was tmp)
  pcs: number; // Pedidos por Colaborador - Setor (was ppp)
}

const SECTOR_ORDER = ['COZINHA', 'SALÃO', 'TELE - ENTREGA', 'DIURNO', 'TIME', 'TCT', 'PCT'];

/** Get freelancer quantity for a given date and sector */
function getFreelancerCount(freelancers: Freelancer[], date: string, sector: string): number {
  const f = freelancers.find(fr => fr.date === date && fr.sector === sector);
  return f ? f.quantity : 0;
}

export function generateProductivityData(
  salesData: DailySales[],
  collaborators: Collaborator[],
  freelancers: Freelancer[] = [],
  scheduledVacations: ScheduledVacation[] = []
): ProductivityRow[] {
  const rows: ProductivityRow[] = [];

  for (const sale of salesData) {
    const d = new Date(sale.date + 'T00:00:00');

    const pCozinha = countPeopleBySectorOnDate(collaborators, 'COZINHA', d) + getFreelancerCount(freelancers, sale.date, 'COZINHA');
    const pDiurno = countPeopleBySectorOnDate(collaborators, 'DIURNO', d);
    const pSalao = countPeopleBySectorOnDate(collaborators, 'SALÃO', d) + getFreelancerCount(freelancers, sale.date, 'SALÃO');
    const pTele = countPeopleBySectorOnDate(collaborators, 'TELE - ENTREGA', d) + getFreelancerCount(freelancers, sale.date, 'TELE - ENTREGA');

    const ft = Number(sale.faturamento_total) || 0;
    const pt = Number(sale.pedidos_totais) || 0;
    const fs = Number(sale.faturamento_salao) || 0;
    const ps = Number(sale.pedidos_salao) || 0;
    const fte = Number(sale.faturamento_tele) || 0;
    const pte = Number(sale.pedidos_tele) || 0;

    // COZINHA: uses total
    rows.push({
      date: sale.date,
      sector: 'COZINHA',
      vendas: ft,
      pedidos: pt,
      numero_pessoas: pCozinha,
      tcs: pCozinha > 0 ? ft / pCozinha : 0,
      pcs: pCozinha > 0 ? pt / pCozinha : 0,
    });

    // DIURNO: uses total
    rows.push({
      date: sale.date,
      sector: 'DIURNO',
      vendas: ft,
      pedidos: pt,
      numero_pessoas: pDiurno,
      tcs: pDiurno > 0 ? ft / pDiurno : 0,
      pcs: pDiurno > 0 ? pt / pDiurno : 0,
    });

    // SALÃO: uses salão data
    rows.push({
      date: sale.date,
      sector: 'SALÃO',
      vendas: fs,
      pedidos: ps,
      numero_pessoas: pSalao,
      tcs: pSalao > 0 ? fs / pSalao : 0,
      pcs: pSalao > 0 ? ps / pSalao : 0,
    });

    // TELE - ENTREGA: uses tele data
    rows.push({
      date: sale.date,
      sector: 'TELE - ENTREGA',
      vendas: fte,
      pedidos: pte,
      numero_pessoas: pTele,
      tcs: pTele > 0 ? fte / pTele : 0,
      pcs: pTele > 0 ? pte / pTele : 0,
    });

    // TIME
    const totalPeople = pCozinha + pDiurno + pSalao + pTele;
    rows.push({
      date: sale.date,
      sector: 'TIME',
      vendas: 0,
      pedidos: 0,
      numero_pessoas: totalPeople,
      tcs: 0,
      pcs: 0,
    });

    // TCT - Ticket por Colaborador - Time
    const tct = totalPeople > 0 ? ft / totalPeople : 0;
    rows.push({
      date: sale.date,
      sector: 'TCT',
      vendas: ft,
      pedidos: 0,
      numero_pessoas: totalPeople,
      tcs: tct,
      pcs: 0,
    });

    // PCT - Pedidos por Colaborador - Time
    const pct = totalPeople > 0 ? pt / totalPeople : 0;
    rows.push({
      date: sale.date,
      sector: 'PCT',
      vendas: 0,
      pedidos: pt,
      numero_pessoas: totalPeople,
      tcs: 0,
      pcs: pct,
    });
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
