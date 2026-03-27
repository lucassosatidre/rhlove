/**
 * Journey calculation engine for Espelho de Ponto.
 * All calculations are done in minutes (integers).
 */

/** Default daily workload in minutes (7h03 = 423 min) */
const DEFAULT_CH_PREVISTA = 423;
const TOLERANCE_MIN = 10;

export interface JornadaRow {
  date: string;
  chPrevista: number | null;     // planned workload (min)
  normais: number | null;        // normal hours worked (min)
  faltas: number | null;         // absence deficit (min)
  atraso: number | null;         // tolerated lateness (min)
  adiantamento: number | null;   // tolerated early extra (min)
  extraBH: number | null;        // overtime for hour bank (min)
  extra100: number | null;       // 100% overtime Art.386 (min)
  adNoturno: number | null;      // night premium (min, reduced)
  not100: number | null;         // night portion of extra100 (min)
  saldoBH: number | null;        // daily balance (min)
}

export interface JornadaTotals {
  chPrevista: number;
  normais: number;
  faltas: number;
  atraso: number;
  adiantamento: number;
  extraBH: number;
  extra100: number;
  adNoturno: number;
  not100: number;
  saldoBH: number;
}

interface PunchDay {
  entrada: string | null;
  saida: string | null;
  saidaInt: string | null;
  retornoInt: string | null;
}

interface DayInfo {
  date: string;
  isFolga: boolean;
  isVacation: boolean;
  isAfastamento: boolean;
  isHoliday: boolean;
  isFuture: boolean;
  punch: PunchDay;
  hoursWorkedMin: number | null;
}

function toMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

/**
 * Calculate night work minutes (after 22:00) with reduced hour factor.
 * Night hour = 52min30s real = 1h counted → factor 60/52.5 ≈ 1.1428
 */
function calcNightMinutes(punch: PunchDay): number {
  if (!punch.entrada || !punch.saida) return 0;

  const NIGHT_START = 22 * 60; // 22:00 in minutes
  
  const adjustOvernight = (min: number, ref: number) =>
    min < 180 && ref > min ? min + 1440 : min;

  const entradaMin = toMin(punch.entrada);
  const saidaMin = adjustOvernight(toMin(punch.saida), entradaMin);

  // Build work segments: [entrada, saidaInt] and [retornoInt, saida]
  type Seg = [number, number];
  const segments: Seg[] = [];

  if (punch.saidaInt && punch.retornoInt) {
    const siMin = toMin(punch.saidaInt);
    const riMin = adjustOvernight(toMin(punch.retornoInt), siMin);
    segments.push([entradaMin, siMin]);
    segments.push([riMin, saidaMin]);
  } else {
    segments.push([entradaMin, saidaMin]);
  }

  let nightReal = 0;
  for (const [start, end] of segments) {
    if (end <= NIGHT_START) continue;
    const nightStart = Math.max(start, NIGHT_START);
    nightReal += end - nightStart;
  }

  // Apply reduced hour: real minutes × (60/52.5)
  return nightReal > 0 ? Math.round(nightReal * (60 / 52.5)) : 0;
}

/**
 * Check if a collaborator (female) worked on 2+ consecutive Sundays.
 * Returns true if the given Sunday date is the 2nd+ consecutive worked Sunday.
 */
function isConsecutiveSunday(
  dateStr: string,
  allDays: DayInfo[],
): boolean {
  // Find index of this day
  const idx = allDays.findIndex(d => d.date === dateStr);
  if (idx < 0) return false;

  const current = allDays[idx];
  if (!current.punch.entrada) return false; // didn't work

  // Look backwards for the previous Sunday (7 days ago)
  const prevIdx = idx - 7;
  if (prevIdx < 0) return false; // can't check previous month yet

  const prevSunday = allDays[prevIdx];
  if (!prevSunday) return false;

  // Check if previous Sunday was also a worked day (has punch)
  return !!prevSunday.punch.entrada && !prevSunday.isFolga && !prevSunday.isVacation && !prevSunday.isAfastamento;
}

export function calculateJornada(
  days: DayInfo[],
  chPrevistaMin: number = DEFAULT_CH_PREVISTA,
  genero: string = 'M',
): { rows: JornadaRow[]; totals: JornadaTotals } {
  const jornadaRows: JornadaRow[] = [];

  for (const day of days) {
    const row: JornadaRow = {
      date: day.date,
      chPrevista: null,
      normais: null,
      faltas: null,
      atraso: null,
      adiantamento: null,
      extraBH: null,
      extra100: null,
      adNoturno: null,
      not100: null,
      saldoBH: null,
    };

    // Skip future days
    if (day.isFuture) {
      jornadaRows.push(row);
      continue;
    }

    // Days off, vacation, leave, holiday → no CH prevista
    if (day.isFolga || day.isVacation || day.isAfastamento || day.isHoliday) {
      // If worked on a holiday/folga, count as extra
      if (day.hoursWorkedMin && day.hoursWorkedMin > 0) {
        row.extraBH = day.hoursWorkedMin;
        row.saldoBH = day.hoursWorkedMin;
        row.adNoturno = calcNightMinutes(day.punch);
      }
      jornadaRows.push(row);
      continue;
    }

    // Check Art. 386 (consecutive Sundays for women)
    const dateObj = new Date(day.date + 'T12:00:00');
    const isSunday = dateObj.getDay() === 0;
    const isExtra100Day = genero === 'F' && isSunday && isConsecutiveSunday(day.date, days);

    if (isExtra100Day && day.hoursWorkedMin && day.hoursWorkedMin > 0) {
      // All hours count as Extra 100%, no CH prevista
      row.extra100 = day.hoursWorkedMin;
      row.adNoturno = calcNightMinutes(day.punch);
      if (row.adNoturno > 0) {
        row.not100 = row.adNoturno; // night portion of extra 100%
      }
      row.saldoBH = 0; // doesn't affect bank
      jornadaRows.push(row);
      continue;
    }

    // Normal working day
    row.chPrevista = chPrevistaMin;

    if (day.hoursWorkedMin === null || day.hoursWorkedMin === 0) {
      // Complete absence
      if (!day.punch.entrada) {
        row.faltas = chPrevistaMin;
        row.saldoBH = -chPrevistaMin;
      }
      jornadaRows.push(row);
      continue;
    }

    const worked = day.hoursWorkedMin;
    const diff = worked - chPrevistaMin; // positive = extra, negative = deficit

    row.normais = Math.min(worked, chPrevistaMin);
    row.adNoturno = calcNightMinutes(day.punch);

    if (diff >= 0) {
      // Worked >= CH
      if (diff <= TOLERANCE_MIN) {
        row.adiantamento = diff > 0 ? diff : null;
        row.saldoBH = 0;
      } else {
        row.extraBH = diff;
        row.saldoBH = diff;
      }
    } else {
      // Worked < CH
      const absDiff = Math.abs(diff);
      if (absDiff <= TOLERANCE_MIN) {
        row.atraso = absDiff > 0 ? absDiff : null;
        row.saldoBH = 0;
      } else {
        row.faltas = absDiff;
        row.saldoBH = -absDiff;
      }
    }

    jornadaRows.push(row);
  }

  // Calculate totals
  const totals: JornadaTotals = {
    chPrevista: 0, normais: 0, faltas: 0, atraso: 0,
    adiantamento: 0, extraBH: 0, extra100: 0, adNoturno: 0, not100: 0, saldoBH: 0,
  };

  for (const r of jornadaRows) {
    totals.chPrevista += r.chPrevista ?? 0;
    totals.normais += r.normais ?? 0;
    totals.faltas += r.faltas ?? 0;
    totals.atraso += r.atraso ?? 0;
    totals.adiantamento += r.adiantamento ?? 0;
    totals.extraBH += r.extraBH ?? 0;
    totals.extra100 += r.extra100 ?? 0;
    totals.adNoturno += r.adNoturno ?? 0;
    totals.not100 += r.not100 ?? 0;
    totals.saldoBH += r.saldoBH ?? 0;
  }

  return { rows: jornadaRows, totals };
}

/** Format minutes as HH:MM */
export function fmtHHMM(min: number | null): string {
  if (min === null || min === 0) return '';
  const abs = Math.abs(min);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/** Format balance with sign and color class */
export function fmtSaldo(min: number | null): { text: string; className: string } {
  if (min === null || min === 0) return { text: '', className: '' };
  const formatted = fmtHHMM(min);
  if (min > 0) return { text: `+${formatted}`, className: 'text-green-600' };
  return { text: `-${formatted}`, className: 'text-red-600' };
}
