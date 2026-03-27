import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BankHoursBalance {
  id: string;
  collaborator_id: string;
  month: number;
  year: number;
  accumulated_balance: number;
}

export function useBankHoursBalance(collaboratorId: string | null) {
  return useQuery({
    queryKey: ['bank_hours_balance', collaboratorId],
    enabled: !!collaboratorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bank_hours_balance' as any)
        .select('*')
        .eq('collaborator_id', collaboratorId!)
        .order('year', { ascending: true })
        .order('month', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as BankHoursBalance[];
    },
  });
}

export function useUpsertBankHoursBalance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (record: { collaborator_id: string; month: number; year: number; accumulated_balance: number }) => {
      const { error } = await supabase
        .from('bank_hours_balance' as any)
        .upsert(record as any, { onConflict: 'collaborator_id,month,year' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bank_hours_balance'] }),
  });
}
