import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BonusFuncaoPontos {
  id: string;
  funcao: string;
  carga_horaria: number;
  pontos: number;
}

export interface Bonus10Monthly {
  id: string;
  collaborator_id: string;
  month: number;
  year: number;
  funcao: string | null;
  carga_horaria: number | null;
  pontos: number | null;
  pontos_override: number | null;
  valor_ponto: number | null;
  valor_bonus: number | null;
  created_by: string | null;
}

export function useBonusFuncaoPontos() {
  return useQuery({
    queryKey: ['bonus_funcao_pontos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bonus_funcao_pontos' as any)
        .select('*')
        .order('funcao')
        .order('carga_horaria');
      if (error) throw error;
      return (data ?? []) as unknown as BonusFuncaoPontos[];
    },
  });
}

export function useCreateBonusFuncao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: { funcao: string; carga_horaria: number; pontos: number }) => {
      const { error } = await supabase.from('bonus_funcao_pontos' as any).insert(row as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bonus_funcao_pontos'] }),
  });
}

export function useUpdateBonusFuncao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; funcao?: string; carga_horaria?: number; pontos?: number }) => {
      const { error } = await supabase.from('bonus_funcao_pontos' as any).update(updates as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bonus_funcao_pontos'] }),
  });
}

export function useDeleteBonusFuncao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('bonus_funcao_pontos' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bonus_funcao_pontos'] }),
  });
}

export function useBonus10Monthly(month: number, year: number) {
  return useQuery({
    queryKey: ['bonus_10_monthly', month, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bonus_10_monthly' as any)
        .select('*')
        .eq('month', month)
        .eq('year', year);
      if (error) throw error;
      return (data ?? []) as unknown as Bonus10Monthly[];
    },
  });
}

export function useUpsertBonus10Monthly() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: any[]) => {
      const { error } = await supabase.from('bonus_10_monthly' as any).upsert(rows, { onConflict: 'collaborator_id,month,year' });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      if (vars.length > 0) {
        qc.invalidateQueries({ queryKey: ['bonus_10_monthly', vars[0].month, vars[0].year] });
      }
    },
  });
}
