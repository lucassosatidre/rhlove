import type { Collaborator, DayOfWeek } from '@/types/collaborator';
import type { ScheduledVacation } from '@/hooks/useScheduledVacations';
import { isOnScheduledVacation } from '@/hooks/useScheduledVacations';
import type { Afastamento } from '@/hooks/useAfastamentos';
import { isOnAfastamento } from '@/hooks/useAfastamentos';
import type { FolgasResolver } from '@/hooks/useFolgasResolver';

let _fallbackWarned = false;
function warnFallback(collabId: string) {
  if (_fallbackWarned) return;
  _fallbackWarned = true;
  // eslint-disable-next-line no-console
  console.warn(
    `[scheduleEngine] FolgasResolver ausente — usando fallback collaborator.folgas_semanais (id=${collabId}). ` +
    `Passe o resolver de useFolgasResolver() para respeitar o histórico de folgas.`
  );
}

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

export interface DayOffOverride {
  removeDays: string[]; // Day-off days that become work days this week
  addDays: string[];    // Work days that become day-off this week
}

export type DayOffOverridesMap = Map<string, DayOffOverride>;

const JS_DAY_TO_KEY: DayOfWeek[] = [
  'DOMINGO', 'SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO',
];

const SHORT_LABELS: Record<DayOfWeek, string> = {
  SEGUNDA: 'Seg', TERCA: 'Ter', QUARTA: 'Qua', QUINTA: 'Qui',
  SEXTA: 'Sex', SABADO: 'Sáb', DOMINGO: 'Dom',
};

export function getFirstMondayOfMonthGrid(year: number, month: number): Date {
  const firstDay = new Date(year, month, 1);
  const dow = firstDay.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  return new Date(year, month, 1 + diff);
}

export function getWeekCount(year: number, month: number): number {
  const firstMonday = getFirstMondayOfMonthGrid(year, month);
  const lastDay = new Date(year, month + 1, 0);
  const diffDays = Math.ceil((lastDay.getTime() - firstMonday.getTime()) / 86400000) + 1;
  return Math.ceil(diffDays / 7);
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
function getDisplayName(
  collab: Collaborator,
  scheduleDate: Date,
  scheduledVacations: ScheduledVacation[] = [],
  dayOffOverride?: DayOffOverride,
  afastamentos: Afastamento[] = []
): string | null {
  const sd = dateOnly(scheduleDate);
  const dayKey = JS_DAY_TO_KEY[sd.getDay()];

  // STEP 0 — EMPRESA PERIOD
  const inicioEmpresa = parseDate(collab.inicio_na_empresa);
  if (inicioEmpresa && sd < inicioEmpresa) return null;

  // DESLIGADO: only show up to data_desligamento
  if (collab.status === 'DESLIGADO') {
    const deslig = parseDate(collab.data_desligamento);
    if (deslig && sd > deslig) return null;
    if (!deslig) return null;
  }

  // STEP 0.5 — SCHEDULED VACATIONS
  if (isOnScheduledVacation(scheduledVacations, collab.id, sd)) return null;

  // STEP 0.6 — AFASTAMENTOS
  if (isOnAfastamento(afastamentos, collab.id, sd)) return null;
  // STEP 1 — STATUS with periodo
  if (collab.status === 'FERIAS' || collab.status === 'AFASTADO') {
    const inicio = parseDate(collab.inicio_periodo);
    const fim = parseDate(collab.fim_periodo);
    if (inicio && fim) {
      if (sd >= inicio && sd <= fim) return null;
    } else {
      const retorno = parseDate(collab.data_retorno);
      if (retorno && sd < retorno) return null;
      if (!retorno && (collab.status === 'FERIAS' || collab.status === 'AFASTADO')) {
        if (fim && sd <= fim) return null;
        if (!fim) return null;
      }
    }
  }

  if (collab.status === 'AVISO_PREVIO') {
    const fimAviso = parseDate(collab.fim_periodo) || parseDate(collab.data_fim_aviso);
    if (fimAviso && sd > fimAviso) return null;
  }

  // STEP 2 — DAY-OFF OVERRIDE: addDays takes priority (new day off this week)
  if (dayOffOverride?.addDays.includes(dayKey)) return null;

  // STEP 3 — FOLGAS SEMANAIS (with override removeDays)
  if (collab.folgas_semanais.includes(dayKey)) {
    // If override removes this day-off, collaborator works today
    if (dayOffOverride?.removeDays.includes(dayKey)) {
      // Continue — don't return null, they work today
    } else {
      return null;
    }
  }

  // STEP 4 — DOMINGO DO MÊS (with override removeDays) — only if sunday_n > 0
  if (dayKey === 'DOMINGO' && collab.sunday_n > 0) {
    const sundayNum = getSundayNumber(sd);
    if (collab.sunday_n === sundayNum) {
      if (dayOffOverride?.removeDays.includes('DOMINGO')) {
        // Override removes this Sunday off, collaborator works
      } else {
        return null;
      }
    }
  }

  // STEP 5 — ALERTAS
  // Grid uses short display name (with fallback to first token of full name)
  const shortName = (collab.display_name && collab.display_name.trim())
    || (collab.collaborator_name || '').trim().split(/\s+/)[0]
    || collab.collaborator_name;
  let name = shortName;

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

function formatDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getScheduledCollaboratorIdsBySectorOnDate(
  collaborators: Collaborator[],
  date: Date,
  scheduledVacations: ScheduledVacation[] = [],
  dayOffOverrides?: DayOffOverridesMap,
  afastamentos: Afastamento[] = []
): Record<string, string[]> {
  const normalizedDate = dateOnly(date);
  const mondayOffset = normalizedDate.getDay() === 0 ? -6 : 1 - normalizedDate.getDay();
  const weekStart = new Date(normalizedDate);
  weekStart.setDate(normalizedDate.getDate() + mondayOffset);
  const weekStartKey = formatDateKey(weekStart);
  const collaboratorsBySector: Record<string, string[]> = {};

  for (const collab of collaborators) {
    const overrideKey = `${weekStartKey}|${collab.id}`;
    const override = dayOffOverrides?.get(overrideKey);
    const displayName = getDisplayName(collab, normalizedDate, scheduledVacations, override, afastamentos);
    if (!displayName) continue;

    if (!collaboratorsBySector[collab.sector]) {
      collaboratorsBySector[collab.sector] = [];
    }
    collaboratorsBySector[collab.sector].push(collab.id);
  }

  return collaboratorsBySector;
}

export function generateSchedule(
  collaborators: Collaborator[],
  year: number,
  month: number,
  scheduledVacations: ScheduledVacation[] = [],
  dayOffOverrides?: DayOffOverridesMap,
  afastamentos: Afastamento[] = []
): ScheduleWeek[] {
  const firstMonday = getFirstMondayOfMonthGrid(year, month);
  const totalWeeks = getWeekCount(year, month);
  const weeks: ScheduleWeek[] = [];

  for (let w = 0; w < totalWeeks; w++) {
    const weekStart = new Date(firstMonday);
    weekStart.setDate(firstMonday.getDate() + w * 7);
    const weekStartKey = formatDateKey(weekStart);
    const days: ScheduleDay[] = [];

    for (let d = 0; d < 7; d++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + d);
      const dayKey = JS_DAY_TO_KEY[date.getDay()];

      const label = dayKey === 'SEGUNDA'
        ? `Segunda: ${formatDateBR(date)}`
        : SHORT_LABELS[dayKey];

      const collaboratorsBySector: Record<string, string[]> = {};

      for (const collab of collaborators) {
        const overrideKey = `${weekStartKey}|${collab.id}`;
        const override = dayOffOverrides?.get(overrideKey);

        const displayName = getDisplayName(collab, date, scheduledVacations, override, afastamentos);
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

/**
 * Check if a collaborator is scheduled to work on a given date.
 */
export function isCollaboratorScheduledOnDate(
  collab: Collaborator,
  date: Date,
  scheduledVacations: ScheduledVacation[] = []
): boolean {
  return getDisplayName(collab, date, scheduledVacations) !== null;
}