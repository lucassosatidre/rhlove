import type { Collaborator, DayOfWeek } from '@/types/collaborator';

export interface ScheduleWeek {
  weekNumber: number;
  startDate: Date; // Monday
  days: ScheduleDay[];
}

export interface ScheduleDay {
  date: Date;
  dayOfWeek: DayOfWeek;
  label: string; // "Segunda: 03/03"
  collaboratorsBySector: Record<string, string[]>; // sector → names
}

const JS_DAY_TO_KEY: DayOfWeek[] = [
  'domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado',
];

function getFirstMondayOfMonthGrid(year: number, month: number): Date {
  // month is 0-indexed
  const firstDay = new Date(year, month, 1);
  const dayOfWeek = firstDay.getDay(); // 0=Sun
  // If Monday (1), use it. Otherwise go back to previous Monday.
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(year, month, 1 + diff);
  return monday;
}

function getSundayNumber(date: Date): number {
  // Which Sunday of the month is this? (1-based)
  return Math.ceil(date.getDate() / 7);
}

function formatDateBR(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function generateSchedule(
  collaborators: Collaborator[],
  year: number,
  month: number // 0-indexed
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
      const dayLabel = `${
        dayKey === 'segunda' ? 'Seg' :
        dayKey === 'terca' ? 'Ter' :
        dayKey === 'quarta' ? 'Qua' :
        dayKey === 'quinta' ? 'Qui' :
        dayKey === 'sexta' ? 'Sex' :
        dayKey === 'sabado' ? 'Sáb' : 'Dom'
      }: ${formatDateBR(date)}`;

      const collaboratorsBySector: Record<string, string[]> = {};

      for (const collab of collaborators) {
        // Skip if it's their weekly day off
        if (collab.weekly_day_off === dayKey) continue;

        // Skip if it's Sunday and it's their sunday_n off
        if (dayKey === 'domingo') {
          const sundayNum = getSundayNumber(date);
          if (collab.sunday_n === sundayNum) continue;
        }

        if (!collaboratorsBySector[collab.sector]) {
          collaboratorsBySector[collab.sector] = [];
        }
        collaboratorsBySector[collab.sector].push(collab.collaborator_name);
      }

      days.push({ date, dayOfWeek: dayKey, label: dayLabel, collaboratorsBySector });
    }

    weeks.push({ weekNumber: w + 1, startDate: weekStart, days });
  }

  return weeks;
}

export function getMonthLabel(year: number, month: number): string {
  const d = new Date(year, month, 1);
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}
