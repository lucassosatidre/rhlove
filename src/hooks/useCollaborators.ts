import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Collaborator, DayOfWeek, TipoEscala, CollaboratorStatus } from '@/types/collaborator';

export interface CollaboratorInput {
  collaborator_name: string;
  sector: string;
  tipo_escala: TipoEscala;
  folgas_semanais: DayOfWeek[];
  sunday_n: number;
  status: CollaboratorStatus;
  data_retorno?: string | null;
  data_fim_experiencia?: string | null;
  data_fim_aviso?: string | null;
}

function toDbRow(c: CollaboratorInput) {
  return {
    collaborator_name: c.collaborator_name,
    sector: c.sector,
    tipo_escala: c.tipo_escala,
    folgas_semanais: c.folgas_semanais,
    sunday_n: c.sunday_n,
    status: c.status,
    weekly_day_off: c.folgas_semanais[0]?.toLowerCase() ?? 'segunda',
    data_retorno: c.data_retorno || null,
    data_fim_experiencia: c.data_fim_experiencia || null,
    data_fim_aviso: c.data_fim_aviso || null,
  };
}

function fromDbRow(row: any): Collaborator {
  return {
    ...row,
    folgas_semanais: row.folgas_semanais ?? [row.weekly_day_off?.toUpperCase() ?? 'SEGUNDA'],
    tipo_escala: row.tipo_escala ?? '6x1',
    status: row.status ?? 'ATIVO',
  } as Collaborator;
}

async function fetchCollaborators(): Promise<Collaborator[]> {
  const { data, error } = await supabase
    .from('collaborators')
    .select('*')
    .order('sector')
    .order('collaborator_name');
  if (error) throw error;
  return (data ?? []).map(fromDbRow);
}

export function useCollaborators() {
  return useQuery({
    queryKey: ['collaborators'],
    queryFn: fetchCollaborators,
  });
}

export function useCreateCollaborator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (c: CollaboratorInput) => {
      const { data, error } = await supabase.from('collaborators').insert(toDbRow(c) as any).select().single();
      if (error) throw error;
      return fromDbRow(data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['collaborators'] }),
  });
}

export function useUpdateCollaborator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: CollaboratorInput & { id: string }) => {
      const { data, error } = await supabase.from('collaborators').update(toDbRow(updates) as any).eq('id', id).select().single();
      if (error) throw error;
      return fromDbRow(data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['collaborators'] }),
  });
}

export function useDeleteCollaborator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('collaborators').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['collaborators'] }),
  });
}

export function useBulkInsertCollaborators() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: CollaboratorInput[]) => {
      const { error } = await supabase.from('collaborators').insert(rows.map(r => toDbRow(r)) as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['collaborators'] }),
  });
}
