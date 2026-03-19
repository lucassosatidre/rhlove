import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Manutencao {
  id: string;
  usuario_id: string;
  collaborator_name: string;
  description: string;
  sector: string;
  priority: string;
  status: string;
  observation: string;
  photo_paths: string[];
  created_at: string;
  updated_at: string;
}

export function useManutencoes(filters?: {
  collaborator?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  sector?: string;
}) {
  return useQuery({
    queryKey: ['manutencoes', filters],
    queryFn: async () => {
      let query = (supabase as any)
        .from('manutencoes')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.collaborator) {
        query = query.ilike('collaborator_name', `%${filters.collaborator}%`);
      }
      if (filters?.dateFrom) {
        query = query.gte('created_at', `${filters.dateFrom}T00:00:00`);
      }
      if (filters?.dateTo) {
        query = query.lte('created_at', `${filters.dateTo}T23:59:59`);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.sector) {
        query = query.ilike('sector', `%${filters.sector}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Manutencao[];
    },
  });
}

export function useCreateManutencao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      usuario_id: string;
      collaborator_name: string;
      description: string;
      sector: string;
      priority: string;
      observation: string;
      photo_paths: string[];
    }) => {
      const { data, error } = await (supabase as any)
        .from('manutencoes')
        .insert({ ...input, status: 'solicitado' })
        .select()
        .single();
      if (error) throw error;
      return data as Manutencao;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['manutencoes'] }),
  });
}

export function useUpdateManutencaoStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await (supabase as any)
        .from('manutencoes')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['manutencoes'] }),
  });
}
