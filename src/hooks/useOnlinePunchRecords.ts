import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface OnlinePunchRecord {
  id: string;
  collaborator_id: string;
  punch_time: string;
  device_ip: string | null;
  device_user_agent: string | null;
  created_by: string;
  notes: string | null;
  created_at: string;
}

export function useOnlinePunchRecords(collaboratorId: string | null, date?: string) {
  return useQuery({
    queryKey: ['online_punch_records', collaboratorId, date],
    queryFn: async () => {
      if (!collaboratorId) return [];
      let query = supabase
        .from('online_punch_records')
        .select('*')
        .eq('collaborator_id', collaboratorId)
        .order('punch_time', { ascending: true });

      if (date) {
        // Filter by date (BRT day boundaries)
        const startOfDay = `${date}T00:00:00-03:00`;
        const endOfDay = `${date}T23:59:59-03:00`;
        query = query.gte('punch_time', startOfDay).lte('punch_time', endOfDay);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as OnlinePunchRecord[];
    },
    enabled: !!collaboratorId,
  });
}

export function useOnlinePunchRecordsByRange(collaboratorId: string | null, startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['online_punch_records_range', collaboratorId, startDate, endDate],
    queryFn: async () => {
      if (!collaboratorId || !startDate || !endDate) return [];
      const { data, error } = await supabase
        .from('online_punch_records')
        .select('*')
        .eq('collaborator_id', collaboratorId)
        .gte('punch_time', `${startDate}T00:00:00-03:00`)
        .lte('punch_time', `${endDate}T23:59:59-03:00`)
        .order('punch_time', { ascending: true });
      if (error) throw error;
      return (data ?? []) as OnlinePunchRecord[];
    },
    enabled: !!collaboratorId && !!startDate && !!endDate,
  });
}

export function useAllOnlinePunchRecordsByRange(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['online_punch_records_all_range', startDate, endDate],
    queryFn: async () => {
      if (!startDate || !endDate) return [];
      const { data, error } = await supabase
        .from('online_punch_records')
        .select('*')
        .gte('punch_time', `${startDate}T00:00:00-03:00`)
        .lte('punch_time', `${endDate}T23:59:59-03:00`)
        .order('punch_time', { ascending: true });
      if (error) throw error;
      return (data ?? []) as OnlinePunchRecord[];
    },
    enabled: !!startDate && !!endDate,
  });
}

export function useInsertOnlinePunch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (record: {
      collaborator_id: string;
      punch_time: string;
      created_by: string;
      device_user_agent?: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('online_punch_records')
        .insert(record as any)
        .select()
        .single();
      if (error) throw error;
      return data as OnlinePunchRecord;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['online_punch_records'] });
    },
  });
}
