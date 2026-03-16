import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface HRReminder {
  id: string;
  title: string;
  description: string;
  collaborator_id: string | null;
  collaborator_name: string;
  sector: string;
  responsible: string;
  event_date: string;
  event_time: string | null;
  reminder_type: string;
  priority: string;
  recurrence: string;
  status: string;
  conclusion_note: string;
  created_by: string;
  concluded_by: string;
  concluded_at: string | null;
  postponed_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface HRReminderInput {
  title: string;
  description?: string;
  collaborator_id?: string | null;
  collaborator_name?: string;
  sector?: string;
  responsible?: string;
  event_date: string;
  event_time?: string | null;
  reminder_type: string;
  priority?: string;
  recurrence?: string;
  status?: string;
  conclusion_note?: string;
  created_by?: string;
  concluded_by?: string;
  concluded_at?: string | null;
  postponed_to?: string | null;
}

export const REMINDER_TYPES = [
  { value: 'documento', label: 'Documento' },
  { value: 'pagamento', label: 'Pagamento' },
  { value: 'admissao', label: 'Admissão' },
  { value: 'desligamento', label: 'Desligamento' },
  { value: 'ferias', label: 'Férias' },
  { value: 'experiencia', label: 'Experiência' },
  { value: 'treinamento', label: 'Treinamento' },
  { value: 'exame', label: 'Exame' },
  { value: 'reuniao', label: 'Reunião' },
  { value: 'escala', label: 'Escala' },
  { value: 'contabilidade', label: 'Contabilidade' },
  { value: 'juridico', label: 'Jurídico' },
  { value: 'beneficio', label: 'Benefício' },
  { value: 'manutencao_cadastro', label: 'Manutenção de Cadastro' },
  { value: 'outro', label: 'Outro' },
] as const;

export const PRIORITIES = [
  { value: 'baixa', label: 'Baixa', color: 'bg-slate-400' },
  { value: 'media', label: 'Média', color: 'bg-blue-400' },
  { value: 'alta', label: 'Alta', color: 'bg-orange-400' },
  { value: 'critica', label: 'Crítica', color: 'bg-red-500' },
] as const;

export const REMINDER_STATUSES = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'concluido', label: 'Concluído' },
  { value: 'cancelado', label: 'Cancelado' },
  { value: 'adiado', label: 'Adiado' },
] as const;

export const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'Não repetir' },
  { value: 'weekly', label: 'Semanalmente' },
  { value: 'monthly', label: 'Mensalmente' },
  { value: 'yearly', label: 'Anualmente' },
] as const;

async function fetchReminders(): Promise<HRReminder[]> {
  const { data, error } = await supabase
    .from('hr_reminders')
    .select('*')
    .order('event_date', { ascending: true });
  if (error) throw error;
  return (data ?? []) as HRReminder[];
}

export function useReminders() {
  return useQuery({
    queryKey: ['hr_reminders'],
    queryFn: fetchReminders,
  });
}

export function useCreateReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: HRReminderInput) => {
      const { data, error } = await supabase
        .from('hr_reminders')
        .insert(input as any)
        .select()
        .single();
      if (error) throw error;
      return data as HRReminder;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr_reminders'] }),
  });
}

export function useUpdateReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<HRReminderInput> & { id: string }) => {
      const { data, error } = await supabase
        .from('hr_reminders')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as HRReminder;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr_reminders'] }),
  });
}

export function useDeleteReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('hr_reminders').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr_reminders'] }),
  });
}

/**
 * Generate recurring instances of a reminder for a date range.
 * Returns virtual event entries for display in calendar.
 */
export function generateRecurringInstances(
  reminder: HRReminder,
  rangeStart: Date,
  rangeEnd: Date,
): { date: string; reminder: HRReminder }[] {
  const instances: { date: string; reminder: HRReminder }[] = [];
  const baseDate = new Date(reminder.event_date + 'T00:00:00');

  if (reminder.recurrence === 'none') {
    if (baseDate >= rangeStart && baseDate <= rangeEnd) {
      instances.push({ date: reminder.event_date, reminder });
    }
    return instances;
  }

  let current = new Date(baseDate);
  const maxIterations = 365; // safety limit
  let i = 0;

  while (current <= rangeEnd && i < maxIterations) {
    if (current >= rangeStart) {
      const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
      instances.push({ date: dateStr, reminder });
    }

    switch (reminder.recurrence) {
      case 'weekly':
        current.setDate(current.getDate() + 7);
        break;
      case 'monthly':
        current.setMonth(current.getMonth() + 1);
        break;
      case 'yearly':
        current.setFullYear(current.getFullYear() + 1);
        break;
      default:
        return instances;
    }
    i++;
  }

  return instances;
}
