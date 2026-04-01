import { useState, useMemo, useEffect, useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Download, Calendar, AlertTriangle, Pencil, Wrench, Banknote, RefreshCw } from 'lucide-react';
import { InlineTimeCell } from '@/components/ponto/InlineTimeCell';
import { format, getDaysInMonth, getDay, parse } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { PunchAdjustmentDialog } from '@/components/ponto/PunchAdjustmentDialog';
import { ptBR } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { useCollaborators } from '@/hooks/useCollaborators';
import { usePunchRecords } from '@/hooks/usePunchRecords';
import { useScheduleEvents, buildSwapOverrides, buildEventsMap } from '@/hooks/useScheduleEvents';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useScheduledVacations } from '@/hooks/useScheduledVacations';
import { useAfastamentos } from '@/hooks/useAfastamentos';
import { useBankHoursBalance, useUpsertBankHoursBalance } from '@/hooks/useBankHoursBalance';
import { calculateJornada, fmtHHMM, fmtSaldo, type JornadaRow, type JornadaTotals } from '@/lib/jornadaEngine';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import type { Collaborator, DayOfWeek } from '@/types/collaborator';
import PrintHeader, { PrintFooter } from '@/components/PrintHeader';
import { UpdatePunchesDialog } from '@/components/ponto/UpdatePunchesDialog';
import { assignPunchSlots, calculatePattern } from '@/lib/punchInference';
import type { PunchRecord } from '@/hooks/usePunchRecords';
import { useAvisosPrevios } from '@/hooks/useAvisosPrevios';

const WEEKDAY_MAP: Record<number, DayOfWeek> = {
  0: 'DOMINGO', 1: 'SEGUNDA', 2: 'TERCA', 3: 'QUARTA', 4: 'QUINTA', 5: 'SEXTA', 6: 'SABADO',
};

function calcHours(entrada: string | null, saida: string | null, saidaInt: string | null, retornoInt: string | null): number | null {
  if (!entrada || !saida) return null;
  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const adj = (timeMin: number, refMin: number) => (timeMin < 180 && refMin > timeMin) ? timeMin + 1440 : timeMin;
  const entradaMin = toMin(entrada);
  let saidaMin = adj(toMin(saida), entradaMin);
  let total = saidaMin - entradaMin;
  if (saidaInt && retornoInt) {
    const siMin = toMin(saidaInt);
    total -= (adj(toMin(retornoInt), siMin) - siMin);
  }
  return total > 0 ? total : 0;
}

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h${m.toString().padStart(2, '0')}`;
}

function formatMinutesHHMM(min: number | null): string {
  if (min === null) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i),
  label: format(new Date(2024, i, 1), 'MMMM', { locale: ptBR }).replace(/^\w/, c => c.toUpperCase()),
}));

function useHolidays() {
  return useQuery({
    queryKey: ['holidays'],
    queryFn: async () => {
      const { data, error } = await supabase.from('holidays').select('*');
      if (error) throw error;
      return (data ?? []) as { id: string; date: string; name: string }[];
    },
  });
}

// ── Inconsistency types ──
type InconsistencyTag = 'batida_pendente' | 'falta' | 'sem_intervalo' | 'incompleta' | 'jornada_longa' | 'jornada_curta';

const TAG_CONFIG: Record<InconsistencyTag, { label: string; emoji: string; className: string; isInconsistency: boolean }> = {
  batida_pendente: { label: 'Batida pendente', emoji: '🔴', className: 'bg-red-100 text-red-700 border-red-200', isInconsistency: true },
  falta: { label: 'Falta', emoji: '❌', className: 'bg-gray-200 text-gray-700 border-gray-300', isInconsistency: false },
  jornada_curta: { label: 'Jornada < 2h', emoji: '🟡', className: 'bg-yellow-100 text-yellow-700 border-yellow-200', isInconsistency: true },
  jornada_longa: { label: 'Jornada > 14h', emoji: '🟠', className: 'bg-orange-100 text-orange-700 border-orange-200', isInconsistency: true },
  sem_intervalo: { label: 'Sem intervalo', emoji: '🟡', className: 'bg-yellow-100 text-yellow-700 border-yellow-200', isInconsistency: true },
  incompleta: { label: 'Incompleta', emoji: '🔴', className: 'bg-red-100 text-red-700 border-red-200', isInconsistency: true },
};

function detectTags(entrada: string | null, saida: string | null, saidaInt: string | null, retornoInt: string | null): InconsistencyTag[] {
  const fields = [entrada, saidaInt, retornoInt, saida];
  const filled = fields.filter(f => f && f !== '').length;
  if (filled === 0) return [];
  const tags: InconsistencyTag[] = [];
  if (filled > 0 && filled < 4) {
    if (entrada && !saida) tags.push('batida_pendente');
    else if (entrada && saida && !saidaInt && !retornoInt) tags.push('sem_intervalo');
    else tags.push('incompleta');
  }
  const worked = calcHours(entrada, saida, saidaInt, retornoInt);
  if (worked !== null) {
    if (worked > 14 * 60) tags.push('jornada_longa');
    if (worked < 2 * 60 && worked > 0) tags.push('jornada_curta');
  }
  return tags;
}

// ── Unified row type for the single table ──
interface UnifiedRow {
  collaboratorId: string;
  collaboratorName: string;
  date: string;
  dateObj: Date;
  weekday: string;
  entrada: string | null;
  saidaInt: string | null;
  retornoInt: string | null;
  saida: string | null;
  hoursMin: number | null;
  status: string;
  tags: InconsistencyTag[];
  isAdjusted: boolean;
  isAutoInterval: boolean;
  // Jornada cols (only when a single collaborator is selected)
  jornada?: JornadaRow;
}

export default function EspelhoPonto() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedCollaboratorId, setSelectedCollaboratorId] = useState<string | null>(null);
  const [searchName, setSearchName] = useState('');
  const [sectorFilter, setSectorFilter] = useState<string>('Todos');
  const [onlyInconsistencies, setOnlyInconsistencies] = useState(false);
  const { usuario } = useAuth();
  const canEdit = usuario?.perfil === 'admin' || usuario?.perfil === 'gestor';
  const queryClient = useQueryClient();
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [adjustmentCollaborator, setAdjustmentCollaborator] = useState<{ id: string; name: string } | null>(null);
  const [adjustmentRow, setAdjustmentRow] = useState<{
    date: string; dateObj: Date;
    entrada: string | null; saidaInt: string | null;
    retornoInt: string | null; saida: string | null;
  } | null>(null);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);

  const { data: collaborators = [] } = useCollaborators();
  const { data: punchRecords = [] } = usePunchRecords(selectedMonth, selectedYear);
  const monthStartDate = new Date(selectedYear, selectedMonth, 1);
  const expandedStart = new Date(monthStartDate); expandedStart.setDate(expandedStart.getDate() - 7);
  const monthStart = format(expandedStart, 'yyyy-MM-dd');
  const monthEnd = format(new Date(selectedYear, selectedMonth, getDaysInMonth(new Date(selectedYear, selectedMonth))), 'yyyy-MM-dd');
  const { data: scheduleEvents = [] } = useScheduleEvents(monthStart, monthEnd);
  const { data: vacations = [] } = useScheduledVacations();
  const { data: afastamentos = [] } = useAfastamentos();
  const { data: holidays = [] } = useHolidays();
  const { data: avisosPrevios = [] } = useAvisosPrevios();

  // Lookup: collaborator_id → data_fim do aviso prévio (use earliest active/concluded)
  const avisosLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of avisosPrevios) {
      const existing = map.get(a.collaborator_id);
      if (!existing || a.data_fim < existing) {
        map.set(a.collaborator_id, a.data_fim);
      }
    }
    return map;
  }, [avisosPrevios]);

  useEffect(() => {
    const channel = supabase
      .channel('espelho-ponto-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'punch_records' }, () => {
        queryClient.invalidateQueries({ queryKey: ['punch_records'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const selected = useMemo(
    () => collaborators.find(c => c.id === selectedCollaboratorId) ?? null,
    [collaborators, selectedCollaboratorId]
  );

  const collabMap = useMemo(() => {
    const m = new Map<string, Collaborator>();
    collaborators.forEach(c => m.set(c.id, c));
    return m;
  }, [collaborators]);

  const sectors = useMemo(() => {
    const s = new Set<string>();
    collaborators.forEach(c => { if (c.sector) s.add(c.sector); });
    return Array.from(s).sort();
  }, [collaborators]);

  const { data: sundayTracking } = useQuery({
    queryKey: ['sunday_tracking', selectedCollaboratorId, selectedMonth, selectedYear],
    queryFn: async () => {
      if (!selectedCollaboratorId) return null;
      const { data, error } = await supabase
        .from('sunday_tracking').select('*')
        .eq('collaborator_id', selectedCollaboratorId)
        .eq('month', selectedMonth + 1).eq('year', selectedYear).maybeSingle();
      if (error) throw error;
      return data as { id: string; consecutive_sundays_from_previous: number } | null;
    },
    enabled: !!selectedCollaboratorId,
  });

  const { data: bankBalances = [] } = useBankHoursBalance(selectedCollaboratorId);
  const upsertBalance = useUpsertBankHoursBalance();

  const activeCollabs = useMemo(
    () => collaborators.filter(c => c.status !== 'DESLIGADO' && c.controla_ponto !== false),
    [collaborators]
  );

  const filteredCollabs = useMemo(() => {
    let list = activeCollabs;
    if (sectorFilter !== 'Todos') list = list.filter(c => c.sector === sectorFilter);
    if (searchName.trim()) {
      const q = searchName.toLowerCase();
      list = list.filter(c => c.collaborator_name.toLowerCase().includes(q));
    }
    return list;
  }, [activeCollabs, searchName, sectorFilter]);

  // Determine the last date with actual punch data (entrada filled)
  const lastPunchUpdateDate = useMemo(() => {
    let maxDate = '';
    for (const p of punchRecords) {
      if (p.entrada && p.date > maxDate) maxDate = p.date;
    }
    return maxDate || null;
  }, [punchRecords]);

  const daysInMonth = getDaysInMonth(new Date(selectedYear, selectedMonth));
  const holidaySet = useMemo(() => new Set(holidays.map(h => h.date)), [holidays]);
  const swapOverrides = useMemo(() => buildSwapOverrides(scheduleEvents), [scheduleEvents]);
  const eventsMap = useMemo(() => buildEventsMap(scheduleEvents), [scheduleEvents]);

  const getWeekStart = (date: Date): string => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return format(d, 'yyyy-MM-dd');
  };

  // Build day rows for a specific collaborator
  const buildCollabRows = useCallback((collab: Collaborator, _lastPunchDate: string | null = lastPunchUpdateDate) => {
    const collabPunches = punchRecords.filter(p => p.collaborator_id === collab.id);
    const punchMap = new Map<string, typeof punchRecords[0]>();
    collabPunches.forEach(p => punchMap.set(p.date, p));

    const result: UnifiedRow[] = [];
    const avisoDataFim = avisosLookup.get(collab.id);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(selectedYear, selectedMonth, d);
      const iso = format(dateObj, 'yyyy-MM-dd');

      // Skip days after aviso prévio data_fim
      if (avisoDataFim && iso > avisoDataFim) continue;

      const wd = WEEKDAY_MAP[getDay(dateObj)];
      const weekday = format(dateObj, 'EEE', { locale: ptBR });

      const punch = punchMap.get(iso);
      let entrada = punch?.entrada ?? null;
      let saida = punch?.saida ?? null;
      let saidaInt = punch?.saida_intervalo ?? null;
      let retornoInt = punch?.retorno_intervalo ?? null;

      let isAutoInterval = false;
      if (collab.intervalo_automatico && collab.intervalo_inicio && collab.intervalo_duracao) {
        const filledPunches = [entrada, saidaInt, retornoInt, saida].filter(Boolean) as string[];
        if (filledPunches.length === 2) {
          const osk = (t: string) => { const h = parseInt(t.split(':')[0]); return h < 3 ? parseInt(t.replace(':', '')) + 2400 : parseInt(t.replace(':', '')); };
          const sorted = [...filledPunches].sort((a, b) => osk(a) - osk(b));
          entrada = sorted[0]; saida = sorted[1];
          const intKey = osk(collab.intervalo_inicio); const entKey = osk(entrada); const saiKey = osk(saida);
          if (intKey > entKey && intKey < saiKey) {
            saidaInt = collab.intervalo_inicio;
            const [ih, im] = collab.intervalo_inicio.split(':').map(Number);
            const totalMin = ih * 60 + im + collab.intervalo_duracao;
            retornoInt = `${String(Math.floor(totalMin / 60) % 24).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
            isAutoInterval = true;
          }
        }
      }

      const hoursMin = calcHours(entrada, saida, saidaInt, retornoInt);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const isFuture = dateObj >= today;
      const isHoliday = holidaySet.has(iso);
      const isVacation = vacations.some(v => v.collaborator_id === collab.id && iso >= v.data_inicio_ferias && iso <= v.data_fim_ferias);
      const isAfastamento = afastamentos.some(a => a.collaborator_id === collab.id && iso >= a.data_inicio && iso <= a.data_fim);

      const weekStart = getWeekStart(dateObj);
      const overrideKey = `${weekStart}|${collab.id}`;
      const override = swapOverrides.get(overrideKey);
      let isBaseFolga = !!collab.folgas_semanais?.includes(wd);
      if (!isBaseFolga && collab.sunday_n > 0 && getDay(dateObj) === 0) {
        let sundayCount = 0;
        for (let day = 1; day <= d; day++) {
          if (getDay(new Date(selectedYear, selectedMonth, day)) === 0) sundayCount++;
        }
        if (sundayCount === collab.sunday_n) isBaseFolga = true;
      }
      let isFolga = isBaseFolga;
      if (override) {
        const wdLower = wd.toLowerCase();
        if (override.removeDays.some(rd => rd?.toLowerCase() === wdLower)) isFolga = false;
        if (override.addDays.some(ad => ad?.toLowerCase() === wdLower)) isFolga = true;
      }
      const dayEvents = eventsMap[iso]?.[collab.id] ?? [];
      const isAtestado = dayEvents.some(e => e.event_type === 'ATESTADO' && e.status === 'ATIVO');
      const isCompensacao = dayEvents.some(e => e.event_type === 'COMPENSACAO' && e.status === 'ATIVO');
      const isFaltaJustificada = dayEvents.some(e => e.event_type === 'FALTA' && e.status === 'ATIVO');
      const isTrocaFolga = override && override.addDays.some(ad => ad?.toLowerCase() === wd.toLowerCase());

      let status = isFuture ? '—' : '❌ Falta';
      if (isVacation) status = '🌴 Férias';
      else if (isAfastamento || isAtestado) status = '🏥 Afastado';
      else if (isHoliday) status = '🎉 Feriado';
      else if (isCompensacao) { status = '🎉 Compensação'; isFolga = true; }
      else if (isFolga && isTrocaFolga) status = '🔄 Folga (troca)';
      else if (isFolga) status = '🏖️ Folga';
      else if (isFaltaJustificada && !entrada) status = '❌ Falta justificada';
      else if (entrada && saida) status = '✅ Normal';
      else if (entrada && !saida) status = '⚠️ Batida pendente';

      // Detect inconsistency tags for working days
      let tags: InconsistencyTag[] = [];
      if (!isFuture && !isFolga && !isVacation && !(isAfastamento || isAtestado) && !isCompensacao) {
        tags = detectTags(entrada, saida, saidaInt, retornoInt);
        // Day without any punches on a working day
        if (!entrada && !saida && !saidaInt && !retornoInt && status.includes('Falta')) {
          // If day <= lastPunchUpdateDate → confirmed absence (not inconsistency)
          // If day > lastPunchUpdateDate → pending punch (inconsistency)
          if (lastPunchUpdateDate && iso <= lastPunchUpdateDate) {
            tags = ['falta'];
            status = '❌ Falta';
          } else {
            tags = ['batida_pendente'];
            status = '🔴 Batida pendente';
          }
        }
      }

      const isAdjusted = punch ? !!(punch as any).adjusted_at : false;
      result.push({
        collaboratorId: collab.id, collaboratorName: collab.collaborator_name,
        date: iso, dateObj, weekday, entrada, saidaInt, retornoInt, saida,
        hoursMin, status, tags, isAdjusted, isAutoInterval,
      });
    }
    return result;
  }, [daysInMonth, selectedMonth, selectedYear, punchRecords, swapOverrides, eventsMap, vacations, afastamentos, holidaySet, avisosLookup, lastPunchUpdateDate]);

  // ── Single collaborator rows (with jornada) ──
  const singleCollabRows = useMemo(() => {
    if (!selected) return [];
    return buildCollabRows(selected);
  }, [selected, buildCollabRows]);

  // Jornada calculations (only for selected collaborator)
  const { jornadaRows, jornadaTotals, consecutiveSundaysEnd } = useMemo(() => {
    if (!selected || singleCollabRows.length === 0) return { jornadaRows: [] as JornadaRow[], jornadaTotals: null, consecutiveSundaysEnd: 0 };
    const WEEKDAY_NAME_MAP: Record<number, string> = { 0: 'domingo', 1: 'segunda', 2: 'terca', 3: 'quarta', 4: 'quinta', 5: 'sexta', 6: 'sabado' };
    const defaultChMin = selected.carga_horaria_diaria
      ? (() => { const [h, m] = selected.carga_horaria_diaria!.split(':').map(Number); return h * 60 + (m || 0); })()
      : 420;
    const avisoReducao = (selected.status === 'AVISO_PREVIO' && selected.aviso_previo_reducao === 2) ? 120 : 0;

    // Derive isFolga etc from status
    const dayInfos = singleCollabRows.map(r => {
      const isFolga = ['🏖️ Folga', '🔄 Folga (troca)', '🎉 Compensação'].some(s => r.status.includes(s.replace(/^[^\w]*/, ''))) || r.status.includes('Folga');
      const isVacation = r.status.includes('Férias');
      const isAfastamento = r.status.includes('Afastado');
      const isHoliday = r.status.includes('Feriado');
      const isFuture = r.status === '—';

      let chForDay = defaultChMin;
      const dayOfWeek = getDay(r.dateObj);
      const dayName = WEEKDAY_NAME_MAP[dayOfWeek];
      if (selected.jornadas_especiais && selected.jornadas_especiais.length > 0) {
        const especial = selected.jornadas_especiais.find(je => je.dias.includes(dayName));
        if (especial && especial.ch) {
          const [eh, em] = especial.ch.split(':').map(Number);
          chForDay = eh * 60 + (em || 0);
        }
      }
      if (avisoReducao > 0 && !isFolga && !isVacation && !isAfastamento) {
        chForDay = Math.max(0, chForDay - avisoReducao);
      }
      return {
        date: r.date, isFolga: isFolga || r.status.includes('Compensação'),
        isVacation, isAfastamento, isHoliday, isFuture,
        punch: { entrada: r.entrada, saida: r.saida, saidaInt: r.saidaInt, retornoInt: r.retornoInt },
        hoursWorkedMin: r.hoursMin, chOverride: chForDay,
      };
    });
    const consecutiveFromPrev = (selected.genero === 'F' && sundayTracking) ? sundayTracking.consecutive_sundays_from_previous : 0;
    const result = calculateJornada(dayInfos, defaultChMin, selected.genero ?? 'M', consecutiveFromPrev);
    return { jornadaRows: result.rows, jornadaTotals: result.totals, consecutiveSundaysEnd: result.consecutiveSundaysEnd };
  }, [singleCollabRows, selected, sundayTracking]);

  // Attach jornada to single collab rows
  const singleCollabRowsWithJornada = useMemo(() => {
    return singleCollabRows.map((r, i) => ({ ...r, jornada: jornadaRows[i] }));
  }, [singleCollabRows, jornadaRows]);

  // ── All collaborators rows — reuse buildCollabRows for consistency ──
  const allCollabRows = useMemo(() => {
    if (selected) return [];
    const targetCollabs = sectorFilter === 'Todos'
      ? activeCollabs
      : activeCollabs.filter(c => c.sector === sectorFilter);

    const rows: UnifiedRow[] = [];
    for (const collab of targetCollabs) {
      const collabRows = buildCollabRows(collab);
      for (const row of collabRows) {
        if (row.entrada || row.saida || row.saidaInt || row.retornoInt || row.tags.length > 0) {
          rows.push(row);
        }
      }
    }
    rows.sort((a, b) => {
      const nc = a.collaboratorName.localeCompare(b.collaboratorName);
      return nc !== 0 ? nc : a.date.localeCompare(b.date);
    });
    return rows;
  }, [selected, buildCollabRows, activeCollabs, sectorFilter]);

  // ── Unified display rows ──
  const displayRows = useMemo(() => {
    const source = selected ? singleCollabRowsWithJornada : allCollabRows;
    if (onlyInconsistencies) return source.filter(r => r.tags.length > 0);
    return source;
  }, [selected, singleCollabRowsWithJornada, allCollabRows, onlyInconsistencies]);

  const totalInconsistencies = useMemo(() => {
    const source = selected ? singleCollabRowsWithJornada : allCollabRows;
    return source.filter(r => r.tags.length > 0).length;
  }, [selected, singleCollabRowsWithJornada, allCollabRows]);

  // Bank hours
  const prevMonthBalance = useMemo(() => {
    if (!bankBalances.length) return 0;
    let prevMonth = selectedMonth - 1; let prevYear = selectedYear;
    if (prevMonth < 0) { prevMonth = 11; prevYear--; }
    const prev = bankBalances.find(b => b.month === prevMonth + 1 && b.year === prevYear);
    return prev?.accumulated_balance ?? 0;
  }, [bankBalances, selectedMonth, selectedYear]);

  const currentMonthSaldo = jornadaTotals?.saldoBH ?? 0;
  const accumulatedBalance = prevMonthBalance + currentMonthSaldo;

  useEffect(() => {
    if (!selected || !jornadaTotals) return;
    upsertBalance.mutate({
      collaborator_id: selected.id, month: selectedMonth + 1, year: selectedYear,
      accumulated_balance: accumulatedBalance,
    });
  }, [selected?.id, selectedMonth, selectedYear, accumulatedBalance]);

  useEffect(() => {
    if (!selected || selected.genero !== 'F' || !jornadaTotals) return;
    const nextMonth = selectedMonth + 1 > 11 ? 1 : selectedMonth + 2;
    const nextYear = selectedMonth + 1 > 11 ? selectedYear + 1 : selectedYear;
    supabase.from('sunday_tracking').upsert({
      collaborator_id: selected.id, month: nextMonth, year: nextYear,
      consecutive_sundays_from_previous: consecutiveSundaysEnd,
    } as any, { onConflict: 'collaborator_id,month,year' }).then();
  }, [selected?.id, selectedMonth, selectedYear, consecutiveSundaysEnd, jornadaTotals]);

  // Build pattern cache per collaborator from punchRecords
  const patternCache = useMemo(() => {
    const cache = new Map<string, ReturnType<typeof calculatePattern>>();
    const byCollab = new Map<string, PunchRecord[]>();
    for (const pr of punchRecords) {
      if (!byCollab.has(pr.collaborator_id)) byCollab.set(pr.collaborator_id, []);
      byCollab.get(pr.collaborator_id)!.push(pr);
    }
    for (const [cid, recs] of byCollab) {
      // Sort by date desc for most recent first
      recs.sort((a, b) => b.date.localeCompare(a.date));
      cache.set(cid, calculatePattern(recs));
    }
    return cache;
  }, [punchRecords]);

  // Inline save handler
  const handleInlineSave = useCallback(async (row: UnifiedRow, field: 'entrada' | 'saida_intervalo' | 'retorno_intervalo' | 'saida', newValue: string | null) => {
    const collab = collabMap.get(row.collaboratorId);
    if (!collab) return;
    const currentValues = { entrada: row.entrada, saida_intervalo: row.saidaInt, retorno_intervalo: row.retornoInt, saida: row.saida };
    currentValues[field] = newValue;
    const rawTimes = [currentValues.entrada, currentValues.saida_intervalo, currentValues.retorno_intervalo, currentValues.saida].filter((t): t is string => !!t && t.trim() !== '');
    const pattern = patternCache.get(row.collaboratorId) ?? null;
    const sorted = assignPunchSlots(rawTimes, pattern);
    const allEmpty = !sorted.entrada && !sorted.saida_intervalo && !sorted.retorno_intervalo && !sorted.saida;
    try {
      if (allEmpty) {
        await supabase.from('punch_records').delete().eq('collaborator_id', row.collaboratorId).eq('date', row.date);
      } else {
        const record = {
          collaborator_id: row.collaboratorId, collaborator_name: row.collaboratorName, date: row.date,
          ...sorted, adjusted_by: usuario?.id ?? null, adjusted_at: new Date().toISOString(), adjustment_reason: 'Edição inline',
        };
        await supabase.from('punch_records').upsert(record as any, { onConflict: 'collaborator_id,date' });
      }
      await queryClient.invalidateQueries({ queryKey: ['punch_records'] });
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + (err.message ?? 'desconhecido'));
    }
  }, [collabMap, usuario, queryClient, patternCache]);

  const totalWorked = singleCollabRows.filter(r => r.status === '✅ Normal').length;
  const totalFaltas = singleCollabRows.filter(r => r.status.includes('Falta')).length;
  const totalHoursMin = singleCollabRows.reduce((acc, r) => acc + (r.hoursMin ?? 0), 0);

  const years = useMemo(() => { const y = now.getFullYear(); return [y - 1, y, y + 1]; }, []);

  // Summary stats
  const summaryStats = useMemo(() => {
    const filteredIds = new Set(
      sectorFilter === 'Todos'
        ? activeCollabs.map(c => c.id)
        : activeCollabs.filter(c => c.sector === sectorFilter).map(c => c.id)
    );
    const relevantRecords = selectedCollaboratorId
      ? punchRecords.filter(r => r.collaborator_id === selectedCollaboratorId)
      : punchRecords.filter(r => filteredIds.has(r.collaborator_id));
    const totalRegistros = relevantRecords.length;
    const collabSet = new Set(relevantRecords.map(r => r.collaborator_id));
    const totalCollabs = collabSet.size;
    let incCount = 0;
    for (const r of relevantRecords) {
      const tags = detectTags(r.entrada, r.saida, r.saida_intervalo, r.retorno_intervalo);
      if (tags.length > 0) incCount++;
    }
    return { totalRegistros, totalCollabs, totalInconsistencias: incCount, totalOk: totalRegistros - incCount };
  }, [punchRecords, activeCollabs, sectorFilter, selectedCollaboratorId]);

  // Export Excel — exports exactly what's visible in the table
  const exportExcel = () => {
    if (displayRows.length === 0) return;
    const rows = displayRows.map(r => [
      r.collaboratorName,
      format(r.dateObj, 'dd/MM/yyyy'),
      r.entrada ?? '',
      r.saidaInt ?? '',
      r.retornoInt ?? '',
      r.saida ?? '',
      '',
    ]);
    // Header row: only Colaborador, Data and Ajuste have labels; C-F are blank
    const header = ['Colaborador', 'Data', '', '', '', '', 'Ajuste'];
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    ws['!cols'] = [
      { wch: 25 }, { wch: 12 }, { wch: 8 }, { wch: 16 }, { wch: 18 }, { wch: 8 }, { wch: 12 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Espelho');
    XLSX.writeFile(wb, `espelho-ponto-${MONTHS[selectedMonth].label}-${selectedYear}.xlsx`);
  };

  const openAdjustment = (row: UnifiedRow) => {
    setAdjustmentCollaborator({ id: row.collaboratorId, name: row.collaboratorName });
    setAdjustmentRow({
      date: row.date, dateObj: row.dateObj,
      entrada: row.entrada, saidaInt: row.saidaInt,
      retornoInt: row.retornoInt, saida: row.saida,
    });
    setAdjustmentOpen(true);
  };

  const saldoMes = fmtSaldo(currentMonthSaldo);
  const saldoAcum = fmtSaldo(accumulatedBalance);

  const adjCollabId = adjustmentCollaborator?.id ?? '';
  const adjCollabName = adjustmentCollaborator?.name ?? '';

  const showJornada = !!selected;

  // Status tag renderer
  const renderStatusTag = (row: UnifiedRow) => {
    if (row.tags.length > 0) {
      return (
        <div className="flex flex-col gap-0.5">
          {row.tags.map(t => {
            const cfg = TAG_CONFIG[t];
            return (
              <span key={t} className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium border ${cfg.className}`}>
                {cfg.emoji} {cfg.label}
              </span>
            );
          })}
        </div>
      );
    }
    // Check for special statuses
    const isExtra100 = showJornada && row.jornada?.extra100 && row.jornada.extra100 > 0;
    if (isExtra100) return <span className="text-[10px] text-pink-600 font-medium">💯 Art.386</span>;

    // Map status to colored tags
    if (row.status.includes('Folga')) {
      const hasPunches = row.entrada || row.saida;
      return (
        <span className="inline-flex items-center gap-1">
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium ${hasPunches ? 'bg-amber-100 text-amber-700 border border-amber-300' : 'bg-sky-100 text-sky-700 border border-sky-200'}`}>🏖️ Folga</span>
          {hasPunches && (
            <span className="text-amber-500 cursor-help" title="Atenção: existem batidas registradas neste dia de folga">⚠️</span>
          )}
        </span>
      );
    }
    if (row.status.includes('Férias')) return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">🌴 Férias</span>;
    if (row.status.includes('Afastado')) return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-gray-100 text-gray-600 border border-gray-200">📋 Ajuste</span>;
    if (row.status.includes('Feriado')) return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-100 text-amber-700 border border-amber-200">🎉 Feriado</span>;
    if (row.status.includes('Compensação')) return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-100 text-amber-700 border border-amber-200">🎉 Compensação</span>;
    if (row.status === '—') return <span className="text-[10px] text-muted-foreground">—</span>;
    if (row.status.includes('Normal')) return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-green-100 text-green-700 border border-green-200">✅ Normal</span>;
    if (row.status.includes('Falta')) return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-red-100 text-red-700 border border-red-200">❌ Falta</span>;
    return <span className="text-[10px]">{row.status}</span>;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] -m-4 md:-m-6 lg:-m-8 overflow-hidden print:overflow-visible print:h-auto print:m-0">
      <PrintHeader title="Espelho de Ponto" subtitle={selected ? `${selected.collaborator_name} — ${selected.sector} — ${MONTHS[selectedMonth].label}/${selectedYear}` : undefined} />

      <div className="flex flex-1 min-h-0 gap-3 p-2 print:p-0 print:block">
        {/* Sidebar */}
        <div className="w-56 shrink-0 flex flex-col gap-2 print:hidden">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar..." value={searchName} onChange={e => setSearchName(e.target.value)} className="pl-9 h-9 text-sm" />
          </div>
          <div className="flex flex-wrap gap-1">
            <Button variant={sectorFilter === 'Todos' ? 'default' : 'outline'} size="sm" className="h-6 px-2 text-[10px]"
              onClick={() => setSectorFilter('Todos')}>Todos</Button>
            {sectors.map(s => (
              <Button key={s} variant={sectorFilter === s ? 'default' : 'outline'} size="sm" className="h-6 px-2 text-[10px]"
                onClick={() => setSectorFilter(s)}>{s}</Button>
            ))}
          </div>
          {/* "All" button to deselect */}
          <button onClick={() => {
              setSelectedCollaboratorId(null);
              setOnlyInconsistencies(false);
              queryClient.invalidateQueries({ queryKey: ['punch_records'] });
              queryClient.invalidateQueries({ queryKey: ['schedule_events'] });
              queryClient.invalidateQueries({ queryKey: ['collaborators'] });
              queryClient.invalidateQueries({ queryKey: ['scheduled_vacations'] });
              queryClient.invalidateQueries({ queryKey: ['afastamentos'] });
              queryClient.invalidateQueries({ queryKey: ['holidays'] });
            }}
            className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors font-medium ${!selectedCollaboratorId ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}>
            📋 Todos os colaboradores
          </button>
          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-0.5 pr-2">
              {filteredCollabs.map(c => (
                <button key={c.id} onClick={() => { setSelectedCollaboratorId(c.id); setOnlyInconsistencies(false); }}
                  className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${selectedCollaboratorId === c.id ? 'bg-primary text-primary-foreground font-medium' : 'hover:bg-muted'}`}>
                  <span className="block truncate text-xs">{c.collaborator_name}</span>
                  <span className={`text-[10px] ${selectedCollaboratorId === c.id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{c.sector}</span>
                </button>
              ))}
              {filteredCollabs.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhum encontrado</p>}
            </div>
          </ScrollArea>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0 gap-2">
          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-2 shrink-0">
            <Card><CardContent className="p-2">
              <p className="text-[10px] text-muted-foreground">Total de Registros</p>
              <p className="text-lg font-bold tabular-nums">{summaryStats.totalRegistros}</p>
            </CardContent></Card>
            <Card><CardContent className="p-2">
              <p className="text-[10px] text-muted-foreground">Colaboradores</p>
              <p className="text-lg font-bold tabular-nums">{summaryStats.totalCollabs}</p>
            </CardContent></Card>
            <Card className={summaryStats.totalInconsistencias > 0 ? 'border-destructive/50 bg-destructive/5' : ''}>
              <CardContent className="p-2">
                <p className="text-[10px] text-muted-foreground">Inconsistências</p>
                <p className={`text-lg font-bold tabular-nums ${summaryStats.totalInconsistencias > 0 ? 'text-destructive' : ''}`}>{summaryStats.totalInconsistencias}</p>
              </CardContent>
            </Card>
            <Card><CardContent className="p-2">
              <p className="text-[10px] text-muted-foreground">Registros OK</p>
              <p className="text-lg font-bold tabular-nums text-green-600">{summaryStats.totalOk}</p>
            </CardContent></Card>
          </div>

          {/* Month selector + actions */}
          <div className="flex items-center justify-between shrink-0 print:hidden">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <Select value={String(selectedMonth)} onValueChange={v => setSelectedMonth(Number(v))}>
                <SelectTrigger className="w-32 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{MONTHS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
                <SelectTrigger className="w-20 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm"
                className={`text-xs ${onlyInconsistencies ? 'bg-amber-50 border-amber-300 text-amber-700' : 'text-amber-600 border-amber-200 hover:bg-amber-50'}`}
                onClick={() => setOnlyInconsistencies(!onlyInconsistencies)}>
                <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                ⚠️ Inconsistências ({totalInconsistencies})
              </Button>
              <Button variant="outline" size="sm" className="text-xs"
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ['punch_records'] });
                  queryClient.invalidateQueries({ queryKey: ['schedule_events'] });
                  queryClient.invalidateQueries({ queryKey: ['collaborators'] });
                  queryClient.invalidateQueries({ queryKey: ['scheduled_vacations'] });
                  queryClient.invalidateQueries({ queryKey: ['afastamentos'] });
                  queryClient.invalidateQueries({ queryKey: ['holidays'] });
                  toast.success('Dados atualizados');
                }}>
                <RefreshCw className="w-3.5 h-3.5 mr-1" /> Atualizar
              </Button>
              <Button variant="default" size="sm" className="text-xs" onClick={() => setUpdateDialogOpen(true)}>
                <RefreshCw className="w-3.5 h-3.5 mr-1" /> Atualizar Batidas
              </Button>
              <Button variant="outline" size="sm" className="text-xs" onClick={exportExcel} disabled={displayRows.length === 0}>
                <Download className="w-3.5 h-3.5 mr-1" /> Excel
              </Button>
            </div>
          </div>

          {/* Collaborator header (when selected) */}
          {selected && (
            <div className="flex flex-col gap-1 shrink-0">
              <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-semibold">{selected.collaborator_name}</h3>
                  <Badge variant="outline" className="text-[10px]">{selected.sector}</Badge>
                  <span className="text-[10px] text-muted-foreground">
                    Trab: {totalWorked} · Faltas: {totalFaltas} · Horas: {formatMinutes(totalHoursMin)}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1">
                    <Banknote className="w-3.5 h-3.5 text-primary" />
                    <span className="text-muted-foreground">BH Mês:</span>
                    <span className={`font-semibold tabular-nums ${saldoMes.className}`}>{saldoMes.text || '00:00'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">Acum:</span>
                    <span className={`font-semibold tabular-nums ${saldoAcum.className}`}>{saldoAcum.text || '00:00'}</span>
                  </div>
                </div>
              </div>
              {avisosLookup.has(selected.id) && (() => {
                const aviso = avisosPrevios.find(a => a.collaborator_id === selected.id);
                if (!aviso) return null;
                const fmtDate = (d: string) => { const [y, m, dd] = d.split('-'); return `${dd}/${m}/${y}`; };
                return (
                  <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-200 rounded-lg">
                    <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px]">⚠️ Aviso Prévio</Badge>
                    <span className="text-xs text-amber-700">
                      {fmtDate(aviso.data_inicio)} a {fmtDate(aviso.data_fim)} · {aviso.opcao}
                    </span>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Unified table */}
          <Card className="flex-1 min-h-0 flex flex-col border">
            <CardContent className="p-0 flex-1 overflow-auto min-h-0 relative">
              <Table>
                <TableHeader>
                {showJornada && (
                    <TableRow className="border-b-0">
                      <TableHead colSpan={1} className="sticky top-0 z-20 bg-gray-700 text-white text-[10px] font-semibold h-6 py-0"></TableHead>
                      <TableHead colSpan={4} className="sticky top-0 z-20 bg-gray-700 text-white text-center text-[10px] font-semibold border-l-2 border-l-gray-500 h-6 py-0">Batidas</TableHead>
                      <TableHead colSpan={2} className="sticky top-0 z-20 bg-gray-700 text-white text-center text-[10px] font-semibold border-l-2 border-l-gray-500 h-6 py-0">Resumo</TableHead>
                      <TableHead colSpan={3} className="sticky top-0 z-20 bg-gray-700 text-white text-center text-[10px] font-semibold border-l-2 border-l-gray-500 h-6 py-0">Jornada</TableHead>
                      <TableHead colSpan={2} className="sticky top-0 z-20 bg-gray-700 text-white text-center text-[10px] font-semibold border-l-2 border-l-gray-500 h-6 py-0">Desvios</TableHead>
                      <TableHead colSpan={2} className="sticky top-0 z-20 bg-gray-700 text-white text-center text-[10px] font-semibold border-l-2 border-l-gray-500 h-6 py-0">Extras</TableHead>
                      <TableHead colSpan={2} className="sticky top-0 z-20 bg-gray-700 text-white text-center text-[10px] font-semibold border-l-2 border-l-gray-500 h-6 py-0">Noturno</TableHead>
                      <TableHead colSpan={1} className="sticky top-0 z-20 bg-gray-700 text-white text-center text-[10px] font-semibold border-l-2 border-l-gray-500 h-6 py-0">BH</TableHead>
                      {canEdit && <TableHead className="sticky top-0 z-20 bg-gray-700 h-6 py-0"></TableHead>}
                    </TableRow>
                  )}
                  <TableRow>
                    {!showJornada && <TableHead className={`sticky top-0 z-10 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-bold h-8 py-0`}>Colaborador</TableHead>}
                    <TableHead className={`sticky ${showJornada ? 'top-6 left-0 z-20' : 'top-0 z-10'} bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-bold w-20 h-8 py-0`}>Data</TableHead>
                    <TableHead className={`sticky ${showJornada ? 'top-6' : 'top-0'} z-10 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-bold border-l-2 border-l-gray-300 h-8 py-0`}>Entrada</TableHead>
                    <TableHead className={`sticky ${showJornada ? 'top-6' : 'top-0'} z-10 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-bold h-8 py-0`}>Saída Int.</TableHead>
                    <TableHead className={`sticky ${showJornada ? 'top-6' : 'top-0'} z-10 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-bold h-8 py-0`}>Ret. Int.</TableHead>
                    <TableHead className={`sticky ${showJornada ? 'top-6' : 'top-0'} z-10 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-bold h-8 py-0`}>Saída</TableHead>
                    <TableHead className={`sticky ${showJornada ? 'top-6' : 'top-0'} z-10 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-bold border-l-2 border-l-gray-300 h-8 py-0`}>Horas</TableHead>
                    <TableHead className={`sticky ${showJornada ? 'top-6' : 'top-0'} z-10 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-bold h-8 py-0`}>Status</TableHead>
                    {showJornada && (
                      <>
                        <TableHead className="sticky top-6 z-10 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-bold text-center border-l-2 border-l-gray-300 h-8 py-0">CH</TableHead>
                        <TableHead className="sticky top-6 z-10 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-bold text-center h-8 py-0">Norm.</TableHead>
                        <TableHead className="sticky top-6 z-10 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-bold text-center h-8 py-0">Flt.</TableHead>
                        <TableHead className="sticky top-6 z-10 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-bold text-center border-l-2 border-l-gray-300 h-8 py-0">Atr.</TableHead>
                        <TableHead className="sticky top-6 z-10 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-bold text-center h-8 py-0">Adi.</TableHead>
                        <TableHead className="sticky top-6 z-10 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-bold text-center border-l-2 border-l-gray-300 h-8 py-0">E.BH</TableHead>
                        <TableHead className="sticky top-6 z-10 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-bold text-center h-8 py-0">E.100</TableHead>
                        <TableHead className="sticky top-6 z-10 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-bold text-center border-l-2 border-l-gray-300 h-8 py-0">A.Not</TableHead>
                        <TableHead className="sticky top-6 z-10 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-bold text-center h-8 py-0">N.100</TableHead>
                        <TableHead className="sticky top-6 z-10 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-bold text-center border-l-2 border-l-gray-300 h-8 py-0">Saldo</TableHead>
                      </>
                    )}
                    {canEdit && <TableHead className={`w-8 sticky ${showJornada ? 'top-6' : 'top-0'} z-10 bg-gray-100 dark:bg-gray-800 print:hidden h-8 py-0`}></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={showJornada ? 19 : 9} className="text-center py-8 text-muted-foreground text-sm">
                        {onlyInconsistencies ? 'Nenhuma inconsistência encontrada' : 'Nenhum registro para exibir'}
                      </TableCell>
                    </TableRow>
                  ) : displayRows.map((r, idx) => {
                    const j = r.jornada;
                    const isWeekend = [0, 6].includes(getDay(r.dateObj));
                    const isExtra100 = !!(j?.extra100 && j.extra100 > 0);
                    const hasInconsistency = r.tags.length > 0;
                    const saldo = j ? fmtSaldo(j.saldoBH) : { text: '', className: '' };
                    return (
                      <TableRow key={`${r.collaboratorId}-${r.date}`}
                        className={`${isExtra100 ? 'bg-pink-50 dark:bg-pink-950/20' : hasInconsistency ? 'bg-destructive/5' : idx % 2 === 1 ? 'bg-gray-50/60 dark:bg-gray-900/20' : ''}`}>
                        {!showJornada && (
                          <TableCell className="text-xs font-medium py-0.5 px-2">
                            <button onClick={() => { setSelectedCollaboratorId(r.collaboratorId); setOnlyInconsistencies(false); }}
                              className="hover:underline text-left truncate max-w-[140px] block" title={r.collaboratorName}>
                              {r.collaboratorName}
                            </button>
                          </TableCell>
                        )}
                        <TableCell className={`text-[11px] font-medium whitespace-nowrap tabular-nums py-0.5 px-2 ${showJornada ? 'sticky left-0 bg-inherit z-10' : ''}`}>
                          {format(r.dateObj, 'dd/MM')} <span className="text-muted-foreground">{r.weekday}</span>
                        </TableCell>
                        <TableCell className="text-xs tabular-nums py-0.5 px-1 border-l-2 border-l-gray-300">
                          <InlineTimeCell value={r.entrada} canEdit={canEdit} onSave={v => handleInlineSave(r, 'entrada', v)} />
                        </TableCell>
                        <TableCell className="text-xs tabular-nums py-0.5 px-1">
                          {r.isAutoInterval ? (
                            <span className="italic text-muted-foreground text-[10px]" title="Auto">🤖 {r.saidaInt}</span>
                          ) : (
                            <InlineTimeCell value={r.saidaInt} canEdit={canEdit} onSave={v => handleInlineSave(r, 'saida_intervalo', v)} />
                          )}
                        </TableCell>
                        <TableCell className="text-xs tabular-nums py-0.5 px-1">
                          {r.isAutoInterval ? (
                            <span className="italic text-muted-foreground text-[10px]" title="Auto">🤖 {r.retornoInt}</span>
                          ) : (
                            <InlineTimeCell value={r.retornoInt} canEdit={canEdit} onSave={v => handleInlineSave(r, 'retorno_intervalo', v)} />
                          )}
                        </TableCell>
                        <TableCell className="text-xs tabular-nums py-0.5 px-1">
                          <InlineTimeCell value={r.saida} canEdit={canEdit} onSave={v => handleInlineSave(r, 'saida', v)} />
                        </TableCell>
                        <TableCell className="text-[11px] tabular-nums font-medium py-0.5 border-l-2 border-l-gray-300">{r.hoursMin != null ? formatMinutes(r.hoursMin) : '—'}</TableCell>
                        <TableCell className="py-0.5">
                          <div className="flex items-center gap-0.5">
                            {renderStatusTag(r)}
                            {r.isAdjusted && <Wrench className="w-2.5 h-2.5 text-muted-foreground" />}
                          </div>
                        </TableCell>
                        {showJornada && (
                          <>
                            <TableCell className="text-[10px] tabular-nums text-center py-0.5 border-l-2 border-l-gray-300">{fmtHHMM(j?.chPrevista ?? null)}</TableCell>
                            <TableCell className="text-[10px] tabular-nums text-center py-0.5">{fmtHHMM(j?.normais ?? null)}</TableCell>
                            <TableCell className="text-[10px] tabular-nums text-center text-red-600 py-0.5">{fmtHHMM(j?.faltas ?? null)}</TableCell>
                            <TableCell className="text-[10px] tabular-nums text-center text-amber-600 py-0.5 border-l-2 border-l-gray-300">{fmtHHMM(j?.atraso ?? null)}</TableCell>
                            <TableCell className="text-[10px] tabular-nums text-center text-blue-600 py-0.5">{fmtHHMM(j?.adiantamento ?? null)}</TableCell>
                            <TableCell className="text-[10px] tabular-nums text-center text-green-600 py-0.5 border-l-2 border-l-gray-300">{fmtHHMM(j?.extraBH ?? null)}</TableCell>
                            <TableCell className="text-[10px] tabular-nums text-center text-purple-600 py-0.5">{fmtHHMM(j?.extra100 ?? null)}</TableCell>
                            <TableCell className="text-[10px] tabular-nums text-center text-indigo-600 py-0.5 border-l-2 border-l-gray-300">{fmtHHMM(j?.adNoturno ?? null)}</TableCell>
                            <TableCell className="text-[10px] tabular-nums text-center text-indigo-600 py-0.5">{fmtHHMM(j?.not100 ?? null)}</TableCell>
                            <TableCell className={`text-[10px] tabular-nums text-center font-medium py-0.5 border-l-2 border-l-gray-300 ${saldo.className}`}>{saldo.text}</TableCell>
                          </>
                        )}
                        {canEdit && (
                          <TableCell className="print:hidden py-0.5 px-1">
                            <button onClick={() => openAdjustment(r)}
                              className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Editar batida">
                              <Pencil className="w-3 h-3" />
                            </button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
                {showJornada && jornadaTotals && (
                  <TableFooter>
                    <TableRow className="font-semibold bg-muted/50">
                      <TableCell colSpan={7} className="text-[10px] text-right sticky left-0 bg-muted/50 z-10 py-1">TOTAIS</TableCell>
                      <TableCell className="text-[10px] tabular-nums text-center py-1">{fmtHHMM(jornadaTotals.chPrevista)}</TableCell>
                      <TableCell className="text-[10px] tabular-nums text-center py-1">{fmtHHMM(jornadaTotals.normais)}</TableCell>
                      <TableCell className="text-[10px] tabular-nums text-center text-red-600 py-1">{fmtHHMM(jornadaTotals.faltas)}</TableCell>
                      <TableCell className="text-[10px] tabular-nums text-center text-amber-600 py-1">{fmtHHMM(jornadaTotals.atraso)}</TableCell>
                      <TableCell className="text-[10px] tabular-nums text-center text-blue-600 py-1">{fmtHHMM(jornadaTotals.adiantamento)}</TableCell>
                      <TableCell className="text-[10px] tabular-nums text-center text-green-600 py-1">{fmtHHMM(jornadaTotals.extraBH)}</TableCell>
                      <TableCell className="text-[10px] tabular-nums text-center text-purple-600 py-1">{fmtHHMM(jornadaTotals.extra100)}</TableCell>
                      <TableCell className="text-[10px] tabular-nums text-center text-indigo-600 py-1">{fmtHHMM(jornadaTotals.adNoturno)}</TableCell>
                      <TableCell className="text-[10px] tabular-nums text-center text-indigo-600 py-1">{fmtHHMM(jornadaTotals.not100)}</TableCell>
                      <TableCell className={`text-[10px] tabular-nums text-center font-bold py-1 ${fmtSaldo(jornadaTotals.saldoBH).className}`}>{fmtSaldo(jornadaTotals.saldoBH).text}</TableCell>
                      {canEdit && <TableCell className="print:hidden py-1" />}
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>

      <PrintFooter />
      <UpdatePunchesDialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen} collaborators={collaborators} />

      {adjCollabId && adjustmentRow && (
        <PunchAdjustmentDialog
          open={adjustmentOpen} onOpenChange={(v) => { setAdjustmentOpen(v); if (!v) setAdjustmentCollaborator(null); }}
          collaboratorId={adjCollabId} collaboratorName={adjCollabName}
          date={adjustmentRow.date} dateObj={adjustmentRow.dateObj}
          entrada={adjustmentRow.entrada} saidaInt={adjustmentRow.saidaInt}
          retornoInt={adjustmentRow.retornoInt} saida={adjustmentRow.saida}
          punchPattern={adjCollabId ? patternCache.get(adjCollabId) ?? null : null}
        />
      )}
    </div>
  );
}
