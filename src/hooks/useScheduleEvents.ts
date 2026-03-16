import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { DayOffOverride, DayOffOverridesMap } from '@/lib/scheduleEngine';

export type ScheduleEventType = 'FALTA' | 'ATESTADO' | 'COMPENSACAO' | 'TROCA_FOLGA' | 'MUDANCA_FOLGA';

export interface ScheduleEvent {
  id: string;
  collaborator_id: string;
  collaborator_name: string;
  event_type: ScheduleEventType;
  event_date: string;
  event_date_end: string | null;
  observation: string;
  related_collaborator_id: string | null;
  related_collaborator_name: string | null;
  original_day: string | null;
  swapped_day: string | null;
  week_start: string | null;
  holiday_compensation_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ScheduleEventInput {
  collaborator_id: string;
  collaborator_name: string;
  event_type: ScheduleEventType;
  event_date: string;
  event_date_end?: string | null;
  observation?: string;
  related_collaborator_id?: string | null;
  related_collaborator_name?: string | null;
  original_day?: string | null;
  swapped_day?: string | null;
  week_start?: string | null;
  holiday_compensation_id?: string | null;
  created_by?: string;
}

export function useScheduleEvents(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['schedule_events', startDate, endDate],
    queryFn: async (): Promise<ScheduleEvent[]> => {
      if (!startDate || !endDate) return [];
      const { data, error } = await supabase
        .from('schedule_events')
        .select('*')
        .gte('event_date', startDate)
        .lte('event_date', endDate)
        .order('event_date');
      if (error) throw error;
      return (data ?? []) as ScheduleEvent[];
    },
    enabled: !!startDate && !!endDate,
  });
}

export function useCreateScheduleEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ScheduleEventInput) => {
      const { data, error } = await supabase
        .from('schedule_events')
        .insert(input as any)
        .select()
        .single();
      if (error) throw error;
      return data as ScheduleEvent;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule_events'] });
      qc.invalidateQueries({ queryKey: ['holiday_compensations'] });
    },
  });
}

export function useDeleteScheduleEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('schedule_events').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule_events'] });
      qc.invalidateQueries({ queryKey: ['holiday_compensations'] });
    },
  });
}

/** Build a lookup: dateKey -> collaborator_id -> ScheduleEvent[] */
export function buildEventsMap(events: ScheduleEvent[]): Record<string, Record<string, ScheduleEvent[]>> {
  const map: Record<string, Record<string, ScheduleEvent[]>> = {};
  for (const ev of events) {
    const start = new Date(ev.event_date + 'T00:00:00');
    const end = ev.event_date_end ? new Date(ev.event_date_end + 'T00:00:00') : start;
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!map[key]) map[key] = {};
      if (!map[key][ev.collaborator_id]) map[key][ev.collaborator_id] = [];
      map[key][ev.collaborator_id].push(ev);
    }
  }
  return map;
}

/**
 * Build day-off overrides from TROCA_FOLGA and MUDANCA_FOLGA events.
 * Returns a map keyed by "weekStartKey|collaboratorId" → DayOffOverride.
 *
 * For TROCA_FOLGA (swap between two people):
 *   - original_day = collaborator A's day off being given away
 *   - swapped_day  = collaborator B's day off that A receives
 *   Collaborator A: works on original_day, off on swapped_day
 *   Collaborator B: works on swapped_day, off on original_day
 *
 * For MUDANCA_FOLGA (move own day off):
 *   - original_day = collaborator's current day off being removed
 *   - swapped_day  = new day off for this week
 *   Collaborator: works on original_day, off on swapped_day
 */
export function buildSwapOverrides(events: ScheduleEvent[]): DayOffOverridesMap {
  const overrides: DayOffOverridesMap = new Map();

  const getOrCreate = (key: string): DayOffOverride => {
    if (!overrides.has(key)) overrides.set(key, { removeDays: [], addDays: [] });
    return overrides.get(key)!;
  };

  for (const ev of events) {
    if (ev.event_type !== 'TROCA_FOLGA' && ev.event_type !== 'MUDANCA_FOLGA') continue;
    if (!ev.week_start) continue;

    // Collaborator A
    const a = getOrCreate(`${ev.week_start}|${ev.collaborator_id}`);
    if (ev.original_day) a.removeDays.push(ev.original_day); // No longer off on original day
    if (ev.swapped_day) a.addDays.push(ev.swapped_day);       // Now off on swapped day

    // Collaborator B (only for TROCA_FOLGA)
    if (ev.event_type === 'TROCA_FOLGA' && ev.related_collaborator_id) {
      const b = getOrCreate(`${ev.week_start}|${ev.related_collaborator_id}`);
      if (ev.swapped_day) b.removeDays.push(ev.swapped_day); // B no longer off on their day
      if (ev.original_day) b.addDays.push(ev.original_day);   // B now off on A's original day
    }
  }

  return overrides;
}