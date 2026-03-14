import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Holiday {
  id: string;
  date: string;
  name: string;
  created_at: string;
}

export interface HolidayCompensation {
  id: string;
  collaborator_id: string;
  collaborator_name: string;
  sector: string;
  holiday_date: string;
  holiday_name: string;
  eligible: boolean;
  status: 'NAO' | 'SIM' | 'COMPENSADO';
  compensation_date: string | null;
  observacao: string;
  created_at: string;
  updated_at: string;
}

export interface HolidayCompensationInput {
  collaborator_id: string;
  collaborator_name: string;
  sector: string;
  holiday_date: string;
  holiday_name: string;
  eligible: boolean;
  status: string;
  compensation_date?: string | null;
  observacao?: string;
}

export function useHolidays() {
  return useQuery({
    queryKey: ['holidays'],
    queryFn: async (): Promise<Holiday[]> => {
      const { data, error } = await supabase
        .from('holidays')
        .select('*')
        .order('date');
      if (error) throw error;
      return (data ?? []) as Holiday[];
    },
  });
}

export function useCreateHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { date: string; name: string }) => {
      const { data, error } = await supabase
        .from('holidays')
        .insert(input as any)
        .select()
        .single();
      if (error) throw error;
      return data as Holiday;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['holidays'] }),
  });
}

export function useDeleteHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('holidays').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['holidays'] }),
  });
}

export function useHolidayCompensations() {
  return useQuery({
    queryKey: ['holiday_compensations'],
    queryFn: async (): Promise<HolidayCompensation[]> => {
      const { data, error } = await supabase
        .from('holiday_compensations')
        .select('*')
        .order('holiday_date');
      if (error) throw error;
      return (data ?? []) as HolidayCompensation[];
    },
  });
}

export function useUpsertHolidayCompensation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: HolidayCompensationInput) => {
      const { data, error } = await supabase
        .from('holiday_compensations')
        .upsert(input as any, { onConflict: 'collaborator_id,holiday_date' })
        .select()
        .single();
      if (error) throw error;
      return data as HolidayCompensation;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['holiday_compensations'] }),
  });
}

export function useBulkUpsertHolidayCompensations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (inputs: HolidayCompensationInput[]) => {
      if (inputs.length === 0) return;
      const { error } = await supabase
        .from('holiday_compensations')
        .upsert(inputs as any[], { onConflict: 'collaborator_id,holiday_date', ignoreDuplicates: true });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['holiday_compensations'] }),
  });
}

export function useUpdateHolidayCompensation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<HolidayCompensationInput> & { id: string }) => {
      const { data, error } = await supabase
        .from('holiday_compensations')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as HolidayCompensation;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['holiday_compensations'] }),
  });
}
