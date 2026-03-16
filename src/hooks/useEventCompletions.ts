import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EventCompletion {
  id: string;
  event_key: string;
  status: string; // pendente | concluido | nao_executado
  override_date: string | null;
  original_date: string | null;
  concluded_at: string | null;
  concluded_by: string;
  conclusion_note: string;
  created_at: string;
  updated_at: string;
}

export function useEventCompletions() {
  return useQuery({
    queryKey: ['hr_event_completions'],
    queryFn: async (): Promise<EventCompletion[]> => {
      const { data, error } = await supabase
        .from('hr_event_completions' as any)
        .select('*');
      if (error) throw error;
      return (data ?? []) as unknown as EventCompletion[];
    },
  });
}

export function useUpsertEventCompletion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      event_key: string;
      status: string;
      override_date?: string | null;
      original_date?: string | null;
      concluded_at?: string | null;
      concluded_by?: string;
      conclusion_note?: string;
    }) => {
      const { data, error } = await supabase
        .from('hr_event_completions' as any)
        .upsert(input as any, { onConflict: 'event_key' })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as EventCompletion;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr_event_completions'] }),
  });
}
