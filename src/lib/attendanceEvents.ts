import type { ScheduleEvent, ScheduleEventType } from '@/hooks/useScheduleEvents';

export type AbsentCollaboratorIdsByDate = Map<string, Set<string>>;

const ABSENCE_EVENT_TYPES = new Set<ScheduleEventType>(['FALTA', 'ATESTADO']);

function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function buildAbsentCollaboratorIdsByDate(
  events: Pick<ScheduleEvent, 'collaborator_id' | 'event_type' | 'event_date' | 'event_date_end' | 'status'>[]
): AbsentCollaboratorIdsByDate {
  const map: AbsentCollaboratorIdsByDate = new Map();

  for (const event of events) {
    if (event.status !== 'ATIVO') continue;
    if (!ABSENCE_EVENT_TYPES.has(event.event_type)) continue;

    const start = new Date(event.event_date + 'T00:00:00');
    const end = new Date((event.event_date_end ?? event.event_date) + 'T00:00:00');

    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const dateKey = formatDateKey(date);
      if (!map.has(dateKey)) map.set(dateKey, new Set());
      map.get(dateKey)!.add(event.collaborator_id);
    }
  }

  return map;
}
