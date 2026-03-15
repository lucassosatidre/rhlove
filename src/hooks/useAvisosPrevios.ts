import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AvisoPrevio {
  id: string;
  collaborator_id: string;
  collaborator_name: string;
  sector: string;
  opcao: string;
  data_inicio: string;
  data_fim: string;
  data_pagamento: string | null;
  pago: boolean;
  exame: boolean;
  assinatura: boolean;
  enviado_contabilidade: boolean;
  data_envio_contabilidade: string | null;
  observacoes: string | null;
  status_processo: string;
  created_at: string;
  updated_at: string;
}

export interface AvisoPrevioInput {
  collaborator_id: string;
  collaborator_name: string;
  sector: string;
  opcao: string;
  data_inicio: string;
  data_fim: string;
  data_pagamento?: string | null;
  pago?: boolean;
  exame?: boolean;
  assinatura?: boolean;
  enviado_contabilidade?: boolean;
  data_envio_contabilidade?: string | null;
  observacoes?: string;
  status_processo?: string;
}

export function useAvisosPrevios() {
  return useQuery({
    queryKey: ['avisos_previos'],
    queryFn: async (): Promise<AvisoPrevio[]> => {
      const { data, error } = await supabase
        .from('avisos_previos' as any)
        .select('*')
        .order('data_fim', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as AvisoPrevio[];
    },
  });
}

export function useCreateAvisoPrevio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AvisoPrevioInput) => {
      const { data, error } = await supabase
        .from('avisos_previos' as any)
        .insert(input as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as AvisoPrevio;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['avisos_previos'] });
      qc.invalidateQueries({ queryKey: ['collaborators'] });
    },
  });
}

export function useUpdateAvisoPrevio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AvisoPrevioInput> & { id: string }) => {
      const { data, error } = await supabase
        .from('avisos_previos' as any)
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as AvisoPrevio;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['avisos_previos'] });
      qc.invalidateQueries({ queryKey: ['collaborators'] });
    },
  });
}

export function useDeleteAvisoPrevio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('avisos_previos' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['avisos_previos'] });
      qc.invalidateQueries({ queryKey: ['collaborators'] });
    },
  });
}

// Helper: compute checklist and pendências for one aviso
export function getAvisoChecklist(a: AvisoPrevio) {
  const items = [
    { label: 'Informações enviadas para a contabilidade', done: a.enviado_contabilidade },
    { label: 'Data de envio para contabilidade preenchida', done: !!a.data_envio_contabilidade },
    { label: 'Forma de cumprimento definida', done: !!a.opcao },
    { label: 'Data de início preenchida', done: !!a.data_inicio },
    { label: 'Data de fim preenchida', done: !!a.data_fim },
    { label: 'Data de pagamento preenchida', done: !!a.data_pagamento },
    { label: 'Pagamento realizado', done: a.pago },
    { label: 'Exame demissional realizado', done: a.exame },
    { label: 'Assinatura da rescisão realizada', done: a.assinatura },
  ];
  const pendencias = items.filter(i => !i.done).length;
  const percentual = Math.round(((items.length - pendencias) / items.length) * 100);
  return { items, pendencias, percentual };
}

// Helper: compute auto status
export function computeAutoStatus(a: AvisoPrevio): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const fim = new Date(a.data_fim + 'T00:00:00');
  const { pendencias } = getAvisoChecklist(a);

  if (pendencias === 0 && a.pago && a.exame && a.assinatura) return 'Concluído';
  if (today > fim && pendencias > 0) return 'Concluído'; // will show as "travado" in alerts
  if (!a.assinatura && today > fim) return 'Aguardando assinatura';
  if (!a.exame) return 'Aguardando exame';
  if (!a.pago) return 'Aguardando pagamento';
  
  const diffDays = Math.ceil((fim.getTime() - today.getTime()) / 86400000);
  if (diffDays <= 7 && diffDays >= 0) return 'Próximo do fim';
  
  return 'Em andamento';
}

// Alerts for dashboard integration
export interface AvisoPrevioAlert {
  type: 'info' | 'warning' | 'critical';
  message: string;
}

export function computeAvisosAlerts(avisos: AvisoPrevio[]): AvisoPrevioAlert[] {
  const alerts: AvisoPrevioAlert[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const ativos = avisos.filter(a => a.status_processo !== 'Concluído');
  
  const proximosFim = ativos.filter(a => {
    const fim = new Date(a.data_fim + 'T00:00:00');
    const diff = Math.ceil((fim.getTime() - today.getTime()) / 86400000);
    return diff >= 0 && diff <= 7;
  });
  if (proximosFim.length > 0) {
    alerts.push({ type: 'warning', message: `${proximosFim.length} aviso(s) prévio(s) próximo(s) do fim` });
  }

  const pagPendentes = ativos.filter(a => !a.pago);
  if (pagPendentes.length > 0) {
    alerts.push({ type: 'warning', message: `${pagPendentes.length} pagamento(s) rescisório(s) pendente(s)` });
  }

  const examePendentes = ativos.filter(a => !a.exame);
  if (examePendentes.length > 0) {
    alerts.push({ type: 'info', message: `${examePendentes.length} exame(s) demissional(is) pendente(s)` });
  }

  const assPendentes = ativos.filter(a => !a.assinatura);
  if (assPendentes.length > 0) {
    alerts.push({ type: 'info', message: `${assPendentes.length} assinatura(s) de rescisão pendente(s)` });
  }

  const envPendentes = ativos.filter(a => !a.enviado_contabilidade);
  if (envPendentes.length > 0) {
    alerts.push({ type: 'info', message: `${envPendentes.length} envio(s) pendente(s) para contabilidade` });
  }

  const travados = ativos.filter(a => {
    const fim = new Date(a.data_fim + 'T00:00:00');
    return today > fim && (!a.pago || !a.exame || !a.assinatura);
  });
  if (travados.length > 0) {
    alerts.push({ type: 'critical', message: `${travados.length} desligamento(s) travado(s) por checklist incompleto` });
  }

  return alerts;
}
