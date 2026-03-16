import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { DayOffOverride, DayOffOverridesMap } from '@/lib/scheduleEngine';

export type ScheduleEventType = 'FALTA' | 'ATESTADO' | 'COMPENSACAO' | 'TROCA_FOLGA' | 'MUDANCA_FOLGA';
export type ScheduleEventStatus = 'ATIVO' | 'REVERTIDO';

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
  created_by: string | null;
  created_at: string;
  updated_at: string;
  status: ScheduleEventStatus;
  reverted_at: string | null;
  reverted_by: string | null;
  reverted_reason: string | null;
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
  created_by?: string | null;
}

const DAY_OFF_EVENT_TYPES: ScheduleEventType[] = ['TROCA_FOLGA', 'MUDANCA_FOLGA'];

async function replaceActiveDayOffAdjustments(input: ScheduleEventInput) {
  if (!DAY_OFF_EVENT_TYPES.includes(input.event_type)) return;

  const weekStart = input.week_start ?? input.event_date;
  if (!weekStart) return;

  const participantIds = [input.collaborator_id, input.related_collaborator_id]
    .filter((value): value is string => Boolean(value));

  if (participantIds.length === 0) return;

  const now = new Date().toISOString();
  const ids = participantIds.join(',');

  const { error } = await supabase
    .from('schedule_events')
    .update({
      status: 'REVERTIDO',
      reverted_at: now,
      reverted_by: input.created_by ?? null,
      reverted_reason: 'Substituído por um novo ajuste de folga',
    } as any)
    .eq('status', 'ATIVO')
    .eq('week_start', weekStart)
    .in('event_type', DAY_OFF_EVENT_TYPES)
    .or(`collaborator_id.in.(${ids}),related_collaborator_id.in.(${ids})`);

  if (error) throw error;
}

export function useScheduleEvents(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['schedule_events', startDate, endDate],
    queryFn: async (): Promise<ScheduleEvent[]> => {
      if (!startDate || !endDate) return [];
      const { data, error } = await supabase
        .from('schedule_events')
        .select('*')
        .eq('status', 'ATIVO')
        .gte('event_date', startDate)
        .lte('event_date', endDate)
        .order('event_date')
        .order('created_at');
      if (error) throw error;
      return (data ?? []) as ScheduleEvent[];
    },
    enabled: !!startDate && !!endDate,
  });
}

export function useScheduleAdjustmentHistory() {
  return useQuery({
    queryKey: ['schedule_adjustment_history'],
    queryFn: async (): Promise<ScheduleEvent[]> => {
      const { data, error } = await supabase
        .from('schedule_events')
        .select('*')
        .in('event_type', DAY_OFF_EVENT_TYPES)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ScheduleEvent[];
    },
  });
}

export function useCreateScheduleEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ScheduleEventInput) => {
      await replaceActiveDayOffAdjustments(input);

      const { data, error } = await supabase
        .from('schedule_events')
        .insert({ ...input, status: 'ATIVO' } as any)
        .select()
        .single();
      if (error) throw error;
      return data as ScheduleEvent;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule_events'] });
      qc.invalidateQueries({ queryKey: ['schedule_adjustment_history'] });
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
      qc.invalidateQueries({ queryKey: ['schedule_adjustment_history'] });
      qc.invalidateQueries({ queryKey: ['holiday_compensations'] });
    },
  });
}

export function useRevertScheduleEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reverted_by, reverted_reason }: { id: string; reverted_by?: string | null; reverted_reason?: string | null }) => {
      const { data, error } = await supabase
        .from('schedule_events')
        .update({
          status: 'REVERTIDO',
          reverted_at: new Date().toISOString(),
          reverted_by: reverted_by ?? null,
          reverted_reason: reverted_reason ?? 'Revertido manualmente',
        } as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as ScheduleEvent;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule_events'] });
      qc.invalidateQueries({ queryKey: ['schedule_adjustment_history'] });
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
 */
export function buildSwapOverrides(events: ScheduleEvent[]): DayOffOverridesMap {
  const overrides: DayOffOverridesMap = new Map();

  const getOrCreate = (key: string): DayOffOverride => {
    if (!overrides.has(key)) overrides.set(key, { removeDays: [], addDays: [] });
    return overrides.get(key)!;
  };

  const pushUnique = (list: string[], value: string | null) => {
    if (!value || list.includes(value)) return;
    list.push(value);
  };

  for (const ev of events) {
    if (ev.status !== 'ATIVO') continue;
    if (ev.event_type !== 'TROCA_FOLGA' && ev.event_type !== 'MUDANCA_FOLGA') continue;
    if (!ev.week_start) continue;

    const a = getOrCreate(`${ev.week_start}|${ev.collaborator_id}`);
    pushUnique(a.removeDays, ev.original_day);
    pushUnique(a.addDays, ev.swapped_day);

    if (ev.event_type === 'TROCA_FOLGA' && ev.related_collaborator_id) {
      const b = getOrCreate(`${ev.week_start}|${ev.related_collaborator_id}`);
      pushUnique(b.removeDays, ev.swapped_day);
      pushUnique(b.addDays, ev.original_day);
    }
  }

  return overrides;
}
