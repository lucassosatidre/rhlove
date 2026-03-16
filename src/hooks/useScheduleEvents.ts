import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type ScheduleEventType = 'FALTA' | 'ATESTADO' | 'COMPENSACAO' | 'TROCA_FOLGA';

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
    // For ATESTADO with range, expand to all dates
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

/** Build swap overrides: for a given week_start, returns which collaborators have swapped days */
export function buildSwapOverrides(events: ScheduleEvent[]): Map<string, { removeDays: string[]; addDays: string[] }> {
  const overrides = new Map<string, { removeDays: string[]; addDays: string[] }>();
  
  for (const ev of events) {
    if (ev.event_type !== 'TROCA_FOLGA' || !ev.week_start) continue;
    
    // Collaborator A: original_day is removed as day off, swapped_day is added as day off
    const keyA = `${ev.week_start}|${ev.collaborator_id}`;
    if (!overrides.has(keyA)) overrides.set(keyA, { removeDays: [], addDays: [] });
    const a = overrides.get(keyA)!;
    if (ev.original_day) a.removeDays.push(ev.original_day);
    if (ev.swapped_day) a.addDays.push(ev.swapped_day);
    
    // Collaborator B: swapped_day is removed as day off, original_day is added as day off
    if (ev.related_collaborator_id) {
      const keyB = `${ev.week_start}|${ev.related_collaborator_id}`;
      if (!overrides.has(keyB)) overrides.set(keyB, { removeDays: [], addDays: [] });
      const b = overrides.get(keyB)!;
      if (ev.swapped_day) b.removeDays.push(ev.swapped_day);
      if (ev.original_day) b.addDays.push(ev.original_day);
    }
  }
  
  return overrides;
}
