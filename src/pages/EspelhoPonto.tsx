import { useState, useMemo, useEffect, useCallback, lazy, Suspense } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Download, Calendar, AlertTriangle, Pencil, Wrench, Banknote, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
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

const WEEKDAY_MAP: Record<number, DayOfWeek> = {
  0: 'DOMINGO', 1: 'SEGUNDA', 2: 'TERCA', 3: 'QUARTA', 4: 'QUINTA', 5: 'SEXTA', 6: 'SABADO',
};

function calcHours(entrada: string | null, saida: string | null, saidaInt: string | null, retornoInt: string | null): number | null {
  if (!entrada || !saida) return null;
  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const adjustForOvernight = (timeMin: number, refMin: number) => {
    if (timeMin < 180 && refMin > timeMin) return timeMin + 1440;
    return timeMin;
  };
  const entradaMin = toMin(entrada);
  let saidaMin = adjustForOvernight(toMin(saida), entradaMin);
  let total = saidaMin - entradaMin;
  if (saidaInt && retornoInt) {
    const saidaIntMin = toMin(saidaInt);
    const retornoIntMin = adjustForOvernight(toMin(retornoInt), saidaIntMin);
    total -= (retornoIntMin - saidaIntMin);
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

// Inconsistency detection for RegistroPonto-style analysis
type InconsistencyType = 'incomplete' | 'saida_pendente' | 'sem_intervalo' | 'jornada_longa' | 'jornada_curta';

const TYPE_LABELS: Record<InconsistencyType, string> = {
  incomplete: 'Batidas incompletas',
  saida_pendente: 'Batida pendente',
  sem_intervalo: 'Sem intervalo',
  jornada_longa: 'Jornada > 14h',
  jornada_curta: 'Jornada < 2h',
};

interface GlobalInconsistency {
  collaboratorId: string;
  collaboratorName: string;
  date: string;
  entrada: string | null;
  saidaIntervalo: string | null;
  retornoIntervalo: string | null;
  saida: string | null;
  types: InconsistencyType[];
  workedMinutes: number | null;
}

function detectGlobalInconsistency(record: { collaborator_id: string; collaborator_name: string; date: string; entrada: string | null; saida: string | null; saida_intervalo: string | null; retorno_intervalo: string | null; }): GlobalInconsistency | null {
  const { entrada, saida, saida_intervalo, retorno_intervalo } = record;
  const fields = [entrada, saida_intervalo, retorno_intervalo, saida];
  const filled = fields.filter(f => f && f !== '').length;
  if (filled === 0) return null;
  const types: InconsistencyType[] = [];
  if (filled > 0 && filled < 4) {
    if (entrada && !saida) types.push('saida_pendente');
    else if (entrada && saida && !saida_intervalo && !retorno_intervalo) types.push('sem_intervalo');
    else types.push('incomplete');
  }
  const worked = calcHours(entrada, saida, saida_intervalo, retorno_intervalo);
  if (worked !== null) {
    if (worked > 14 * 60) types.push('jornada_longa');
    if (worked < 2 * 60 && worked > 0) types.push('jornada_curta');
  }
  if (types.length === 0) return null;
  return {
    collaboratorId: record.collaborator_id,
    collaboratorName: record.collaborator_name,
    date: record.date,
    entrada, saidaIntervalo: saida_intervalo, retornoIntervalo: retorno_intervalo, saida,
    types, workedMinutes: worked,
  };
}

export default function EspelhoPonto() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedCollaboratorId, setSelectedCollaboratorId] = useState<string | null>(null);
  const [searchName, setSearchName] = useState('');
  const [sectorFilter, setSectorFilter] = useState<string>('Todos');
  const [showAllInconsistencies, setShowAllInconsistencies] = useState(false);
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

  // Realtime subscription
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

  // Dynamic sectors from collaborators
  const sectors = useMemo(() => {
    const s = new Set<string>();
    collaborators.forEach(c => { if (c.sector) s.add(c.sector); });
    return Array.from(s).sort();
  }, [collaborators]);

  // Fetch sunday_tracking for current month
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
    () => collaborators.filter(c => c.status !== 'DESLIGADO'),
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

  const daysInMonth = getDaysInMonth(new Date(selectedYear, selectedMonth));
  const holidaySet = useMemo(() => new Set(holidays.map(h => h.date)), [holidays]);

  type DayRow = {
    date: string; dateObj: Date; weekday: string;
    entrada: string | null; saidaInt: string | null; retornoInt: string | null; saida: string | null;
    hoursMin: number | null; status: string; statusEmoji: string; isAdjusted: boolean;
    isFolga: boolean; isVacation: boolean; isAfastamento: boolean; isHoliday: boolean; isFuture: boolean;
    isAutoInterval: boolean;
  };

  const swapOverrides = useMemo(() => buildSwapOverrides(scheduleEvents), [scheduleEvents]);
  const eventsMap = useMemo(() => buildEventsMap(scheduleEvents), [scheduleEvents]);

  const getWeekStart = (date: Date): string => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return format(d, 'yyyy-MM-dd');
  };

  const rows: DayRow[] = useMemo(() => {
    if (!selected) return [];
    const collabPunches = punchRecords.filter(p => p.collaborator_id === selected.id);
    const punchMap = new Map<string, typeof punchRecords[0]>();
    collabPunches.forEach(p => punchMap.set(p.date, p));

    const result: DayRow[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(selectedYear, selectedMonth, d);
      const iso = format(dateObj, 'yyyy-MM-dd');
      const wd = WEEKDAY_MAP[getDay(dateObj)];
      const weekday = format(dateObj, 'EEE', { locale: ptBR });

      const punch = punchMap.get(iso);
      let entrada = punch?.entrada ?? null;
      let saida = punch?.saida ?? null;
      let saidaInt = punch?.saida_intervalo ?? null;
      let retornoInt = punch?.retorno_intervalo ?? null;

      // Auto-interval
      let isAutoInterval = false;
      if (selected.intervalo_automatico && selected.intervalo_inicio && selected.intervalo_duracao) {
        const filledPunches = [entrada, saidaInt, retornoInt, saida].filter(Boolean) as string[];
        if (filledPunches.length === 2) {
          const osk = (t: string) => { const h = parseInt(t.split(':')[0]); return h < 3 ? parseInt(t.replace(':', '')) + 2400 : parseInt(t.replace(':', '')); };
          const sorted = [...filledPunches].sort((a, b) => osk(a) - osk(b));
          entrada = sorted[0];
          saida = sorted[1];
          const intKey = osk(selected.intervalo_inicio);
          const entKey = osk(entrada);
          const saiKey = osk(saida);
          if (intKey > entKey && intKey < saiKey) {
            saidaInt = selected.intervalo_inicio;
            const [ih, im] = selected.intervalo_inicio.split(':').map(Number);
            const totalMin = ih * 60 + im + selected.intervalo_duracao;
            retornoInt = `${String(Math.floor(totalMin / 60) % 24).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
            isAutoInterval = true;
          }
        }
      }

      const hoursMin = calcHours(entrada, saida, saidaInt, retornoInt);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const isFuture = dateObj >= today;
      const isHoliday = holidaySet.has(iso);
      const isVacation = vacations.some(v => v.collaborator_id === selected.id && iso >= v.data_inicio_ferias && iso <= v.data_fim_ferias);
      const isAfastamento = afastamentos.some(a => a.collaborator_id === selected.id && iso >= a.data_inicio && iso <= a.data_fim);

      const weekStart = getWeekStart(dateObj);
      const overrideKey = `${weekStart}|${selected.id}`;
      const override = swapOverrides.get(overrideKey);
      let isBaseFolga = !!selected.folgas_semanais?.includes(wd);
      if (!isBaseFolga && selected.sunday_n > 0 && getDay(dateObj) === 0) {
        let sundayCount = 0;
        for (let day = 1; day <= d; day++) {
          if (getDay(new Date(selectedYear, selectedMonth, day)) === 0) sundayCount++;
        }
        if (sundayCount === selected.sunday_n) isBaseFolga = true;
      }
      let isFolga = isBaseFolga;
      if (override) {
        const wdLower = wd.toLowerCase();
        if (override.removeDays.some(rd => rd?.toLowerCase() === wdLower)) isFolga = false;
        if (override.addDays.some(ad => ad?.toLowerCase() === wdLower)) isFolga = true;
      }
      const dayEvents = eventsMap[iso]?.[selected.id] ?? [];
      const isFaltaJustificada = dayEvents.some(e => e.event_type === 'FALTA' && e.status === 'ATIVO');
      const isAtestado = dayEvents.some(e => e.event_type === 'ATESTADO' && e.status === 'ATIVO');
      const isCompensacao = dayEvents.some(e => e.event_type === 'COMPENSACAO' && e.status === 'ATIVO');
      const isTrocaFolga = override && (override.addDays.some(ad => ad?.toLowerCase() === wd.toLowerCase()));

      let status = isFuture ? '—' : '❌ Falta';
      let statusEmoji = isFuture ? '—' : '❌';
      if (isVacation) { status = '📅 Férias'; statusEmoji = '📅'; }
      else if (isAfastamento || isAtestado) { status = '🏥 Afastado'; statusEmoji = '🏥'; }
      else if (isHoliday) { status = '🎉 Feriado'; statusEmoji = '🎉'; }
      else if (isCompensacao) { status = '🎉 Compensação'; statusEmoji = '🎉'; isFolga = true; }
      else if (isFolga && isTrocaFolga) { status = '🔄 Folga (troca)'; statusEmoji = '🔄'; }
      else if (isFolga) { status = '🏖️ Folga'; statusEmoji = '🏖️'; }
      else if (isFaltaJustificada && !entrada) { status = '❌ Falta justificada'; statusEmoji = '❌'; }
      else if (entrada && saida) { status = '✅ Normal'; statusEmoji = '✅'; }
      else if (entrada && !saida) { status = '⚠️ Batida pendente'; statusEmoji = '⚠️'; }

      if (isAtestado || isCompensacao) isFolga = true;

      const isAdjusted = punch ? !!(punch as any).adjusted_at : false;
      result.push({ date: iso, dateObj, weekday, entrada, saidaInt, retornoInt, saida, hoursMin, status, statusEmoji, isAdjusted, isFolga, isVacation, isAfastamento: isAfastamento || isAtestado, isHoliday, isFuture, isAutoInterval });
    }
    return result;
  }, [selected, selectedMonth, selectedYear, daysInMonth, punchRecords, swapOverrides, eventsMap, vacations, afastamentos, holidaySet]);

  // Jornada calculations
  const { jornadaRows, jornadaTotals, consecutiveSundaysEnd } = useMemo(() => {
    if (!selected || rows.length === 0) return { jornadaRows: [] as JornadaRow[], jornadaTotals: null, consecutiveSundaysEnd: 0 };
    const WEEKDAY_NAME_MAP: Record<number, string> = { 0: 'domingo', 1: 'segunda', 2: 'terca', 3: 'quarta', 4: 'quinta', 5: 'sexta', 6: 'sabado' };
    const defaultChMin = selected.carga_horaria_diaria
      ? (() => { const [h, m] = selected.carga_horaria_diaria!.split(':').map(Number); return h * 60 + (m || 0); })()
      : 420;
    const avisoReducao = (selected.status === 'AVISO_PREVIO' && selected.aviso_previo_reducao === 2) ? 120 : 0;
    const dayInfos = rows.map(r => {
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
      if (avisoReducao > 0 && !r.isFolga && !r.isVacation && !r.isAfastamento && !r.isHoliday) {
        chForDay = Math.max(0, chForDay - avisoReducao);
      }
      return {
        date: r.date, isFolga: r.isFolga, isVacation: r.isVacation, isAfastamento: r.isAfastamento,
        isHoliday: r.isHoliday, isFuture: r.isFuture,
        punch: { entrada: r.entrada, saida: r.saida, saidaInt: r.saidaInt, retornoInt: r.retornoInt },
        hoursWorkedMin: r.hoursMin, chOverride: chForDay,
      };
    });
    const consecutiveFromPrev = (selected.genero === 'F' && sundayTracking) ? sundayTracking.consecutive_sundays_from_previous : 0;
    const result = calculateJornada(dayInfos, defaultChMin, selected.genero ?? 'M', consecutiveFromPrev);
    return { jornadaRows: result.rows, jornadaTotals: result.totals, consecutiveSundaysEnd: result.consecutiveSundaysEnd };
  }, [rows, selected, sundayTracking]);

  // Bank hours
  const prevMonthBalance = useMemo(() => {
    if (!bankBalances.length) return 0;
    let prevMonth = selectedMonth - 1;
    let prevYear = selectedYear;
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

  // Inline save handler
  const handleInlineSave = useCallback(async (row: DayRow, field: 'entrada' | 'saida_intervalo' | 'retorno_intervalo' | 'saida', newValue: string | null) => {
    if (!selected) return;
    const currentValues = { entrada: row.entrada, saida_intervalo: row.saidaInt, retorno_intervalo: row.retornoInt, saida: row.saida };
    currentValues[field] = newValue;
    const times = [currentValues.entrada, currentValues.saida_intervalo, currentValues.retorno_intervalo, currentValues.saida].filter(Boolean) as string[];
    const overnightSortKey = (t: string) => { const h = parseInt(t.split(':')[0]); return h < 3 ? parseInt(t.replace(':', '')) + 2400 : parseInt(t.replace(':', '')); };
    times.sort((a, b) => overnightSortKey(a) - overnightSortKey(b));
    const sorted = { entrada: null as string | null, saida_intervalo: null as string | null, retorno_intervalo: null as string | null, saida: null as string | null };
    if (times.length >= 1) sorted.entrada = times[0];
    if (times.length >= 2) sorted.saida_intervalo = times[1];
    if (times.length >= 3) sorted.retorno_intervalo = times[2];
    if (times.length >= 4) sorted.saida = times[3];
    if (times.length === 1) {
      sorted.entrada = null; sorted.saida_intervalo = null; sorted.retorno_intervalo = null; sorted.saida = null;
      sorted[field] = times[0];
    }
    const allEmpty = !sorted.entrada && !sorted.saida_intervalo && !sorted.retorno_intervalo && !sorted.saida;
    try {
      if (allEmpty) {
        await supabase.from('punch_records').delete().eq('collaborator_id', selected.id).eq('date', row.date);
      } else {
        const record = {
          collaborator_id: selected.id, collaborator_name: selected.collaborator_name, date: row.date,
          ...sorted, adjusted_by: usuario?.id ?? null, adjusted_at: new Date().toISOString(), adjustment_reason: 'Edição inline',
        };
        await supabase.from('punch_records').upsert(record as any, { onConflict: 'collaborator_id,date' });
      }
      await queryClient.invalidateQueries({ queryKey: ['punch_records'] });
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + (err.message ?? 'desconhecido'));
    }
  }, [selected, usuario, queryClient]);

  // Inconsistency detection for espelho
  const isInconsistentDay = useCallback((r: DayRow) => {
    if (r.isFuture || r.isFolga || r.isVacation || r.isAfastamento || r.isHoliday) return false;
    if (r.status === '❌ Falta') return true;
    if (r.status === '⚠️ Batida pendente') return true;
    const filled = [r.entrada, r.saidaInt, r.retornoInt, r.saida].filter(Boolean).length;
    if (filled > 0 && filled < 4) return true;
    if (r.hoursMin != null && r.hoursMin > 14 * 60) return true;
    if (r.hoursMin != null && r.hoursMin > 0 && r.hoursMin < 2 * 60) return true;
    return false;
  }, []);

  const inconsistencyCount = useMemo(() => rows.filter(isInconsistentDay).length, [rows, isInconsistentDay]);

  // Global inconsistencies from ALL punch_records for the month
  const globalInconsistencies = useMemo(() => {
    const results: GlobalInconsistency[] = [];
    for (const r of punchRecords) {
      const inc = detectGlobalInconsistency(r);
      if (inc) results.push(inc);
    }
    results.sort((a, b) => {
      const d = b.date.localeCompare(a.date);
      return d !== 0 ? d : a.collaboratorName.localeCompare(b.collaboratorName);
    });
    return results;
  }, [punchRecords]);

  // Inconsistencies to display in bottom panel
  const displayedInconsistencies = useMemo(() => {
    if (showAllInconsistencies) return globalInconsistencies;
    if (!selected) return [];
    return globalInconsistencies.filter(i => i.collaboratorId === selected.id);
  }, [showAllInconsistencies, globalInconsistencies, selected]);

  const totalWorked = rows.filter(r => r.status === '✅ Normal').length;
  const totalFaltas = rows.filter(r => r.status === '❌ Falta').length;
  const totalHoursMin = rows.reduce((acc, r) => acc + (r.hoursMin ?? 0), 0);

  const years = useMemo(() => { const y = now.getFullYear(); return [y - 1, y, y + 1]; }, []);

  // Summary card values (filtered by sector/collaborator)
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
      if (detectGlobalInconsistency(r)) incCount++;
    }
    return { totalRegistros, totalCollabs, totalInconsistencias: incCount, totalOk: totalRegistros - incCount };
  }, [punchRecords, activeCollabs, sectorFilter, selectedCollaboratorId]);

  // Export Excel
  const exportExcel = () => {
    if (!selected || rows.length === 0) return;
    const data = rows.map((r, i) => {
      const j = jornadaRows[i];
      return {
        'Data': format(r.dateObj, 'dd/MM/yyyy'), 'Dia': r.weekday,
        'Entrada': r.entrada ?? '', 'Saída Int.': r.saidaInt ?? '',
        'Retorno Int.': r.retornoInt ?? '', 'Saída': r.saida ?? '',
        'Horas Trab.': r.hoursMin != null ? formatMinutes(r.hoursMin) : '', 'Status': r.status,
        'CH Prevista': fmtHHMM(j?.chPrevista ?? null), 'Normais': fmtHHMM(j?.normais ?? null),
        'Faltas': fmtHHMM(j?.faltas ?? null), 'Atraso': fmtHHMM(j?.atraso ?? null),
        'Adiantamento': fmtHHMM(j?.adiantamento ?? null), 'Extra BH': fmtHHMM(j?.extraBH ?? null),
        'Extra 100%': fmtHHMM(j?.extra100 ?? null), 'Ad. Noturno': fmtHHMM(j?.adNoturno ?? null),
        'Not. 100%': fmtHHMM(j?.not100 ?? null),
        'Saldo BH': j?.saldoBH != null && j.saldoBH !== 0 ? fmtSaldo(j.saldoBH).text : '',
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Espelho');
    const monthName = MONTHS[selectedMonth].label;
    XLSX.writeFile(wb, `espelho-${selected.collaborator_name}-${monthName}-${selectedYear}.xlsx`);
  };

  const openAdjustmentForInconsistency = (inc: GlobalInconsistency) => {
    const dateObj = parse(inc.date, 'yyyy-MM-dd', new Date());
    setAdjustmentCollaborator({ id: inc.collaboratorId, name: inc.collaboratorName });
    setAdjustmentRow({
      date: inc.date, dateObj,
      entrada: inc.entrada, saidaInt: inc.saidaIntervalo,
      retornoInt: inc.retornoIntervalo, saida: inc.saida,
    });
    setAdjustmentOpen(true);
  };

  const saldoMes = fmtSaldo(currentMonthSaldo);
  const saldoAcum = fmtSaldo(accumulatedBalance);

  const formatDate = (iso: string) => {
    try { return format(parse(iso, 'yyyy-MM-dd', new Date()), "dd/MM (EEE)", { locale: ptBR }); }
    catch { return iso; }
  };

  const adjCollabId = adjustmentCollaborator?.id ?? selected?.id ?? '';
  const adjCollabName = adjustmentCollaborator?.name ?? selected?.collaborator_name ?? '';

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
          {/* Sector filter buttons */}
          <div className="flex flex-wrap gap-1">
            <Button
              variant={sectorFilter === 'Todos' ? 'default' : 'outline'}
              size="sm" className="h-6 px-2 text-[10px]"
              onClick={() => setSectorFilter('Todos')}
            >Todos</Button>
            {sectors.map(s => (
              <Button
                key={s}
                variant={sectorFilter === s ? 'default' : 'outline'}
                size="sm" className="h-6 px-2 text-[10px]"
                onClick={() => setSectorFilter(s)}
              >{s}</Button>
            ))}
          </div>
          {/* Collaborator list */}
          <div className="flex-1 overflow-y-auto space-y-0.5 min-h-0">
            {filteredCollabs.map(c => (
              <button key={c.id} onClick={() => { setSelectedCollaboratorId(c.id); setShowAllInconsistencies(false); }}
                className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${selectedCollaboratorId === c.id ? 'bg-primary text-primary-foreground font-medium' : 'hover:bg-muted'}`}>
                <span className="block truncate text-xs">{c.collaborator_name}</span>
                <span className={`text-[10px] ${selectedCollaboratorId === c.id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{c.sector}</span>
              </button>
            ))}
            {filteredCollabs.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhum encontrado</p>}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0 gap-2">
          {/* 1. Summary cards */}
          <div className="grid grid-cols-4 gap-2 shrink-0">
            <Card>
              <CardContent className="p-2">
                <p className="text-[10px] text-muted-foreground">Total de Registros</p>
                <p className="text-lg font-bold tabular-nums">{summaryStats.totalRegistros}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-2">
                <p className="text-[10px] text-muted-foreground">Colaboradores</p>
                <p className="text-lg font-bold tabular-nums">{summaryStats.totalCollabs}</p>
              </CardContent>
            </Card>
            <Card className={summaryStats.totalInconsistencias > 0 ? 'border-destructive/50 bg-destructive/5' : ''}>
              <CardContent className="p-2">
                <p className="text-[10px] text-muted-foreground">Inconsistências</p>
                <p className={`text-lg font-bold tabular-nums ${summaryStats.totalInconsistencias > 0 ? 'text-destructive' : ''}`}>{summaryStats.totalInconsistencias}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-2">
                <p className="text-[10px] text-muted-foreground">Registros OK</p>
                <p className="text-lg font-bold tabular-nums text-green-600">{summaryStats.totalOk}</p>
              </CardContent>
            </Card>
          </div>

          {/* 2. Month selector + actions */}
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
              <Button
                variant="outline" size="sm"
                className={`text-xs ${showAllInconsistencies ? 'bg-amber-50 border-amber-300 text-amber-700' : 'text-amber-600 border-amber-200 hover:bg-amber-50'}`}
                onClick={() => setShowAllInconsistencies(!showAllInconsistencies)}
              >
                <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                ⚠️ Inconsistências ({globalInconsistencies.length})
              </Button>
              <Button variant="default" size="sm" className="text-xs" onClick={() => setUpdateDialogOpen(true)}>
                <RefreshCw className="w-3.5 h-3.5 mr-1" /> Atualizar Batidas
              </Button>
              {selected && (
                <Button variant="outline" size="sm" className="text-xs" onClick={exportExcel}>
                  <Download className="w-3.5 h-3.5 mr-1" /> Excel
                </Button>
              )}
            </div>
          </div>

          {/* 3. Espelho panel (60%) */}
          <div className="flex-[6] min-h-0 overflow-hidden">
            {!selected ? (
              <Card className="h-full flex items-center justify-center">
                <CardContent className="text-center text-muted-foreground">
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="font-medium text-sm">Selecione um colaborador</p>
                  <p className="text-xs mt-1">Escolha na lista ao lado para ver o espelho de ponto</p>
                </CardContent>
              </Card>
            ) : (
              <Card className="h-full flex flex-col overflow-hidden">
                {/* Collaborator header */}
                <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-semibold">{selected.collaborator_name}</h3>
                    <Badge variant="outline" className="text-[10px]">{selected.sector}</Badge>
                    <span className="text-[10px] text-muted-foreground">
                      Trab: {totalWorked} · Faltas: {totalFaltas} · Horas: {formatMinutes(totalHoursMin)}
                    </span>
                    {inconsistencyCount > 0 && (
                      <Badge variant="destructive" className="text-[10px]">
                        <AlertTriangle className="w-3 h-3 mr-0.5" /> {inconsistencyCount}
                      </Badge>
                    )}
                  </div>
                  {/* Bank hours mini */}
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
                <CardContent className="p-0 flex-1 overflow-auto min-h-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20 sticky top-0 left-0 bg-background z-20 text-xs">Data</TableHead>
                        <TableHead className="sticky top-0 bg-background z-10 text-xs">Entrada</TableHead>
                        <TableHead className="sticky top-0 bg-background z-10 text-xs">Saída Int.</TableHead>
                        <TableHead className="sticky top-0 bg-background z-10 text-xs">Ret. Int.</TableHead>
                        <TableHead className="sticky top-0 bg-background z-10 text-xs">Saída</TableHead>
                        <TableHead className="sticky top-0 bg-background z-10 text-xs">Horas</TableHead>
                        <TableHead className="sticky top-0 bg-background z-10 text-xs">Status</TableHead>
                        <TableHead className="sticky top-0 bg-background z-10 text-xs text-center">CH</TableHead>
                        <TableHead className="sticky top-0 bg-background z-10 text-xs text-center">Norm.</TableHead>
                        <TableHead className="sticky top-0 bg-background z-10 text-xs text-center">Flt.</TableHead>
                        <TableHead className="sticky top-0 bg-background z-10 text-xs text-center">Atr.</TableHead>
                        <TableHead className="sticky top-0 bg-background z-10 text-xs text-center">Adi.</TableHead>
                        <TableHead className="sticky top-0 bg-background z-10 text-xs text-center">E.BH</TableHead>
                        <TableHead className="sticky top-0 bg-background z-10 text-xs text-center">E.100</TableHead>
                        <TableHead className="sticky top-0 bg-background z-10 text-xs text-center">A.Not</TableHead>
                        <TableHead className="sticky top-0 bg-background z-10 text-xs text-center">N.100</TableHead>
                        <TableHead className="sticky top-0 bg-background z-10 text-xs text-center">Saldo</TableHead>
                        {canEdit && <TableHead className="w-8 sticky top-0 bg-background z-10 print:hidden"></TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((r, idx) => {
                        const j = jornadaRows[idx];
                        const isWeekend = [0, 6].includes(getDay(r.dateObj));
                        const isExtra100 = !!(j?.extra100 && j.extra100 > 0);
                        const saldo = j ? fmtSaldo(j.saldoBH) : { text: '', className: '' };
                        return (
                          <TableRow key={r.date} className={`${isExtra100 ? 'bg-pink-50 dark:bg-pink-950/20' : isWeekend ? 'bg-muted/30' : ''}`}>
                            <TableCell className="text-[11px] font-medium whitespace-nowrap tabular-nums sticky left-0 bg-background z-10 py-1 px-2">
                              {format(r.dateObj, 'dd/MM')} <span className="text-muted-foreground">{r.weekday}</span>
                            </TableCell>
                            <TableCell className="text-xs tabular-nums p-1">
                              <InlineTimeCell value={r.entrada} canEdit={canEdit} onSave={v => handleInlineSave(r, 'entrada', v)} />
                            </TableCell>
                            <TableCell className="text-xs tabular-nums p-1">
                              {r.isAutoInterval ? (
                                <span className="italic text-muted-foreground text-[10px]" title="Auto">🤖 {r.saidaInt}</span>
                              ) : (
                                <InlineTimeCell value={r.saidaInt} canEdit={canEdit} onSave={v => handleInlineSave(r, 'saida_intervalo', v)} />
                              )}
                            </TableCell>
                            <TableCell className="text-xs tabular-nums p-1">
                              {r.isAutoInterval ? (
                                <span className="italic text-muted-foreground text-[10px]" title="Auto">🤖 {r.retornoInt}</span>
                              ) : (
                                <InlineTimeCell value={r.retornoInt} canEdit={canEdit} onSave={v => handleInlineSave(r, 'retorno_intervalo', v)} />
                              )}
                            </TableCell>
                            <TableCell className="text-xs tabular-nums p-1">
                              <InlineTimeCell value={r.saida} canEdit={canEdit} onSave={v => handleInlineSave(r, 'saida', v)} />
                            </TableCell>
                            <TableCell className="text-[11px] tabular-nums font-medium py-1">{r.hoursMin != null ? formatMinutes(r.hoursMin) : '—'}</TableCell>
                            <TableCell className="py-1">
                              <span className="text-[10px] whitespace-nowrap flex items-center gap-0.5">
                                {isExtra100 ? <span className="text-pink-600 font-medium">💯 Art.386</span> : r.status}
                                {r.isAdjusted && <Wrench className="w-2.5 h-2.5 text-muted-foreground inline" />}
                              </span>
                            </TableCell>
                            <TableCell className="text-[10px] tabular-nums text-center py-1">{fmtHHMM(j?.chPrevista ?? null)}</TableCell>
                            <TableCell className="text-[10px] tabular-nums text-center py-1">{fmtHHMM(j?.normais ?? null)}</TableCell>
                            <TableCell className="text-[10px] tabular-nums text-center text-red-600 py-1">{fmtHHMM(j?.faltas ?? null)}</TableCell>
                            <TableCell className="text-[10px] tabular-nums text-center text-amber-600 py-1">{fmtHHMM(j?.atraso ?? null)}</TableCell>
                            <TableCell className="text-[10px] tabular-nums text-center text-blue-600 py-1">{fmtHHMM(j?.adiantamento ?? null)}</TableCell>
                            <TableCell className="text-[10px] tabular-nums text-center text-green-600 py-1">{fmtHHMM(j?.extraBH ?? null)}</TableCell>
                            <TableCell className="text-[10px] tabular-nums text-center text-purple-600 py-1">{fmtHHMM(j?.extra100 ?? null)}</TableCell>
                            <TableCell className="text-[10px] tabular-nums text-center text-indigo-600 py-1">{fmtHHMM(j?.adNoturno ?? null)}</TableCell>
                            <TableCell className="text-[10px] tabular-nums text-center text-indigo-600 py-1">{fmtHHMM(j?.not100 ?? null)}</TableCell>
                            <TableCell className={`text-[10px] tabular-nums text-center font-medium py-1 ${saldo.className}`}>{saldo.text}</TableCell>
                            {canEdit && (
                              <TableCell className="print:hidden py-1 px-1">
                                <button onClick={() => { setAdjustmentCollaborator({ id: selected.id, name: selected.collaborator_name }); setAdjustmentRow({ date: r.date, dateObj: r.dateObj, entrada: r.entrada, saidaInt: r.saidaInt, retornoInt: r.retornoInt, saida: r.saida }); setAdjustmentOpen(true); }}
                                  className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Editar batida">
                                  <Pencil className="w-3 h-3" />
                                </button>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                    {jornadaTotals && (
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
            )}
          </div>

          {/* 4. Inconsistencies panel (40%) */}
          <div className="flex-[4] min-h-0 overflow-hidden print:hidden">
            <Card className="h-full flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  <h3 className="text-sm font-semibold">
                    {showAllInconsistencies ? 'Todas as Inconsistências' : selected ? `Inconsistências — ${selected.collaborator_name}` : 'Inconsistências'}
                  </h3>
                  <Badge variant="destructive" className="text-[10px]">{displayedInconsistencies.length}</Badge>
                </div>
                {selected && !showAllInconsistencies && (
                  <Button variant="ghost" size="sm" className="text-[10px] text-amber-600" onClick={() => setShowAllInconsistencies(true)}>
                    Ver todos os colaboradores
                  </Button>
                )}
                {showAllInconsistencies && (
                  <Button variant="ghost" size="sm" className="text-[10px]" onClick={() => setShowAllInconsistencies(false)}>
                    Voltar para colaborador
                  </Button>
                )}
              </div>
              <CardContent className="p-0 flex-1 overflow-auto min-h-0">
                {displayedInconsistencies.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <div className="text-center">
                      <CheckCircle2 className="w-6 h-6 mx-auto mb-1 opacity-40" />
                      <p className="text-xs">{!selected && !showAllInconsistencies ? 'Selecione um colaborador ou veja todas' : 'Nenhuma inconsistência'}</p>
                    </div>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {showAllInconsistencies && <TableHead className="sticky top-0 bg-background z-10 text-xs">Colaborador</TableHead>}
                        <TableHead className="sticky top-0 bg-background z-10 text-xs">Data</TableHead>
                        <TableHead className="sticky top-0 bg-background z-10 text-xs">Entrada</TableHead>
                        <TableHead className="sticky top-0 bg-background z-10 text-xs">Saída Int.</TableHead>
                        <TableHead className="sticky top-0 bg-background z-10 text-xs">Ret. Int.</TableHead>
                        <TableHead className="sticky top-0 bg-background z-10 text-xs">Saída</TableHead>
                        <TableHead className="sticky top-0 bg-background z-10 text-xs">Horas</TableHead>
                        <TableHead className="sticky top-0 bg-background z-10 text-xs">Status</TableHead>
                        {canEdit && <TableHead className="w-8 sticky top-0 bg-background z-10"></TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayedInconsistencies.map((inc, i) => (
                        <TableRow key={`${inc.collaboratorId}-${inc.date}-${i}`}>
                          {showAllInconsistencies && <TableCell className="text-xs font-medium py-1">{inc.collaboratorName}</TableCell>}
                          <TableCell className="text-xs whitespace-nowrap py-1">{formatDate(inc.date)}</TableCell>
                          <TableCell className="text-[11px] font-mono py-1">{inc.entrada || '—'}</TableCell>
                          <TableCell className="text-[11px] font-mono py-1">{inc.saidaIntervalo || '—'}</TableCell>
                          <TableCell className="text-[11px] font-mono py-1">{inc.retornoIntervalo || '—'}</TableCell>
                          <TableCell className="text-[11px] font-mono py-1">{inc.saida || '—'}</TableCell>
                          <TableCell className="text-[11px] font-mono py-1">{formatMinutesHHMM(inc.workedMinutes)}</TableCell>
                          <TableCell className="py-1">
                            <div className="flex flex-col gap-0.5">
                              {inc.types.map(t => (
                                <Badge key={t} variant="destructive" className="text-[9px] w-fit">
                                  {TYPE_LABELS[t]}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          {canEdit && (
                            <TableCell className="py-1 px-1">
                              <button onClick={() => openAdjustmentForInconsistency(inc)}
                                className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Corrigir batida">
                                <Pencil className="w-3 h-3" />
                              </button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
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
        />
      )}
    </div>
  );
}
