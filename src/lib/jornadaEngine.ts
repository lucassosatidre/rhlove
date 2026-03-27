/**
 * Journey calculation engine for Espelho de Ponto.
 * All calculations are done in minutes (integers).
 */

/** Default daily workload in minutes (7h03 = 423 min) */
const DEFAULT_CH_PREVISTA = 423;
const TOLERANCE_MIN = 10;

export interface JornadaRow {
  date: string;
  chPrevista: number | null;
  normais: number | null;
  faltas: number | null;
  atraso: number | null;
  adiantamento: number | null;
  extraBH: number | null;
  extra100: number | null;
  adNoturno: number | null;
  not100: number | null;
  saldoBH: number | null;
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
  chOverride?: number;
}

function toMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

/**
 * Calculate night work minutes (after 22:00).
 * Returns REAL minutes worked after 22:00, excluding break time.
 * Does NOT apply the reduced hour factor (60/52.5) — that's for payroll only.
 */
function calcNightMinutes(punch: PunchDay): number {
  if (!punch.entrada || !punch.saida) return 0;

  const NIGHT_START = 22 * 60; // 22:00 in minutes

  const adjustOvernight = (min: number, ref: number) =>
    min < 180 && ref > min ? min + 1440 : min;

  const entradaMin = toMin(punch.entrada);
  const saidaMin = adjustOvernight(toMin(punch.saida), entradaMin);

  // Build work segments excluding break
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

  return nightReal;
}

export function calculateJornada(
  days: DayInfo[],
  chPrevistaMin: number = DEFAULT_CH_PREVISTA,
  genero: string = 'M',
  consecutiveSundaysFromPrevious: number = 0,
): { rows: JornadaRow[]; totals: JornadaTotals; consecutiveSundaysEnd: number } {
  const jornadaRows: JornadaRow[] = [];
  let sundayCounter = genero === 'F' ? consecutiveSundaysFromPrevious : 0;

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

    // Check Art. 386 (consecutive Sundays for women)
    const dateObj = new Date(day.date + 'T12:00:00');
    const isSunday = dateObj.getDay() === 0;

    if (genero === 'F' && isSunday) {
      // Folga Sunday (scheduled off and didn't work) → reset counter
      if (day.isFolga && (!day.hoursWorkedMin || day.hoursWorkedMin === 0)) {
        sundayCounter = 0;
      } else {
        // Worked or was supposed to work (falta counts as scheduled work for counter)
        sundayCounter++;
        if (sundayCounter >= 2 && day.hoursWorkedMin && day.hoursWorkedMin > 0) {
          // Extra 100% day
          row.extra100 = day.hoursWorkedMin;
          row.adNoturno = calcNightMinutes(day.punch);
          if (row.adNoturno > 0) {
            row.not100 = row.adNoturno;
          }
          row.saldoBH = 0;
          sundayCounter = 0; // reset after paying 100%
          jornadaRows.push(row);
          continue;
        }
      }
    }

    // Days off, vacation, leave, holiday → no CH prevista
    if (day.isFolga || day.isVacation || day.isAfastamento || day.isHoliday) {
      if (day.hoursWorkedMin && day.hoursWorkedMin > 0) {
        row.extraBH = day.hoursWorkedMin;
        row.saldoBH = day.hoursWorkedMin;
        row.adNoturno = calcNightMinutes(day.punch);
      }
      jornadaRows.push(row);
      continue;
    }

    // Normal working day
    row.chPrevista = day.chOverride ?? chPrevistaMin;
    const dayCH = row.chPrevista!;

    if (day.hoursWorkedMin === null || day.hoursWorkedMin === 0) {
      if (!day.punch.entrada) {
        row.faltas = dayCH;
        row.saldoBH = -dayCH;
      }
      jornadaRows.push(row);
      continue;
    }

    const worked = day.hoursWorkedMin;
    const diff = worked - dayCH;

    row.normais = Math.min(worked, dayCH);
    row.adNoturno = calcNightMinutes(day.punch);

    if (diff >= 0) {
      if (diff <= TOLERANCE_MIN) {
        row.adiantamento = diff > 0 ? diff : null;
        row.saldoBH = 0;
      } else {
        row.extraBH = diff;
        row.saldoBH = diff;
      }
    } else {
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
