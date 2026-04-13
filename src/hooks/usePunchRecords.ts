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
  adjusted_by: string | null;
  adjusted_at: string | null;
  adjustment_reason: string | null;
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

export function usePunchRecords(month?: number, year?: number, startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['punch_records', month, year, startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from('punch_records')
        .select('*')
        .order('date', { ascending: false });

      if (startDate && endDate) {
        query = query.gte('date', startDate).lte('date', endDate);
      } else if (month !== undefined && year !== undefined) {
        const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        const endD = new Date(year, month + 1, 0);
        const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(endD.getDate()).padStart(2, '0')}`;
        query = query.gte('date', start).lte('date', end);
      } else {
        query = query.limit(5000);
      }

      const { data, error } = await query;
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
