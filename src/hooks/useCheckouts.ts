import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Checkout {
  id: string;
  usuario_id: string;
  collaborator_name: string;
  checkout_date: string;
  checkout_time: string;
  duration_seconds: number;
  transcription: string | null;
  transcription_status: string;
  audio_path: string | null;
  created_at: string;
  updated_at: string;
}

export function useCheckouts(filters?: {
  collaborator?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
}) {
  return useQuery({
    queryKey: ['checkouts', filters],
    queryFn: async () => {
      let query = (supabase as any)
        .from('checkouts')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.collaborator) {
        query = query.ilike('collaborator_name', `%${filters.collaborator}%`);
      }
      if (filters?.dateFrom) {
        query = query.gte('checkout_date', filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte('checkout_date', filters.dateTo);
      }
      if (filters?.status) {
        query = query.eq('transcription_status', filters.status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Checkout[];
    },
  });
}

export function useCreateCheckout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      usuario_id: string;
      collaborator_name: string;
      duration_seconds: number;
      audio_path: string;
    }) => {
      const now = new Date();
      const { data, error } = await (supabase as any)
        .from('checkouts')
        .insert({
          ...input,
          checkout_date: now.toISOString().split('T')[0],
          checkout_time: now.toTimeString().split(' ')[0],
          transcription_status: 'processando',
        })
        .select()
        .single();
      if (error) throw error;
      return data as Checkout;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checkouts'] }),
  });
}

export function useRetryTranscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (checkout: Checkout) => {
      // Update status to processing
      await (supabase as any)
        .from('checkouts')
        .update({ transcription_status: 'processando' })
        .eq('id', checkout.id);

      // Call transcription edge function
      const { error } = await supabase.functions.invoke('transcribe-checkout', {
        body: { checkoutId: checkout.id, audioPath: checkout.audio_path },
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checkouts'] }),
  });
}
