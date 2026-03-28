import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Afastamento {
  id: string;
  collaborator_id: string;
  collaborator_name: string;
  sector: string;
  motivo: string;
  data_inicio: string;
  data_fim: string;
  observacao: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useAfastamentos() {
  return useQuery({
    queryKey: ['afastamentos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('afastamentos')
        .select('*')
        .order('data_inicio', { ascending: false });
      if (error) throw error;
      return data as Afastamento[];
    },
  });
}

export function useAddAfastamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: Omit<Afastamento, 'id' | 'created_at' | 'updated_at'>) => {
      const { error } = await supabase.from('afastamentos').insert(a as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['afastamentos'] }),
  });
}

export function useUpdateAfastamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Afastamento> & { id: string }) => {
      const { error } = await supabase.from('afastamentos').update(updates as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['afastamentos'] }),
  });
}

export function useDeleteAfastamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('afastamentos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['afastamentos'] }),
  });
}

/**
 * Check if a collaborator is on leave on a given date.
 */
export function isOnAfastamento(
  afastamentos: Afastamento[],
  collaboratorId: string,
  date: Date
): boolean {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return afastamentos.some(a => {
    if (a.collaborator_id !== collaboratorId) return false;
    const inicio = new Date(a.data_inicio + 'T00:00:00');
    const fim = new Date(a.data_fim + 'T00:00:00');
    return d >= inicio && d <= fim;
  });
}
