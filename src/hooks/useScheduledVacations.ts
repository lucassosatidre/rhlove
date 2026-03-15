import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ScheduledVacation {
  id: string;
  collaborator_id: string;
  collaborator_name: string;
  sector: string;
  data_inicio_ferias: string;
  data_fim_ferias: string;
  data_pagamento_ferias: string | null;
  status: 'PROGRAMADA' | 'EM_ANDAMENTO' | 'CONCLUIDA' | 'CANCELADA';
  observacao: string;
  created_at: string;
  updated_at: string;
}

export interface ScheduledVacationInput {
  collaborator_id: string;
  collaborator_name: string;
  sector: string;
  data_inicio_ferias: string;
  data_fim_ferias: string;
  observacao?: string;
  status?: string;
}

async function fetchScheduledVacations(): Promise<ScheduledVacation[]> {
  const { data, error } = await supabase
    .from('scheduled_vacations')
    .select('*')
    .order('data_inicio_ferias', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ScheduledVacation[];
}

export function useScheduledVacations() {
  return useQuery({
    queryKey: ['scheduled_vacations'],
    queryFn: fetchScheduledVacations,
  });
}

export function useCreateScheduledVacation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ScheduledVacationInput) => {
      const { data, error } = await supabase
        .from('scheduled_vacations')
        .insert(input as any)
        .select()
        .single();
      if (error) throw error;
      return data as ScheduledVacation;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scheduled_vacations'] }),
  });
}

export function useUpdateScheduledVacation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: ScheduledVacationInput & { id: string }) => {
      const { data, error } = await supabase
        .from('scheduled_vacations')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as ScheduledVacation;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scheduled_vacations'] }),
  });
}

export function useDeleteScheduledVacation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('scheduled_vacations').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scheduled_vacations'] }),
  });
}

/** Check if a collaborator is on scheduled vacation on a given date */
export function isOnScheduledVacation(
  vacations: ScheduledVacation[],
  collaboratorId: string,
  date: Date
): boolean {
  const sd = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  for (const v of vacations) {
    if (v.collaborator_id !== collaboratorId) continue;
    if (v.status === 'CANCELADA') continue;
    const inicio = new Date(v.data_inicio_ferias + 'T00:00:00');
    const fim = new Date(v.data_fim_ferias + 'T00:00:00');
    if (sd >= inicio && sd <= fim) return true;
  }
  return false;
}

/** Compute display status based on current date */
export function computeVacationStatus(v: ScheduledVacation): ScheduledVacation['status'] {
  if (v.status === 'CANCELADA') return 'CANCELADA';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const inicio = new Date(v.data_inicio_ferias + 'T00:00:00');
  const fim = new Date(v.data_fim_ferias + 'T00:00:00');
  if (today < inicio) return 'PROGRAMADA';
  if (today >= inicio && today <= fim) return 'EM_ANDAMENTO';
  return 'CONCLUIDA';
}
