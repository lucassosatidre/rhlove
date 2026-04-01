import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, TrendingUp, TrendingDown, AlertTriangle, Plus, ArrowUpDown, Download, Pencil, Gift, RefreshCw, Scale } from 'lucide-react';
import { useCollaborators } from '@/hooks/useCollaborators';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  useBHTransactions,
  useInsertBHTransaction,
  useDeleteBHTransactionsBySemester,
  useInsertBHFolga,
  getSemesterStart,
  getSemesterOptions,
  getSemesterMonths,
  getSemesterLabel,
} from '@/hooks/useBancoHoras';
import { calculateJornada, type DayInfo } from '@/lib/jornadaEngine';
import { INTEGRATION_START_DATE } from '@/lib/constants';
import { getDaysInMonth, format } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import * as XLSX from 'xlsx';

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  auto_espelho: { label: 'Espelho', color: 'bg-muted text-muted-foreground' },
  folga_bh: { label: 'Folga BH', color: 'bg-blue-100 text-blue-700' },
  saldo_anterior: { label: 'Saldo Anterior', color: 'bg-green-100 text-green-700' },
  acerto_semestre: { label: 'Acerto', color: 'bg-orange-100 text-orange-700' },
  ajuste_manual: { label: 'Ajuste Manual', color: 'bg-yellow-100 text-yellow-700' },
};

function fmtMinToHHMM(min: number): string {
  const abs = Math.abs(min);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const sign = min < 0 ? '-' : (min > 0 ? '+' : '');
  return `${sign}${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function parseHHMM(str: string): number | null {
  const neg = str.startsWith('-');
  const clean = str.replace(/^[+-]/, '').trim();
  const match = clean.match(/^(\d{1,3}):(\d{2})$/);
  if (!match) return null;
  const mins = parseInt(match[1]) * 60 + parseInt(match[2]);
  return neg ? -mins : mins;
}

const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

export default function BancoHoras() {
  const now = new Date();
  const [semesterStart, setSemesterStart] = useState(getSemesterStart(now));
  const semesterOptions = useMemo(() => getSemesterOptions(), []);
  const semesterMonths = useMemo(() => getSemesterMonths(semesterStart), [semesterStart]);

  const { data: collaborators = [] } = useCollaborators();
  const { data: allTransactions = [], isLoading } = useBHTransactions(semesterStart);
  const insertTx = useInsertBHTransaction();
  const deleteTx = useDeleteBHTransactionsBySemester();
  const insertFolga = useInsertBHFolga();
  const { usuario, session } = useAuth();
  const isAdmin = usuario?.perfil === 'admin';

  const [sortBy, setSortBy] = useState<'name' | 'saldo'>('name');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [selectedCollabId, setSelectedCollabId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Action modals
  const [folgaOpen, setFolgaOpen] = useState(false);
  const [saldoAnteriorOpen, setSaldoAnteriorOpen] = useState(false);
  const [ajusteOpen, setAjusteOpen] = useState(false);
  const [acertoOpen, setAcertoOpen] = useState(false);

  // Form states
  const [formCollabId, setFormCollabId] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formValue, setFormValue] = useState('');
  const [formReason, setFormReason] = useState('');
  const [formType, setFormType] = useState<'credito' | 'debito'>('credito');

  // Acerto semestre state
  const [acertoActions, setAcertoActions] = useState<Record<string, 'pagar' | 'descontar' | 'transferir'>>({});

  const activeCollabs = useMemo(
    () => collaborators.filter(c => c.status !== 'DESLIGADO'),
    [collaborators]
  );

  const sectors = useMemo(
    () => [...new Set(activeCollabs.map(c => c.sector))].sort(),
    [activeCollabs]
  );

  // Calculate balances per collaborator
  const collabBalances = useMemo(() => {
    const map = new Map<string, { credit: number; debit: number; balance: number }>();
    for (const c of activeCollabs) {
      map.set(c.id, { credit: 0, debit: 0, balance: 0 });
    }
    for (const tx of allTransactions) {
      const entry = map.get(tx.collaborator_id);
      if (entry) {
        entry.credit += tx.credit_minutes;
        entry.debit += tx.debit_minutes;
        entry.balance += tx.credit_minutes - tx.debit_minutes;
      }
    }
    return map;
  }, [activeCollabs, allTransactions]);

  const filteredCollabs = useMemo(() => {
    let list = activeCollabs;
    if (sectorFilter !== 'all') list = list.filter(c => c.sector === sectorFilter);
    if (sortBy === 'name') list = [...list].sort((a, b) => a.collaborator_name.localeCompare(b.collaborator_name));
    else list = [...list].sort((a, b) => (collabBalances.get(a.id)?.balance ?? 0) - (collabBalances.get(b.id)?.balance ?? 0));
    return list;
  }, [activeCollabs, sectorFilter, sortBy, collabBalances]);

  // Summary cards
  const summary = useMemo(() => {
    let positive = 0, negative = 0, totalPos = 0, totalNeg = 0, over20 = 0, under20 = 0;
    for (const c of activeCollabs) {
      const bal = collabBalances.get(c.id)?.balance ?? 0;
      if (bal > 0) { positive++; totalPos += bal; }
      if (bal < 0) { negative++; totalNeg += bal; }
      if (bal > 20 * 60) over20++;
      if (bal < -20 * 60) under20++;
    }
    return { total: activeCollabs.length, positive, negative, totalPos, totalNeg, over20, under20 };
  }, [activeCollabs, collabBalances]);

  // Extrato for selected collaborator
  const selectedCollab = activeCollabs.find(c => c.id === selectedCollabId);
  const selectedTransactions = useMemo(
    () => allTransactions.filter(tx => tx.collaborator_id === selectedCollabId).sort((a, b) => a.transaction_date.localeCompare(b.transaction_date) || a.created_at.localeCompare(b.created_at)),
    [allTransactions, selectedCollabId]
  );

  // Chart data for extrato
  const chartData = useMemo(() => {
    let running = 0;
    return selectedTransactions.map(tx => {
      running += tx.credit_minutes - tx.debit_minutes;
      return {
        date: new Date(tx.transaction_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        saldo: Math.round(running / 60 * 100) / 100,
      };
    });
  }, [selectedTransactions]);

  // Check if we're in the last month of the semester (May or November)
  const isLastMonthOfSemester = useMemo(() => {
    const currentMonth = now.getMonth(); // 0-indexed
    return currentMonth === 4 || currentMonth === 10; // May (4) or November (10)
  }, []);

  // Pre-fill CH diária when selecting collaborator in folga modal
  const handleFolgaCollabChange = useCallback((id: string) => {
    setFormCollabId(id);
    const collab = activeCollabs.find(c => c.id === id);
    if (collab?.carga_horaria_diaria) {
      setFormValue(collab.carga_horaria_diaria);
    }
  }, [activeCollabs]);

  // ── Sincronizar com Espelho ──
  const handleSyncEspelho = useCallback(async () => {
    if (!session) return;
    setSyncing(true);
    try {
      // Helper: same overnight adjustment as Espelho's calcHours
      const toMin = (t: string) => { const [hh, mm] = t.split(':').map(Number); return hh * 60 + mm; };
      const adj = (timeMin: number, refMin: number) => (timeMin < 180 && refMin > timeMin) ? timeMin + 1440 : timeMin;

      const calcHoursSync = (entrada: string | null, saida: string | null, saidaInt: string | null, retornoInt: string | null): number | null => {
        if (!entrada || !saida) return null;
        const entradaMin = toMin(entrada);
        let saidaMin = adj(toMin(saida), entradaMin);
        let total = saidaMin - entradaMin;
        if (saidaInt && retornoInt) {
          const siMin = toMin(saidaInt);
          total -= (adj(toMin(retornoInt), siMin) - siMin);
        }
        return total > 0 ? total : 0;
      };

      const WEEKDAY_NAME_MAP: Record<number, string> = { 0: 'domingo', 1: 'segunda', 2: 'terca', 3: 'quarta', 4: 'quinta', 5: 'sexta', 6: 'sabado' };

      let syncedCount = 0;
      for (const sm of semesterMonths) {
        const monthIdx = sm.month - 1;
        const year = sm.year;
        const daysCount = getDaysInMonth(new Date(year, monthIdx));
        const startDate = format(new Date(year, monthIdx, 1), 'yyyy-MM-dd');
        const endDate = format(new Date(year, monthIdx, daysCount), 'yyyy-MM-dd');

        // Fetch punch records for this month
        const { data: punches } = await supabase
          .from('punch_records')
          .select('*')
          .gte('date', startDate)
          .lte('date', endDate);

        if (!punches || punches.length === 0) continue;

        // Fetch schedule events for this month
        const { data: events } = await supabase
          .from('schedule_events')
          .select('*')
          .gte('event_date', startDate)
          .lte('event_date', endDate)
          .eq('status', 'ATIVO');

        // Fetch vacations
        const { data: vacations } = await supabase
          .from('scheduled_vacations')
          .select('*')
          .lte('data_inicio_ferias', endDate)
          .gte('data_fim_ferias', startDate);

        // Fetch afastamentos
        const { data: afastamentos } = await supabase
          .from('afastamentos')
          .select('*')
          .lte('data_inicio', endDate)
          .gte('data_fim', startDate);

        // Fetch holidays
        const { data: holidays } = await supabase
          .from('holidays')
          .select('date')
          .gte('date', startDate)
          .lte('date', endDate);
        const holidaySet = new Set((holidays ?? []).map(h => h.date));

        // Fetch folgas BH
        const { data: folgasBH } = await supabase
          .from('bank_hours_folgas')
          .select('collaborator_id, folga_date')
          .gte('folga_date', startDate)
          .lte('folga_date', endDate);
        const folgaBHSet = new Set((folgasBH ?? []).map(f => `${f.collaborator_id}|${f.folga_date}`));

        // Build swap overrides AND events map (per date per collaborator)
        const swapOverrides: Record<string, Record<string, { removeDays: string[]; addDays: (string | null)[] }>> = {};
        const eventsMap: Record<string, Record<string, any[]>> = {};
        for (const ev of events ?? []) {
          // Swap overrides
          if (['TROCA_FOLGA', 'MUDANCA_FOLGA'].includes(ev.event_type)) {
            const ws = ev.week_start ?? ev.event_date;
            if (!swapOverrides[ev.collaborator_id]) swapOverrides[ev.collaborator_id] = {};
            if (!swapOverrides[ev.collaborator_id][ws]) swapOverrides[ev.collaborator_id][ws] = { removeDays: [], addDays: [] };
            const entry = swapOverrides[ev.collaborator_id][ws];
            if (ev.original_day) entry.removeDays.push(ev.original_day.toLowerCase());
            if (ev.swapped_day) entry.addDays.push(ev.swapped_day.toLowerCase());
          }
          // Events map for ATESTADO, COMPENSACAO, FALTA
          const dateKey = ev.event_date;
          if (!eventsMap[dateKey]) eventsMap[dateKey] = {};
          if (!eventsMap[dateKey][ev.collaborator_id]) eventsMap[dateKey][ev.collaborator_id] = [];
          eventsMap[dateKey][ev.collaborator_id].push(ev);
        }

        // Determine last punch update date for this month
        const lastPunchDate = punches.reduce((max, p) => {
          if (p.entrada && p.date > max) return p.date;
          return max;
        }, '');

        // Process each collaborator
        for (const collab of activeCollabs) {
          if (!collab.controla_ponto) continue;

          const collabPunches = punches.filter(p => p.collaborator_id === collab.id);
          if (collabPunches.length === 0) continue;

          const punchMap: Record<string, typeof collabPunches[0]> = {};
          for (const p of collabPunches) punchMap[p.date] = p;

          const defaultFolgas = (collab.folgas_semanais ?? []).map(f => f.toLowerCase());
          const chDiariaStr = collab.carga_horaria_diaria;
          const defaultChMin = chDiariaStr ? (() => {
            const parts = chDiariaStr.split(':');
            return parts.length === 2 ? parseInt(parts[0]) * 60 + parseInt(parts[1]) : null;
          })() : null;

          const avisoReducao = (collab.status === 'AVISO_PREVIO' && collab.aviso_previo_reducao === 2) ? 120 : 0;
          const jornadas = collab.jornadas_especiais as any[] | null;

          const dayInfos: DayInfo[] = [];
          for (let d = 1; d <= daysCount; d++) {
            const dt = new Date(year, monthIdx, d);
            const iso = format(dt, 'yyyy-MM-dd');
            const wd = WEEKDAYS[dt.getDay()];
            const wdNorm = WEEKDAY_NAME_MAP[dt.getDay()];

            // Skip days before integration start or after last punch
            if (iso < INTEGRATION_START_DATE || iso > lastPunchDate) continue;

            const punch = punchMap[iso];
            const isHoliday = holidaySet.has(iso);
            const isFolgaBH = folgaBHSet.has(`${collab.id}|${iso}`);

            // Check event types (same as Espelho)
            const dayEvents = eventsMap[iso]?.[collab.id] ?? [];
            const isAtestado = dayEvents.some((e: any) => e.event_type === 'ATESTADO' && e.status === 'ATIVO');
            const isCompensacao = dayEvents.some((e: any) => e.event_type === 'COMPENSACAO' && e.status === 'ATIVO');

            // Determine folga for this day
            const getWeekMonday = (date: Date): string => {
              const d2 = new Date(date);
              const day = d2.getDay();
              const diff = d2.getDate() - day + (day === 0 ? -6 : 1);
              d2.setDate(diff);
              return format(d2, 'yyyy-MM-dd');
            };
            const ws = getWeekMonday(dt);
            const override = swapOverrides[collab.id]?.[ws];
            let isFolga = defaultFolgas.includes(wd);
            // sunday_n logic (same as Espelho)
            if (!isFolga && collab.sunday_n > 0 && dt.getDay() === 0) {
              let sundayCount = 0;
              for (let day = 1; day <= d; day++) {
                if (new Date(year, monthIdx, day).getDay() === 0) sundayCount++;
              }
              if (sundayCount === collab.sunday_n) isFolga = true;
            }
            if (override) {
              if (override.removeDays.includes(wd)) isFolga = false;
              if (override.addDays.some(ad => ad?.toLowerCase() === wd)) isFolga = true;
            }

            // Check vacations
            const isVacation = (vacations ?? []).some(v =>
              v.collaborator_id === collab.id && iso >= v.data_inicio_ferias && iso <= v.data_fim_ferias
            );

            // Check afastamentos
            const isAfastamento = (afastamentos ?? []).some(a =>
              a.collaborator_id === collab.id && iso >= a.data_inicio && iso <= a.data_fim
            );

            const emptyPunch = { entrada: null, saida: null, saidaInt: null, retornoInt: null };

            // Mark as folga if: folgaBH, vacation, afastamento, atestado, compensacao
            if (isFolgaBH || isVacation || isAfastamento || isAtestado || isCompensacao) {
              dayInfos.push({ date: iso, isFolga: true, isFuture: false, isVacation, isAfastamento: isAfastamento || isAtestado, isHoliday, hoursWorkedMin: null, punch: emptyPunch });
              continue;
            }

            if (isFolga) {
              dayInfos.push({ date: iso, isFolga: true, isFuture: false, isVacation: false, isAfastamento: false, isHoliday, hoursWorkedMin: null, punch: emptyPunch });
              continue;
            }

            // ── Auto-interval inference (same as Espelho) ──
            let entrada = punch?.entrada ?? null;
            let saida = punch?.saida ?? null;
            let saidaInt = punch?.saida_intervalo ?? null;
            let retornoInt = punch?.retorno_intervalo ?? null;

            if (collab.intervalo_automatico && collab.intervalo_inicio && collab.intervalo_duracao) {
              const filledPunches = [entrada, saidaInt, retornoInt, saida].filter(Boolean) as string[];
              if (filledPunches.length === 2) {
                const osk = (t: string) => { const h = parseInt(t.split(':')[0]); return h < 3 ? parseInt(t.replace(':', '')) + 2400 : parseInt(t.replace(':', '')); };
                const sorted = [...filledPunches].sort((a, b) => osk(a) - osk(b));
                entrada = sorted[0]; saida = sorted[1];
                const intKey = osk(collab.intervalo_inicio!); const entKey = osk(entrada); const saiKey = osk(saida);
                if (intKey > entKey && intKey < saiKey) {
                  saidaInt = collab.intervalo_inicio!;
                  const [ih, im] = collab.intervalo_inicio!.split(':').map(Number);
                  const totalMin = ih * 60 + im + collab.intervalo_duracao!;
                  retornoInt = `${String(Math.floor(totalMin / 60) % 24).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
                }
              }
            }

            // Calculate hours (same as Espelho — with overnight handling)
            const hoursWorkedMin = calcHoursSync(entrada, saida, saidaInt, retornoInt);

            // Per-day CH override (jornadas_especiais + aviso_previo)
            let chForDay = defaultChMin ?? 420;
            if (jornadas && jornadas.length > 0) {
              const especial = jornadas.find((je: any) => je.dias?.includes(wdNorm));
              if (especial && especial.ch) {
                const [eh, em] = especial.ch.split(':').map(Number);
                chForDay = eh * 60 + (em || 0);
              }
            }
            if (avisoReducao > 0) {
              chForDay = Math.max(0, chForDay - avisoReducao);
            }

            dayInfos.push({
              date: iso,
              isFolga: false,
              isFuture: false,
              isVacation: false,
              isAfastamento: false,
              isHoliday,
              hoursWorkedMin,
              punch: { entrada, saida, saidaInt, retornoInt },
              chOverride: chForDay,
            });
          }

          if (dayInfos.length === 0) continue;

          const result = calculateJornada(dayInfos, defaultChMin ?? 420, collab.genero ?? 'M');
          const saldoBH = result.totals.saldoBH;

          // Delete existing auto_espelho for this month and insert new
          await deleteTx.mutateAsync({
            collaborator_id: collab.id,
            semester_start: semesterStart,
            type: 'auto_espelho',
            reference_month: sm.month,
            reference_year: sm.year,
          });

          if (saldoBH !== 0) {
            const credit = saldoBH > 0 ? saldoBH : 0;
            const debit = saldoBH < 0 ? Math.abs(saldoBH) : 0;
            await insertTx.mutateAsync({
              collaborator_id: collab.id,
              semester_start: semesterStart,
              transaction_date: endDate,
              type: 'auto_espelho',
              description: `Saldo Espelho ${String(sm.month).padStart(2, '0')}/${sm.year}`,
              credit_minutes: credit,
              debit_minutes: debit,
              balance_after_minutes: 0,
              reference_month: sm.month,
              reference_year: sm.year,
              created_by: session.user.id,
            });
            syncedCount++;
          }
        }
      }
      toast.success(`Sincronização concluída — ${syncedCount} registros atualizados`);
    } catch (e: any) {
      toast.error(`Erro na sincronização: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  }, [session, semesterMonths, semesterStart, activeCollabs, deleteTx, insertTx]);

  const handleConcederFolga = useCallback(async () => {
    if (!formCollabId || !formDate || !formValue) return;
    const mins = parseHHMM(formValue);
    if (mins === null || mins <= 0) { toast.error('Valor inválido'); return; }
    const bal = collabBalances.get(formCollabId)?.balance ?? 0;
    if (bal < mins && !confirm(`Saldo insuficiente (atual: ${fmtMinToHHMM(bal)}). Deseja conceder mesmo assim?`)) return;
    try {
      await insertFolga.mutateAsync({
        collaborator_id: formCollabId,
        folga_date: formDate,
        hours_debited: mins,
        reason: formReason,
        created_by: session?.user.id ?? null,
      });
      await insertTx.mutateAsync({
        collaborator_id: formCollabId,
        semester_start: semesterStart,
        transaction_date: formDate,
        type: 'folga_bh',
        description: formReason || 'Folga BH concedida',
        credit_minutes: 0,
        debit_minutes: mins,
        balance_after_minutes: (bal - mins),
        reference_month: null,
        reference_year: null,
        created_by: session?.user.id ?? null,
      });
      toast.success('Folga BH concedida');
      setFolgaOpen(false);
      resetForm();
    } catch (e: any) { toast.error(e.message); }
  }, [formCollabId, formDate, formValue, formReason, semesterStart, session, collabBalances]);

  const handleSaldoAnterior = useCallback(async () => {
    if (!formCollabId || !formValue) return;
    const mins = parseHHMM(formValue);
    if (mins === null) { toast.error('Valor inválido. Use formato HH:MM ou -HH:MM'); return; }
    try {
      const credit = mins > 0 ? mins : 0;
      const debit = mins < 0 ? Math.abs(mins) : 0;
      await insertTx.mutateAsync({
        collaborator_id: formCollabId,
        semester_start: semesterStart,
        transaction_date: semesterStart,
        type: 'saldo_anterior',
        description: formReason || 'Saldo transferido do semestre anterior',
        credit_minutes: credit,
        debit_minutes: debit,
        balance_after_minutes: mins,
        reference_month: null,
        reference_year: null,
        created_by: session?.user.id ?? null,
      });
      toast.success('Saldo anterior inserido');
      setSaldoAnteriorOpen(false);
      resetForm();
    } catch (e: any) { toast.error(e.message); }
  }, [formCollabId, formValue, formReason, semesterStart, session]);

  const handleAjusteManual = useCallback(async () => {
    if (!formCollabId || !formValue || !formReason) { toast.error('Preencha todos os campos obrigatórios'); return; }
    const mins = parseHHMM(formValue);
    if (mins === null || mins <= 0) { toast.error('Valor inválido'); return; }
    try {
      const credit = formType === 'credito' ? mins : 0;
      const debit = formType === 'debito' ? mins : 0;
      const bal = collabBalances.get(formCollabId)?.balance ?? 0;
      await insertTx.mutateAsync({
        collaborator_id: formCollabId,
        semester_start: semesterStart,
        transaction_date: new Date().toISOString().slice(0, 10),
        type: 'ajuste_manual',
        description: formReason,
        credit_minutes: credit,
        debit_minutes: debit,
        balance_after_minutes: bal + credit - debit,
        reference_month: null,
        reference_year: null,
        created_by: session?.user.id ?? null,
      });
      toast.success('Ajuste registrado');
      setAjusteOpen(false);
      resetForm();
    } catch (e: any) { toast.error(e.message); }
  }, [formCollabId, formValue, formReason, formType, semesterStart, session, collabBalances]);

  // Acertar Semestre
  const collabsWithBalance = useMemo(() => {
    return activeCollabs
      .map(c => ({ ...c, balance: collabBalances.get(c.id)?.balance ?? 0 }))
      .filter(c => c.balance !== 0)
      .sort((a, b) => a.collaborator_name.localeCompare(b.collaborator_name));
  }, [activeCollabs, collabBalances]);

  const handleOpenAcerto = useCallback(() => {
    const actions: Record<string, 'pagar' | 'descontar' | 'transferir'> = {};
    for (const c of collabsWithBalance) {
      actions[c.id] = 'transferir';
    }
    setAcertoActions(actions);
    setAcertoOpen(true);
  }, [collabsWithBalance]);

  const handleConfirmAcerto = useCallback(async () => {
    if (!session) return;
    try {
      const today = new Date().toISOString().slice(0, 10);
      // Calculate next semester start
      const semDate = new Date(semesterStart + 'T12:00:00');
      const nextSemStart = semDate.getMonth() === 11
        ? `${semDate.getFullYear() + 1}-06-01`
        : `${semDate.getFullYear()}-12-01`;

      for (const c of collabsWithBalance) {
        const action = acertoActions[c.id] || 'transferir';
        const bal = c.balance;

        // Insert acerto transaction
        await insertTx.mutateAsync({
          collaborator_id: c.id,
          semester_start: semesterStart,
          transaction_date: today,
          type: 'acerto_semestre',
          description: action === 'pagar' ? 'Acerto semestral — Pago' :
                       action === 'descontar' ? 'Acerto semestral — Descontado' :
                       'Acerto semestral — Transferido',
          credit_minutes: bal < 0 ? Math.abs(bal) : 0,
          debit_minutes: bal > 0 ? bal : 0,
          balance_after_minutes: 0,
          reference_month: null,
          reference_year: null,
          created_by: session.user.id,
        });

        // If transferring, create saldo_anterior in next semester
        if (action === 'transferir') {
          await insertTx.mutateAsync({
            collaborator_id: c.id,
            semester_start: nextSemStart,
            transaction_date: nextSemStart,
            type: 'saldo_anterior',
            description: `Saldo transferido do semestre anterior (${getSemesterLabel(semesterStart)})`,
            credit_minutes: bal > 0 ? bal : 0,
            debit_minutes: bal < 0 ? Math.abs(bal) : 0,
            balance_after_minutes: bal,
            reference_month: null,
            reference_year: null,
            created_by: session.user.id,
          });
        }
      }
      toast.success('Acerto semestral concluído');
      setAcertoOpen(false);
    } catch (e: any) { toast.error(e.message); }
  }, [session, collabsWithBalance, acertoActions, semesterStart, insertTx]);

  const resetForm = () => { setFormCollabId(''); setFormDate(''); setFormValue(''); setFormReason(''); setFormType('credito'); };

  const handleExport = useCallback(() => {
    const rows = filteredCollabs.map(c => {
      const b = collabBalances.get(c.id);
      return {
        Colaborador: c.collaborator_name,
        Setor: c.sector,
        'Créditos (min)': b?.credit ?? 0,
        'Débitos (min)': b?.debit ?? 0,
        'Saldo (min)': b?.balance ?? 0,
        'Saldo (HH:MM)': fmtMinToHHMM(b?.balance ?? 0),
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Banco de Horas');
    XLSX.writeFile(wb, `banco_horas_${semesterStart}.xlsx`);
  }, [filteredCollabs, collabBalances, semesterStart]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Banco de Horas</h1>
          <p className="text-sm text-muted-foreground mt-1">Controle de saldo de horas extras e compensações</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={semesterStart} onValueChange={setSemesterStart}>
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {semesterOptions.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1"><Users className="w-4 h-4 text-muted-foreground" /><span className="text-xs text-muted-foreground">Colaboradores</span></div>
          <p className="text-2xl font-bold">{summary.total}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-green-600" /><span className="text-xs text-muted-foreground">Saldo Positivo</span></div>
          <p className="text-2xl font-bold text-green-600">{summary.positive}</p>
          <p className="text-xs text-muted-foreground">{fmtMinToHHMM(summary.totalPos)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1"><TrendingDown className="w-4 h-4 text-red-600" /><span className="text-xs text-muted-foreground">Saldo Negativo</span></div>
          <p className="text-2xl font-bold text-red-600">{summary.negative}</p>
          <p className="text-xs text-muted-foreground">{fmtMinToHHMM(summary.totalNeg)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1"><AlertTriangle className="w-4 h-4 text-orange-500" /><span className="text-xs text-muted-foreground">{'>'}20h crédito</span></div>
          <p className="text-2xl font-bold text-orange-500">{summary.over20}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1"><AlertTriangle className="w-4 h-4 text-red-500" /><span className="text-xs text-muted-foreground">{'<'}-20h débito</span></div>
          <p className="text-2xl font-bold text-red-500">{summary.under20}</p>
        </CardContent></Card>
      </div>

      {/* Actions bar */}
      <div className="flex flex-wrap gap-2">
        {isAdmin && (
          <>
            <Button size="sm" variant="outline" onClick={() => { resetForm(); setFolgaOpen(true); }}>
              <Gift className="w-4 h-4 mr-1" /> Conceder Folga
            </Button>
            <Button size="sm" variant="outline" onClick={() => { resetForm(); setSaldoAnteriorOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" /> Saldo Anterior
            </Button>
            <Button size="sm" variant="outline" onClick={() => { resetForm(); setAjusteOpen(true); }}>
              <Pencil className="w-4 h-4 mr-1" /> Ajuste Manual
            </Button>
            <Button size="sm" variant="outline" onClick={handleOpenAcerto} disabled={!isLastMonthOfSemester}>
              <Scale className="w-4 h-4 mr-1" /> Acertar Semestre
            </Button>
            <Button size="sm" variant="outline" onClick={handleSyncEspelho} disabled={syncing}>
              <RefreshCw className={`w-4 h-4 mr-1 ${syncing ? 'animate-spin' : ''}`} /> {syncing ? 'Sincronizando...' : 'Sincronizar com Espelho'}
            </Button>
          </>
        )}
        <div className="flex-1" />
        <Select value={sectorFilter} onValueChange={setSectorFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Setor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os setores</SelectItem>
            {sectors.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={handleExport}>
          <Download className="w-4 h-4 mr-1" /> Excel
        </Button>
      </div>

      {/* Main table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer" onClick={() => setSortBy('name')}>
                  Colaborador {sortBy === 'name' && <ArrowUpDown className="w-3 h-3 inline ml-1" />}
                </TableHead>
                <TableHead>Setor</TableHead>
                <TableHead className="text-right">Créditos</TableHead>
                <TableHead className="text-right">Débitos</TableHead>
                <TableHead className="text-right cursor-pointer" onClick={() => setSortBy('saldo')}>
                  Saldo {sortBy === 'saldo' && <ArrowUpDown className="w-3 h-3 inline ml-1" />}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filteredCollabs.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum colaborador encontrado</TableCell></TableRow>
              ) : filteredCollabs.map(c => {
                const b = collabBalances.get(c.id);
                const bal = b?.balance ?? 0;
                const isWarning = bal < -20 * 60 || bal > 40 * 60;
                return (
                  <TableRow key={c.id} className={`cursor-pointer hover:bg-muted/50 ${isWarning ? 'bg-yellow-50' : ''}`} onClick={() => setSelectedCollabId(c.id)}>
                    <TableCell className="font-medium">{c.collaborator_name}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{c.sector}</Badge></TableCell>
                    <TableCell className="text-right text-green-600">{b?.credit ? fmtMinToHHMM(b.credit) : '—'}</TableCell>
                    <TableCell className="text-right text-red-600">{b?.debit ? fmtMinToHHMM(-b.debit) : '—'}</TableCell>
                    <TableCell className={`text-right font-semibold ${bal > 0 ? 'text-green-600' : bal < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                      {fmtMinToHHMM(bal)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Extrato modal */}
      <Dialog open={!!selectedCollabId} onOpenChange={(open) => { if (!open) setSelectedCollabId(null); }}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Extrato — {selectedCollab?.collaborator_name}</DialogTitle>
            <DialogDescription>{getSemesterLabel(semesterStart)}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {/* Line chart */}
            {chartData.length > 1 && (
              <div className="mb-4 h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                    <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" tickFormatter={(v) => `${v}h`} />
                    <Tooltip formatter={(v: number) => [`${v}h`, 'Saldo']} />
                    <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                    <Line type="monotone" dataKey="saldo" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {selectedTransactions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhuma movimentação no semestre</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Crédito</TableHead>
                    <TableHead className="text-right">Débito</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    let running = 0;
                    return selectedTransactions.map(tx => {
                      running += tx.credit_minutes - tx.debit_minutes;
                      const typeInfo = TYPE_LABELS[tx.type] || { label: tx.type, color: 'bg-muted text-muted-foreground' };
                      return (
                        <TableRow key={tx.id}>
                          <TableCell className="text-sm">{new Date(tx.transaction_date + 'T12:00:00').toLocaleDateString('pt-BR')}</TableCell>
                          <TableCell><Badge className={`${typeInfo.color} text-[10px]`}>{typeInfo.label}</Badge></TableCell>
                          <TableCell className="text-sm max-w-[200px] truncate">{tx.description}</TableCell>
                          <TableCell className="text-right text-green-600 text-sm">{tx.credit_minutes > 0 ? fmtMinToHHMM(tx.credit_minutes) : ''}</TableCell>
                          <TableCell className="text-right text-red-600 text-sm">{tx.debit_minutes > 0 ? fmtMinToHHMM(-tx.debit_minutes) : ''}</TableCell>
                          <TableCell className={`text-right font-semibold text-sm ${running > 0 ? 'text-green-600' : running < 0 ? 'text-red-600' : ''}`}>{fmtMinToHHMM(running)}</TableCell>
                        </TableRow>
                      );
                    });
                  })()}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Conceder Folga modal */}
      <Dialog open={folgaOpen} onOpenChange={setFolgaOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Conceder Folga BH</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Colaborador</Label>
              <Select value={formCollabId} onValueChange={handleFolgaCollabChange}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {activeCollabs.sort((a, b) => a.collaborator_name.localeCompare(b.collaborator_name)).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.collaborator_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formCollabId && <p className="text-xs text-muted-foreground mt-1">Saldo: {fmtMinToHHMM(collabBalances.get(formCollabId)?.balance ?? 0)}</p>}
            </div>
            <div><Label>Data da folga</Label><Input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} /></div>
            <div>
              <Label>Horas a debitar (HH:MM)</Label>
              <Input placeholder="05:00" value={formValue} onChange={e => setFormValue(e.target.value)} />
            </div>
            <div><Label>Motivo (opcional)</Label><Textarea value={formReason} onChange={e => setFormReason(e.target.value)} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolgaOpen(false)}>Cancelar</Button>
            <Button onClick={handleConcederFolga} disabled={insertTx.isPending}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Saldo Anterior modal */}
      <Dialog open={saldoAnteriorOpen} onOpenChange={setSaldoAnteriorOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Inserir Saldo Anterior</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Colaborador</Label>
              <Select value={formCollabId} onValueChange={setFormCollabId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {activeCollabs.sort((a, b) => a.collaborator_name.localeCompare(b.collaborator_name)).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.collaborator_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor (HH:MM — use -HH:MM para negativo)</Label>
              <Input placeholder="05:30 ou -02:00" value={formValue} onChange={e => setFormValue(e.target.value)} />
            </div>
            <div><Label>Descrição</Label><Textarea value={formReason} onChange={e => setFormReason(e.target.value)} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaldoAnteriorOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaldoAnterior} disabled={insertTx.isPending}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ajuste Manual modal */}
      <Dialog open={ajusteOpen} onOpenChange={setAjusteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ajuste Manual</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Colaborador</Label>
              <Select value={formCollabId} onValueChange={setFormCollabId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {activeCollabs.sort((a, b) => a.collaborator_name.localeCompare(b.collaborator_name)).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.collaborator_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={formType} onValueChange={(v: any) => setFormType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="credito">Crédito (+)</SelectItem>
                  <SelectItem value="debito">Débito (-)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor (HH:MM)</Label>
              <Input placeholder="02:30" value={formValue} onChange={e => setFormValue(e.target.value)} />
            </div>
            <div><Label>Motivo (obrigatório)</Label><Textarea value={formReason} onChange={e => setFormReason(e.target.value)} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAjusteOpen(false)}>Cancelar</Button>
            <Button onClick={handleAjusteManual} disabled={insertTx.isPending || !formReason}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Acertar Semestre modal */}
      <Dialog open={acertoOpen} onOpenChange={setAcertoOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Acertar Semestre — {getSemesterLabel(semesterStart)}</DialogTitle>
            <DialogDescription>Defina a ação para cada colaborador com saldo pendente</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[55vh]">
            {collabsWithBalance.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Todos os colaboradores estão com saldo zerado</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead>Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {collabsWithBalance.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.collaborator_name}</TableCell>
                      <TableCell className={`text-right font-semibold ${c.balance > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {fmtMinToHHMM(c.balance)}
                      </TableCell>
                      <TableCell>
                        <Select value={acertoActions[c.id] || 'transferir'} onValueChange={(v: any) => setAcertoActions(prev => ({ ...prev, [c.id]: v }))}>
                          <SelectTrigger className="w-[160px] h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {c.balance > 0 && <SelectItem value="pagar">💰 Pagar</SelectItem>}
                            {c.balance < 0 && <SelectItem value="descontar">📉 Descontar</SelectItem>}
                            <SelectItem value="transferir">➡️ Transferir</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAcertoOpen(false)}>Cancelar</Button>
            <Button onClick={handleConfirmAcerto} disabled={insertTx.isPending || collabsWithBalance.length === 0}>
              Confirmar Acerto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
