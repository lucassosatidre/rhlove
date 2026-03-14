import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DailySales {
  id: string;
  date: string;
  faturamento_total: number;
  pedidos_totais: number;
  faturamento_salao: number;
  pedidos_salao: number;
  faturamento_tele: number;
  pedidos_tele: number;
  created_at: string;
  updated_at: string;
}

export interface DailySalesInput {
  date: string;
  faturamento_total: number;
  pedidos_totais: number;
  faturamento_salao: number;
  pedidos_salao: number;
  faturamento_tele: number;
  pedidos_tele: number;
}

export function useDailySales(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['daily_sales', startDate, endDate],
    queryFn: async (): Promise<DailySales[]> => {
      let q = supabase.from('daily_sales').select('*').order('date');
      if (startDate) q = q.gte('date', startDate);
      if (endDate) q = q.lte('date', endDate);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as DailySales[];
    },
  });
}

export function useUpsertDailySales() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: DailySalesInput) => {
      // Try update first, then insert
      const { data: existing } = await supabase
        .from('daily_sales')
        .select('id')
        .eq('date', input.date)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('daily_sales')
          .update(input as any)
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('daily_sales')
          .insert(input as any);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['daily_sales'] }),
  });
}

export function useDeleteDailySales() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('daily_sales').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['daily_sales'] }),
  });
}

export function useBulkInsertDailySales() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: DailySalesInput[]) => {
      // Upsert: delete existing dates then insert
      const dates = rows.map(r => r.date);
      if (dates.length > 0) {
        await supabase.from('daily_sales').delete().in('date', dates);
      }
      const { error } = await supabase.from('daily_sales').insert(rows as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['daily_sales'] }),
  });
}
