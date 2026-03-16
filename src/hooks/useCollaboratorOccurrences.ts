import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type OccurrenceType = 'FALTA' | 'ATESTADO' | 'COMPENSACAO';

export interface Occurrence {
  id: string;
  type: OccurrenceType;
  date: string;
  dateEnd: string | null;
  days: number;
  detail: string;
  observation: string;
  createdBy: string;
  createdAt: string;
  /** Extra fields for compensação */
  holidayName?: string;
  compensationStatus?: string;
  compensationDate?: string | null;
}

export function useCollaboratorOccurrences(collaboratorId: string | null) {
  return useQuery({
    queryKey: ['collaborator_occurrences', collaboratorId],
    queryFn: async (): Promise<Occurrence[]> => {
      if (!collaboratorId) return [];

      // Fetch faltas & atestados from schedule_events
      const { data: events, error: evErr } = await supabase
        .from('schedule_events')
        .select('*')
        .eq('collaborator_id', collaboratorId)
        .in('event_type', ['FALTA', 'ATESTADO'])
        .order('event_date', { ascending: false });
      if (evErr) throw evErr;

      // Fetch compensações
      const { data: comps, error: compErr } = await supabase
        .from('holiday_compensations')
        .select('*')
        .eq('collaborator_id', collaboratorId)
        .order('holiday_date', { ascending: false });
      if (compErr) throw compErr;

      const occurrences: Occurrence[] = [];

      for (const ev of events ?? []) {
        const start = ev.event_date;
        const end = ev.event_date_end;
        let days = 1;
        if (end && end !== start) {
          const ms = new Date(end + 'T00:00:00').getTime() - new Date(start + 'T00:00:00').getTime();
          days = Math.round(ms / 86400000) + 1;
        }

        occurrences.push({
          id: ev.id,
          type: ev.event_type as OccurrenceType,
          date: start,
          dateEnd: end,
          days,
          detail: ev.event_type === 'FALTA' ? 'Falta' : `Atestado (${days} dia${days > 1 ? 's' : ''})`,
          observation: ev.observation ?? '',
          createdBy: ev.created_by ?? '',
          createdAt: ev.created_at,
        });
      }

      for (const c of comps ?? []) {
        const statusLabel = c.status === 'COMPENSADO'
          ? `Compensado em ${formatDate(c.compensation_date)}`
          : c.status === 'NAO'
            ? 'Sem direito'
            : 'Pendente';

        occurrences.push({
          id: c.id,
          type: 'COMPENSACAO',
          date: c.holiday_date,
          dateEnd: null,
          days: 1,
          detail: c.holiday_name,
          observation: c.observacao ?? '',
          createdBy: '',
          createdAt: c.created_at,
          holidayName: c.holiday_name,
          compensationStatus: c.status,
          compensationDate: c.compensation_date,
        });
      }

      // Sort by date descending
      occurrences.sort((a, b) => b.date.localeCompare(a.date));

      return occurrences;
    },
    enabled: !!collaboratorId,
  });
}

function formatDate(d: string | null | undefined): string {
  if (!d) return '-';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

export function computeOccurrenceSummary(occurrences: Occurrence[]) {
  let totalFaltas = 0;
  let totalDiasAtestado = 0;
  let compPendentes = 0;
  let compRealizadas = 0;

  for (const o of occurrences) {
    if (o.type === 'FALTA') totalFaltas++;
    if (o.type === 'ATESTADO') totalDiasAtestado += o.days;
    if (o.type === 'COMPENSACAO') {
      if (o.compensationStatus === 'COMPENSADO') compRealizadas++;
      else if (o.compensationStatus === 'SIM') compPendentes++;
    }
  }

  return { totalFaltas, totalDiasAtestado, compPendentes, compRealizadas };
}
