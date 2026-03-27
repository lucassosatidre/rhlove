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
  inicio_na_empresa?: string | null;
  data_desligamento?: string | null;
  inicio_periodo?: string | null;
  fim_periodo?: string | null;
  pis_matricula?: string | null;
  intervalo_automatico?: boolean;
  intervalo_inicio?: string | null;
  carga_horaria_diaria?: string | null;
  intervalo_duracao?: number | null;
  // legacy
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
    inicio_na_empresa: c.inicio_na_empresa || null,
    data_desligamento: c.data_desligamento || null,
    inicio_periodo: c.inicio_periodo || null,
    fim_periodo: c.fim_periodo || null,
    pis_matricula: c.pis_matricula || null,
    intervalo_automatico: c.intervalo_automatico ?? false,
    intervalo_inicio: c.intervalo_inicio || null,
    intervalo_duracao: c.intervalo_duracao ?? null,
    carga_horaria_diaria: c.carga_horaria_diaria || null,
    data_retorno: c.data_retorno || c.fim_periodo || null,
    data_fim_experiencia: c.data_fim_experiencia || (c.status === 'EXPERIENCIA' ? c.fim_periodo : null) || null,
    data_fim_aviso: c.data_fim_aviso || (c.status === 'AVISO_PREVIO' ? c.fim_periodo : null) || null,
  };
}

function fromDbRow(row: any): Collaborator {
  return {
    ...row,
    folgas_semanais: row.folgas_semanais ?? [row.weekly_day_off?.toUpperCase() ?? 'SEGUNDA'],
    tipo_escala: row.tipo_escala ?? '6x1',
    status: row.status ?? 'ATIVO',
    inicio_na_empresa: row.inicio_na_empresa ?? null,
    data_desligamento: row.data_desligamento ?? null,
    inicio_periodo: row.inicio_periodo ?? null,
    fim_periodo: row.fim_periodo ?? null,
    pis_matricula: row.pis_matricula ?? null,
    genero: row.genero ?? 'M',
    intervalo_automatico: row.intervalo_automatico ?? false,
    intervalo_inicio: row.intervalo_inicio ?? null,
    intervalo_duracao: row.intervalo_duracao ?? null,
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
