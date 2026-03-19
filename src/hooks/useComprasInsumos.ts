import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CompraInsumo {
  id: string;
  usuario_id: string;
  collaborator_name: string;
  item_name: string;
  stock_quantity: string;
  priority: string;
  status: string;
  observation: string;
  created_at: string;
  updated_at: string;
}

export function useComprasInsumos(filters?: {
  collaborator?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  item?: string;
}) {
  return useQuery({
    queryKey: ['compras_insumos', filters],
    queryFn: async () => {
      let query = (supabase as any)
        .from('compras_insumos')
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
      if (filters?.item) {
        query = query.ilike('item_name', `%${filters.item}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as CompraInsumo[];
    },
  });
}

export function useCreateCompraInsumo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      usuario_id: string;
      collaborator_name: string;
      item_name: string;
      stock_quantity: string;
      priority: string;
      observation: string;
    }) => {
      const { data, error } = await (supabase as any)
        .from('compras_insumos')
        .insert({ ...input, status: 'solicitado' })
        .select()
        .single();
      if (error) throw error;
      return data as CompraInsumo;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['compras_insumos'] }),
  });
}

export function useUpdateCompraInsumoStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await (supabase as any)
        .from('compras_insumos')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['compras_insumos'] }),
  });
}
