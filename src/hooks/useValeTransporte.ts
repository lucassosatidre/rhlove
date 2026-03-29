import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface VtConfig {
  id: string;
  valor_passagem: number;
  updated_at: string;
  updated_by: string | null;
}

export interface VtMonthly {
  id: string;
  collaborator_id: string;
  month: number;
  year: number;
  saldo_cartao: number | null;
  recarga_integral: number | null;
  recarga_necessaria: number | null;
  desconto_folha: number | null;
  custo_empresa: number | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export function useVtConfig() {
  return useQuery({
    queryKey: ['vt_config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vt_config')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();
      if (error) throw error;
      return data as VtConfig;
    },
  });
}

export function useUpdateVtConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, valor_passagem, updated_by }: { id: string; valor_passagem: number; updated_by: string }) => {
      const { error } = await supabase
        .from('vt_config')
        .update({ valor_passagem, updated_at: new Date().toISOString(), updated_by } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vt_config'] }),
  });
}

export function useVtMonthly(month: number, year: number) {
  return useQuery({
    queryKey: ['vt_monthly', month, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vt_monthly')
        .select('*')
        .eq('month', month)
        .eq('year', year);
      if (error) throw error;
      return data as VtMonthly[];
    },
  });
}

export function useUpsertVtMonthly() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: Omit<VtMonthly, 'id' | 'created_at' | 'updated_at'>[]) => {
      const { error } = await supabase
        .from('vt_monthly')
        .upsert(rows as any, { onConflict: 'collaborator_id,month,year' });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      if (vars.length > 0) {
        qc.invalidateQueries({ queryKey: ['vt_monthly', vars[0].month, vars[0].year] });
      }
    },
  });
}

export function useUpdateVtMonthlySaldo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, saldo_cartao, recarga_necessaria, desconto_folha, custo_empresa }: {
      id: string; saldo_cartao: number | null; recarga_necessaria: number | null;
      desconto_folha: number | null; custo_empresa: number | null;
    }) => {
      const { error } = await supabase
        .from('vt_monthly')
        .update({ saldo_cartao, recarga_necessaria, desconto_folha, custo_empresa, updated_at: new Date().toISOString() } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vt_monthly'] }),
  });
}
