import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PunchRecord {
  id: string;
  collaborator_id: string;
  collaborator_name: string;
  date: string;
  entrada: string | null;
  saida: string | null;
  saida_intervalo: string | null;
  retorno_intervalo: string | null;
}

export interface PunchRecordUpsert {
  collaborator_id: string;
  collaborator_name: string;
  date: string;
  entrada?: string | null;
  saida?: string | null;
  saida_intervalo?: string | null;
  retorno_intervalo?: string | null;
}

export function usePunchRecords() {
  return useQuery({
    queryKey: ['punch_records'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('punch_records')
        .select('*')
        .order('date', { ascending: false });
      if (error) throw error;
      return (data ?? []) as PunchRecord[];
    },
  });
}

export function useUpsertPunchRecords() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (records: PunchRecordUpsert[]) => {
      const { error } = await supabase
        .from('punch_records')
        .upsert(records as any, { onConflict: 'collaborator_id,date' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['punch_records'] }),
  });
}
