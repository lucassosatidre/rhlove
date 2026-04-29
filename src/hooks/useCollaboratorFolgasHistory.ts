import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CollaboratorFolgasHistoryEntry, FolgasAtDate } from '@/types/collaborator';

/**
 * Infraestrutura para histórico de folgas semanais.
 * Estes hooks ainda não são consumidos por nenhum componente — virão nos próximos prompts.
 */

export function useFolgasHistory(collaboratorId: string | null | undefined) {
  return useQuery({
    queryKey: ['folgas-history', collaboratorId],
    enabled: !!collaboratorId,
    queryFn: async (): Promise<CollaboratorFolgasHistoryEntry[]> => {
      const { data, error } = await supabase
        .from('collaborator_folgas_history' as any)
        .select('*')
        .eq('collaborator_id', collaboratorId as string)
        .order('vigente_desde', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CollaboratorFolgasHistoryEntry[];
    },
  });
}

export interface AddFolgasHistoryInput {
  collaborator_id: string;
  folgas_semanais: string[];
  sunday_n: number;
  vigente_desde: string; // YYYY-MM-DD
  motivo?: string | null;
  created_by?: string | null;
}

export function useAddFolgasHistoryEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AddFolgasHistoryInput) => {
      const { data, error } = await supabase
        .from('collaborator_folgas_history' as any)
        .insert({
          collaborator_id: input.collaborator_id,
          folgas_semanais: input.folgas_semanais,
          sunday_n: input.sunday_n,
          vigente_desde: input.vigente_desde,
          motivo: input.motivo ?? null,
          created_by: input.created_by ?? null,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as CollaboratorFolgasHistoryEntry;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['folgas-history', vars.collaborator_id] });
    },
  });
}

export function useDeleteFolgasHistoryEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, collaborator_id }: { id: string; collaborator_id: string }) => {
      const { error } = await supabase
        .from('collaborator_folgas_history' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
      return { id, collaborator_id };
    },
    onSuccess: ({ collaborator_id }) => {
      qc.invalidateQueries({ queryKey: ['folgas-history', collaborator_id] });
    },
  });
}

/**
 * Retorna a folga vigente de um colaborador em uma data específica,
 * via função SQL get_folgas_at. Retorna null se não houver entrada vigente.
 */
export async function getFolgasAt(
  collaboratorId: string,
  date: string // YYYY-MM-DD
): Promise<FolgasAtDate | null> {
  const { data, error } = await supabase.rpc('get_folgas_at' as any, {
    p_collaborator_id: collaboratorId,
    p_date: date,
  });
  if (error) throw error;
  const rows = (data ?? []) as Array<FolgasAtDate>;
  return rows.length > 0 ? rows[0] : null;
}
