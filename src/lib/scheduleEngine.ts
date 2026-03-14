import type { Collaborator, DayOfWeek } from '@/types/collaborator';
import type { ScheduledVacation } from '@/hooks/useScheduledVacations';
import { isOnScheduledVacation } from '@/hooks/useScheduledVacations';

export interface ScheduleWeek {
  weekNumber: number;
  startDate: Date;
  days: ScheduleDay[];
}

export interface ScheduleDay {
  date: Date;
  dayOfWeek: DayOfWeek;
  label: string;
  collaboratorsBySector: Record<string, string[]>;
}

const JS_DAY_TO_KEY: DayOfWeek[] = [
  'DOMINGO', 'SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO',
];

const SHORT_LABELS: Record<DayOfWeek, string> = {
  SEGUNDA: 'Seg', TERCA: 'Ter', QUARTA: 'Qua', QUINTA: 'Qui',
  SEXTA: 'Sex', SABADO: 'Sáb', DOMINGO: 'Dom',
};

function getFirstMondayOfMonthGrid(year: number, month: number): Date {
  const firstDay = new Date(year, month, 1);
  const dow = firstDay.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  return new Date(year, month, 1 + diff);
}

function getSundayNumber(date: Date): number {
  return Math.ceil(date.getDate() / 7);
}

function formatDateBR(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 86400000;
  return Math.floor((b.getTime() - a.getTime()) / msPerDay);
}

function dateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Check if collaborator should appear on a given schedule date.
 * Returns null if excluded, or the display name (possibly with alert suffix).
 */
function getDisplayName(collab: Collaborator, scheduleDate: Date): string | null {
  const sd = dateOnly(scheduleDate);
  const dayKey = JS_DAY_TO_KEY[sd.getDay()];

  // STEP 0 — EMPRESA PERIOD
  const inicioEmpresa = parseDate(collab.inicio_na_empresa);
  if (inicioEmpresa && sd < inicioEmpresa) return null;

  // DESLIGADO: only show up to data_desligamento
  if (collab.status === 'DESLIGADO') {
    const deslig = parseDate(collab.data_desligamento);
    if (deslig && sd > deslig) return null;
    if (!deslig) return null; // no end date = don't show
  }

  // STEP 1 — STATUS with periodo
  if (collab.status === 'FERIAS' || collab.status === 'AFASTADO') {
    const inicio = parseDate(collab.inicio_periodo);
    const fim = parseDate(collab.fim_periodo);
    // Use new period fields if available, fallback to legacy
    if (inicio && fim) {
      if (sd >= inicio && sd <= fim) return null;
    } else {
      // Legacy: use data_retorno
      const retorno = parseDate(collab.data_retorno);
      if (retorno && sd < retorno) return null;
      if (!retorno && (collab.status === 'FERIAS' || collab.status === 'AFASTADO')) {
        // Check fim_periodo only
        if (fim && sd <= fim) return null;
        if (!fim) return null;
      }
    }
  }

  if (collab.status === 'AVISO_PREVIO') {
    const fimAviso = parseDate(collab.fim_periodo) || parseDate(collab.data_fim_aviso);
    if (fimAviso && sd > fimAviso) return null;
  }

  // STEP 2 — FOLGAS SEMANAIS
  if (collab.folgas_semanais.includes(dayKey)) return null;

  // STEP 3 — DOMINGO DO MÊS
  if (dayKey === 'DOMINGO') {
    const sundayNum = getSundayNumber(sd);
    if (collab.sunday_n === sundayNum) return null;
  }

  // STEP 4 — ALERTAS
  let name = collab.collaborator_name;

  if (collab.status === 'EXPERIENCIA') {
    const fim = parseDate(collab.fim_periodo) || parseDate(collab.data_fim_experiencia);
    if (fim) {
      const remaining = daysBetween(sd, fim);
      if (remaining >= 0 && remaining <= 7) {
        name += ' (EXPERIÊNCIA VENCENDO)';
      }
    }
  }

  if (collab.status === 'AVISO_PREVIO') {
    const fim = parseDate(collab.fim_periodo) || parseDate(collab.data_fim_aviso);
    if (fim) {
      const remaining = daysBetween(sd, fim);
      if (remaining >= 0 && remaining <= 7) {
        name += ' (AVISO TERMINANDO)';
      }
    }
  }

  return name;
}

export function generateSchedule(
  collaborators: Collaborator[],
  year: number,
  month: number
): ScheduleWeek[] {
  const firstMonday = getFirstMondayOfMonthGrid(year, month);
  const weeks: ScheduleWeek[] = [];

  for (let w = 0; w < 4; w++) {
    const weekStart = new Date(firstMonday);
    weekStart.setDate(firstMonday.getDate() + w * 7);
    const days: ScheduleDay[] = [];

    for (let d = 0; d < 7; d++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + d);
      const dayKey = JS_DAY_TO_KEY[date.getDay()];

      // Label: Segunda gets "Segunda: DD/MM", others just short name
      const label = dayKey === 'SEGUNDA'
        ? `Segunda: ${formatDateBR(date)}`
        : SHORT_LABELS[dayKey];

      const collaboratorsBySector: Record<string, string[]> = {};

      for (const collab of collaborators) {
        const displayName = getDisplayName(collab, date);
        if (!displayName) continue;

        if (!collaboratorsBySector[collab.sector]) {
          collaboratorsBySector[collab.sector] = [];
        }
        collaboratorsBySector[collab.sector].push(displayName);
      }

      days.push({ date, dayOfWeek: dayKey, label, collaboratorsBySector });
    }

    weeks.push({ weekNumber: w + 1, startDate: weekStart, days });
  }

  return weeks;
}

export function getMonthLabel(year: number, month: number): string {
  const d = new Date(year, month, 1);
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}
