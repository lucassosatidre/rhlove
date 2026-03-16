import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface FreelancerEntry {
  id: string;
  date: string;
  sector: string;
  name: string;
  status: string;
  origin: string;
  created_by: string;
  cancelled_by: string | null;
  cancelled_at: string | null;
  observation: string | null;
  created_at: string;
  updated_at: string;
}

export function useFreelancerEntries(startDate?: string, endDate?: string, includeAll = false) {
  return useQuery({
    queryKey: ['freelancer_entries', startDate, endDate, includeAll],
    queryFn: async (): Promise<FreelancerEntry[]> => {
      let q = supabase.from('freelancer_entries').select('*').order('date', { ascending: false });
      if (startDate) q = q.gte('date', startDate);
      if (endDate) q = q.lte('date', endDate);
      if (!includeAll) q = q.eq('status', 'ativo');
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as FreelancerEntry[];
    },
  });
}

export function useAllFreelancerEntries(startDate?: string, endDate?: string) {
  return useFreelancerEntries(startDate, endDate, true);
}

export function useAddFreelancerEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { date: string; sector: string; name: string; origin?: string; created_by?: string; observation?: string }) => {
      const { error } = await supabase
        .from('freelancer_entries')
        .insert({
          date: input.date,
          sector: input.sector,
          name: input.name,
          status: 'ativo',
          origin: input.origin || 'manual',
          created_by: input.created_by || '',
          observation: input.observation || '',
        } as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['freelancer_entries'] }),
  });
}

export function useBulkInsertFreelancerEntries() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entries: { date: string; sector: string; name: string; origin?: string; created_by?: string }[]) => {
      if (entries.length === 0) return;
      const toInsert = entries.map(e => ({
        date: e.date,
        sector: e.sector,
        name: e.name,
        status: 'ativo',
        origin: e.origin || 'importação',
        created_by: e.created_by || '',
      }));
      const { error } = await supabase.from('freelancer_entries').insert(toInsert as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['freelancer_entries'] }),
  });
}

export function useCancelFreelancerEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; cancelled_by?: string }) => {
      const { error } = await supabase
        .from('freelancer_entries')
        .update({
          status: 'cancelado',
          cancelled_by: input.cancelled_by || '',
          cancelled_at: new Date().toISOString(),
        } as any)
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['freelancer_entries'] });
      qc.invalidateQueries({ queryKey: ['freelancers'] });
    },
  });
}

export function useReactivateFreelancerEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('freelancer_entries')
        .update({
          status: 'ativo',
          cancelled_by: '',
          cancelled_at: null,
        } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['freelancer_entries'] });
      qc.invalidateQueries({ queryKey: ['freelancers'] });
    },
  });
}

export function useDeleteFreelancerEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('freelancer_entries')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['freelancer_entries'] }),
  });
}
