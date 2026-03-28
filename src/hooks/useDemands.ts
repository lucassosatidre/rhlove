import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Demand {
  id: string;
  title: string;
  description: string | null;
  type: string;
  priority: string;
  status: string;
  sector: string | null;
  assigned_to: string | null;
  created_by: string;
  due_date: string | null;
  photos: string[];
  item_name: string | null;
  stock_quantity: string | null;
  observation: string | null;
  created_at: string;
  updated_at: string;
}

export interface DemandComment {
  id: string;
  demand_id: string;
  user_id: string;
  comment: string;
  created_at: string;
}

export interface DemandStatusHistory {
  id: string;
  demand_id: string;
  old_status: string | null;
  new_status: string;
  changed_by: string;
  created_at: string;
}

export function useDemands() {
  const { usuario } = useAuth();
  return useQuery({
    queryKey: ['demands', usuario?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('demands' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Demand[];
    },
    enabled: !!usuario,
  });
}

export function useOpenDemandsCount() {
  const { usuario } = useAuth();
  return useQuery({
    queryKey: ['demands', 'open_count', usuario?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('demands' as any)
        .select('id, status, assigned_to, due_date')
        .or(`assigned_to.eq.${usuario!.id},created_by.eq.${usuario!.id}`)
        .not('status', 'in', '("concluida","cancelada")');
      if (error) throw error;
      const items = (data || []) as any[];
      const now = new Date().toISOString().slice(0, 10);
      let count = 0;
      for (const d of items) {
        if (d.assigned_to === usuario!.id && !['concluida', 'cancelada'].includes(d.status)) count++;
        else if (d.due_date && d.due_date < now && !['concluida', 'cancelada'].includes(d.status)) count++;
      }
      return count;
    },
    enabled: !!usuario,
    refetchInterval: 30000,
  });
}

export function useCreateDemand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (demand: Partial<Demand> & { created_by: string }) => {
      const { data, error } = await supabase
        .from('demands' as any)
        .insert({ ...demand, status: 'em_andamento' } as any)
        .select()
        .single();
      if (error) throw error;
      await supabase.from('demand_status_history' as any).insert({
        demand_id: (data as any).id,
        old_status: null,
        new_status: 'em_andamento',
        changed_by: demand.created_by,
      } as any);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['demands'] }),
  });
}

export function useUpdateDemandStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ demandId, oldStatus, newStatus, userId }: { demandId: string; oldStatus: string; newStatus: string; userId: string }) => {
      const { error } = await supabase
        .from('demands' as any)
        .update({ status: newStatus } as any)
        .eq('id', demandId);
      if (error) throw error;
      await supabase.from('demand_status_history' as any).insert({
        demand_id: demandId,
        old_status: oldStatus,
        new_status: newStatus,
        changed_by: userId,
      } as any);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['demands'] }),
  });
}

export function useDemandComments(demandId: string) {
  const qc = useQueryClient();
  const commentsQuery = useQuery({
    queryKey: ['demand_comments', demandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('demand_comments' as any)
        .select('*')
        .eq('demand_id', demandId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as DemandComment[];
    },
    enabled: !!demandId,
  });
  const addComment = useMutation({
    mutationFn: async ({ userId, comment }: { userId: string; comment: string }) => {
      const { error } = await supabase
        .from('demand_comments' as any)
        .insert({ demand_id: demandId, user_id: userId, comment } as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['demand_comments', demandId] }),
  });
  return { commentsQuery, addComment };
}

export function useDemandHistory(demandId: string) {
  return useQuery({
    queryKey: ['demand_status_history', demandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('demand_status_history' as any)
        .select('*')
        .eq('demand_id', demandId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as DemandStatusHistory[];
    },
    enabled: !!demandId,
  });
}

export function useUsuarios() {
  return useQuery({
    queryKey: ['usuarios_list'],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('usuarios')
        .select('*')
        .eq('status', 'ativo')
        .order('nome') as any);
      if (error) throw error;
      return (data || []) as { id: string; nome: string; email: string; collaborator_id?: string | null }[];
    },
  });
}
