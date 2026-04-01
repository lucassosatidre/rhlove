import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BHTransaction {
  id: string;
  collaborator_id: string;
  semester_start: string;
  transaction_date: string;
  type: string;
  description: string;
  credit_minutes: number;
  debit_minutes: number;
  balance_after_minutes: number;
  reference_month: number | null;
  reference_year: number | null;
  created_by: string | null;
  created_at: string;
}

export interface BHFolga {
  id: string;
  collaborator_id: string;
  folga_date: string;
  hours_debited: number;
  reason: string;
  created_by: string | null;
  created_at: string;
}

export function useBHTransactions(semesterStart: string) {
  return useQuery({
    queryKey: ['bh_transactions', semesterStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bank_hours_transactions' as any)
        .select('*')
        .eq('semester_start', semesterStart)
        .order('transaction_date', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as BHTransaction[];
    },
  });
}

export function useBHTransactionsByCollaborator(collaboratorId: string | null, semesterStart: string) {
  return useQuery({
    queryKey: ['bh_transactions', collaboratorId, semesterStart],
    enabled: !!collaboratorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bank_hours_transactions' as any)
        .select('*')
        .eq('collaborator_id', collaboratorId!)
        .eq('semester_start', semesterStart)
        .order('transaction_date', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as BHTransaction[];
    },
  });
}

export function useInsertBHTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (record: Omit<BHTransaction, 'id' | 'created_at'>) => {
      const { error } = await supabase
        .from('bank_hours_transactions' as any)
        .insert(record as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bh_transactions'] }),
  });
}

export function useDeleteBHTransactionsBySemester() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { collaborator_id: string; semester_start: string; type: string; reference_month?: number; reference_year?: number }) => {
      let query = supabase
        .from('bank_hours_transactions' as any)
        .delete()
        .eq('collaborator_id', params.collaborator_id)
        .eq('semester_start', params.semester_start)
        .eq('type', params.type);
      if (params.reference_month !== undefined) query = query.eq('reference_month', params.reference_month);
      if (params.reference_year !== undefined) query = query.eq('reference_year', params.reference_year);
      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bh_transactions'] }),
  });
}

export function useInsertBHFolga() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (record: Omit<BHFolga, 'id' | 'created_at'>) => {
      const { error } = await supabase
        .from('bank_hours_folgas' as any)
        .insert(record as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bh_transactions'] }),
  });
}

// Semester utilities
export function getSemesterStart(date: Date): string {
  const m = date.getMonth(); // 0-indexed
  // Sem1: Dec-May (months 11,0,1,2,3,4) → starts Dec 1
  // Sem2: Jun-Nov (months 5,6,7,8,9,10) → starts Jun 1
  if (m >= 5 && m <= 10) {
    // Jun-Nov → starts Jun 1 of same year
    return `${date.getFullYear()}-06-01`;
  } else {
    // Dec-May → starts Dec 1 of previous year (or same if Dec)
    const year = m === 11 ? date.getFullYear() : date.getFullYear() - 1;
    return `${year}-12-01`;
  }
}

export function getSemesterLabel(start: string): string {
  const d = new Date(start + 'T12:00:00');
  const m = d.getMonth();
  const y = d.getFullYear();
  if (m === 11) return `Dez/${y} — Mai/${y + 1}`;
  return `Jun/${y} — Nov/${y}`;
}

export function getSemesterMonths(start: string): { month: number; year: number }[] {
  const d = new Date(start + 'T12:00:00');
  const months: { month: number; year: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const nd = new Date(d.getFullYear(), d.getMonth() + i, 1);
    months.push({ month: nd.getMonth() + 1, year: nd.getFullYear() });
  }
  return months;
}

export function getSemesterOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  // Generate a few semesters around now
  const now = new Date();
  const currentStart = getSemesterStart(now);
  const starts = new Set<string>();
  for (let offset = -2; offset <= 2; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth() + offset * 6, 1);
    starts.add(getSemesterStart(d));
  }
  const sorted = Array.from(starts).sort();
  for (const s of sorted) {
    options.push({ value: s, label: getSemesterLabel(s) });
  }
  return options;
}
