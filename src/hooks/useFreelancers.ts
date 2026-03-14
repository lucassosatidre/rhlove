import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Freelancer {
  id: string;
  date: string;
  sector: string;
  quantity: number;
  created_at: string;
  updated_at: string;
}

export interface FreelancerInput {
  date: string;
  sector: string;
  quantity: number;
}

export function useFreelancers(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['freelancers', startDate, endDate],
    queryFn: async (): Promise<Freelancer[]> => {
      let q = supabase.from('freelancers').select('*').order('date');
      if (startDate) q = q.gte('date', startDate);
      if (endDate) q = q.lte('date', endDate);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Freelancer[];
    },
  });
}

export function useUpsertFreelancer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: FreelancerInput) => {
      const { data: existing } = await supabase
        .from('freelancers')
        .select('id')
        .eq('date', input.date)
        .eq('sector', input.sector)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('freelancers')
          .update({ quantity: input.quantity } as any)
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('freelancers')
          .insert(input as any);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['freelancers'] }),
  });
}

export function useBulkUpsertFreelancers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: FreelancerInput[]) => {
      // Delete existing entries for these date+sector combos, then insert
      for (const row of rows) {
        await supabase
          .from('freelancers')
          .delete()
          .eq('date', row.date)
          .eq('sector', row.sector);
      }
      if (rows.length > 0) {
        const { error } = await supabase.from('freelancers').insert(rows as any);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['freelancers'] }),
  });
}

export function useDeleteFreelancer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('freelancers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['freelancers'] }),
  });
}
