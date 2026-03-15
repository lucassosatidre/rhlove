import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface FreelancerEntry {
  id: string;
  date: string;
  sector: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export function useFreelancerEntries(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['freelancer_entries', startDate, endDate],
    queryFn: async (): Promise<FreelancerEntry[]> => {
      let q = supabase.from('freelancer_entries' as any).select('*').order('date');
      if (startDate) q = q.gte('date', startDate);
      if (endDate) q = q.lte('date', endDate);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as FreelancerEntry[];
    },
  });
}

export function useAddFreelancerEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { date: string; sector: string; name: string }) => {
      const { error } = await supabase
        .from('freelancer_entries' as any)
        .insert(input as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['freelancer_entries'] }),
  });
}

export function useDeleteFreelancerEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('freelancer_entries' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['freelancer_entries'] }),
  });
}
