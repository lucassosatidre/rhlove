import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { DayOfWeek } from '@/types/collaborator';

/**
 * Resolver síncrono de folgas vigentes em uma data.
 * Carrega TODO o histórico (collaborator_folgas_history) numa única query
 * e expõe resolve(collaboratorId, date) que devolve a entrada cuja
 * vigente_desde <= date com a maior vigente_desde.
 *
 * Se não houver entrada vigente, retorna null e o caller deve cair
 * no fallback (collaborator.folgas_semanais / sunday_n).
 */

export interface ResolvedFolgas {
  folgas_semanais: DayOfWeek[];
  sunday_n: number;
}

export type FolgasResolver = (
  collaboratorId: string,
  date: Date
) => ResolvedFolgas | null;

interface HistoryRow {
  collaborator_id: string;
  folgas_semanais: string[];
  sunday_n: number;
  vigente_desde: string; // YYYY-MM-DD
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function useFolgasResolver() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['folgas-history-all'],
    queryFn: async (): Promise<HistoryRow[]> => {
      const { data, error } = await supabase
        .from('collaborator_folgas_history' as any)
        .select('collaborator_id, folgas_semanais, sunday_n, vigente_desde')
        .order('vigente_desde', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as HistoryRow[];
    },
    staleTime: 60_000,
  });

  // Agrupa por collaborator_id, mantendo entradas ordenadas por vigente_desde ASC
  const byCollaborator = useMemo(() => {
    const map = new Map<string, HistoryRow[]>();
    for (const r of rows) {
      const arr = map.get(r.collaborator_id) ?? [];
      arr.push(r);
      map.set(r.collaborator_id, arr);
    }
    return map;
  }, [rows]);

  const resolver: FolgasResolver = useMemo(() => {
    return (collaboratorId: string, date: Date) => {
      const arr = byCollaborator.get(collaboratorId);
      if (!arr || arr.length === 0) return null;
      const target = dateKey(date);
      // procura a maior vigente_desde <= target
      let chosen: HistoryRow | null = null;
      for (const r of arr) {
        if (r.vigente_desde <= target) chosen = r;
        else break;
      }
      if (!chosen) return null;
      return {
        folgas_semanais: chosen.folgas_semanais as DayOfWeek[],
        sunday_n: chosen.sunday_n,
      };
    };
  }, [byCollaborator]);

  return { resolver, isLoading };
}
