import { useState, useMemo, useEffect, useCallback, lazy, Suspense } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Search, Download, FileText, Calendar, Clock, AlertCircle, CheckCircle2, ChevronDown, Fingerprint, Pencil, Plus, Wrench, Banknote, AlertTriangle } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { InlineTimeCell } from '@/components/ponto/InlineTimeCell';
const RegistroPonto = lazy(() => import('@/pages/RegistroPonto'));
import { format, getDaysInMonth, getDay } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { PunchAdjustmentDialog } from '@/components/ponto/PunchAdjustmentDialog';
import { ptBR } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { useCollaborators } from '@/hooks/useCollaborators';
import { usePunchRecords } from '@/hooks/usePunchRecords';
import { useScheduleEvents } from '@/hooks/useScheduleEvents';
import { useScheduledVacations } from '@/hooks/useScheduledVacations';
import { useAfastamentos } from '@/hooks/useAfastamentos';
import { useBankHoursBalance, useUpsertBankHoursBalance } from '@/hooks/useBankHoursBalance';
import { calculateJornada, fmtHHMM, fmtSaldo, type JornadaRow, type JornadaTotals } from '@/lib/jornadaEngine';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import type { Collaborator, DayOfWeek } from '@/types/collaborator';
import PrintHeader, { PrintFooter } from '@/components/PrintHeader';

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

export default function EspelhoPonto() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedCollaboratorId, setSelectedCollaboratorId] = useState<string | null>(null);
  const [searchName, setSearchName] = useState('');
  const { usuario } = useAuth();
  const canEdit = usuario?.perfil === 'admin' || usuario?.perfil === 'gestor';

  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [adjustmentRow, setAdjustmentRow] = useState<{
    date: string; dateObj: Date;
    entrada: string | null; saidaInt: string | null;
    retornoInt: string | null; saida: string | null;
  } | null>(null);

  const { data: collaborators = [] } = useCollaborators();
  const { data: punchRecords = [] } = usePunchRecords(selectedMonth, selectedYear);
  const monthStart = format(new Date(selectedYear, selectedMonth, 1), 'yyyy-MM-dd');
  const monthEnd = format(new Date(selectedYear, selectedMonth, getDaysInMonth(new Date(selectedYear, selectedMonth))), 'yyyy-MM-dd');
  const { data: scheduleEvents = [] } = useScheduleEvents(monthStart, monthEnd);
  const { data: vacations = [] } = useScheduledVacations();
  const { data: afastamentos = [] } = useAfastamentos();
  const { data: holidays = [] } = useHolidays();

  const selected = useMemo(
    () => collaborators.find(c => c.id === selectedCollaboratorId) ?? null,
    [collaborators, selectedCollaboratorId]
  );

  const { data: bankBalances = [] } = useBankHoursBalance(selectedCollaboratorId);
  const upsertBalance = useUpsertBankHoursBalance();

  const activeCollabs = useMemo(
    () => collaborators.filter(c => c.status !== 'DESLIGADO'),
    [collaborators]
  );

  const filteredCollabs = useMemo(() => {
    if (!searchName.trim()) return activeCollabs;
    const q = searchName.toLowerCase();
    return activeCollabs.filter(c => c.collaborator_name.toLowerCase().includes(q));
  }, [activeCollabs, searchName]);

  const daysInMonth = getDaysInMonth(new Date(selectedYear, selectedMonth));
  const holidaySet = useMemo(() => new Set(holidays.map(h => h.date)), [holidays]);

  type DayRow = {
    date: string; dateObj: Date; weekday: string;
    entrada: string | null; saidaInt: string | null; retornoInt: string | null; saida: string | null;
    hoursMin: number | null; status: string; statusEmoji: string; isAdjusted: boolean;
    isFolga: boolean; isVacation: boolean; isAfastamento: boolean; isHoliday: boolean; isFuture: boolean;
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

      // punch_records already stores dates with the 03:00 rule applied
      // (00:00-02:59 punches belong to previous day), so just look up directly
      const punch = punchMap.get(iso);
      const entrada = punch?.entrada ?? null;
      const saida = punch?.saida ?? null;
      const saidaInt = punch?.saida_intervalo ?? null;
      const retornoInt = punch?.retorno_intervalo ?? null;

      const hoursMin = calcHours(entrada, saida, saidaInt, retornoInt);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const isFuture = dateObj >= today;

      const isHoliday = holidaySet.has(iso);
      const isVacation = vacations.some(v => v.collaborator_id === selected.id && iso >= v.data_inicio_ferias && iso <= v.data_fim_ferias);
      const isAfastamento = afastamentos.some(a => a.collaborator_id === selected.id && iso >= a.data_inicio && iso <= a.data_fim);
      const isFolgaSemanal = selected.folgas_semanais?.includes(wd);
      let isFolgaDomingo = false;
      if (selected.sunday_n > 0 && getDay(dateObj) === 0) {
        let sundayCount = 0;
        for (let day = 1; day <= d; day++) {
          if (getDay(new Date(selectedYear, selectedMonth, day)) === 0) sundayCount++;
        }
        if (sundayCount === selected.sunday_n) isFolgaDomingo = true;
      }
      const isFolgaEvent = scheduleEvents.some(e =>
        e.collaborator_id === selected.id && e.event_date === iso && (e.event_type === 'TROCA_FOLGA' || e.event_type === 'MUDANCA_FOLGA') && e.status === 'ATIVO'
      );
      const isFolga = !!(isFolgaSemanal || isFolgaEvent || isFolgaDomingo);

      let status = isFuture ? '—' : '❌ Falta';
      let statusEmoji = isFuture ? '—' : '❌';
      if (isVacation) { status = '🌴 Férias'; statusEmoji = '🌴'; }
      else if (isAfastamento) { status = '🏥 Afastamento'; statusEmoji = '🏥'; }
      else if (isHoliday) { status = '🎉 Feriado'; statusEmoji = '🎉'; }
      else if (isFolga) { status = '🏖️ Folga'; statusEmoji = '🏖️'; }
      else if (entrada && saida) { status = '✅ Normal'; statusEmoji = '✅'; }
      else if (entrada && !saida) { status = '⚠️ Saída pendente'; statusEmoji = '⚠️'; }

      const isAdjusted = punch ? !!(punch as any).adjusted_at : false;
      result.push({ date: iso, dateObj, weekday, entrada, saidaInt, retornoInt, saida, hoursMin, status, statusEmoji, isAdjusted, isFolga, isVacation, isAfastamento, isHoliday, isFuture });
    }
    return result;
  }, [selected, selectedMonth, selectedYear, daysInMonth, punchRecords, scheduleEvents, vacations, afastamentos, holidaySet]);

  // Jornada calculations
  const { jornadaRows, jornadaTotals } = useMemo(() => {
    if (!selected || rows.length === 0) return { jornadaRows: [] as JornadaRow[], jornadaTotals: null };
    const dayInfos = rows.map(r => ({
      date: r.date,
      isFolga: r.isFolga,
      isVacation: r.isVacation,
      isAfastamento: r.isAfastamento,
      isHoliday: r.isHoliday,
      isFuture: r.isFuture,
      punch: { entrada: r.entrada, saida: r.saida, saidaInt: r.saidaInt, retornoInt: r.retornoInt },
      hoursWorkedMin: r.hoursMin,
    }));
    const result = calculateJornada(dayInfos, 423, selected.genero ?? 'M');
    return { jornadaRows: result.rows, jornadaTotals: result.totals };
  }, [rows, selected]);

  // Previous month accumulated balance
  const prevMonthBalance = useMemo(() => {
    if (!bankBalances.length) return 0;
    // Find the previous month's balance
    let prevMonth = selectedMonth - 1;
    let prevYear = selectedYear;
    if (prevMonth < 0) { prevMonth = 11; prevYear--; }
    const prev = bankBalances.find(b => b.month === prevMonth + 1 && b.year === prevYear);
    return prev?.accumulated_balance ?? 0;
  }, [bankBalances, selectedMonth, selectedYear]);

  const currentMonthSaldo = jornadaTotals?.saldoBH ?? 0;
  const accumulatedBalance = prevMonthBalance + currentMonthSaldo;

  // Save accumulated balance when totals change
  useEffect(() => {
    if (!selected || !jornadaTotals) return;
    upsertBalance.mutate({
      collaborator_id: selected.id,
      month: selectedMonth + 1,
      year: selectedYear,
      accumulated_balance: accumulatedBalance,
    });
  }, [selected?.id, selectedMonth, selectedYear, accumulatedBalance]);

  const totalWorked = rows.filter(r => r.status === '✅ Normal').length;
  const totalFaltas = rows.filter(r => r.status === '❌ Falta').length;
  const totalHoursMin = rows.reduce((acc, r) => acc + (r.hoursMin ?? 0), 0);

  const years = useMemo(() => {
    const y = now.getFullYear();
    return [y - 1, y, y + 1];
  }, []);

  // Export Excel
  const exportExcel = () => {
    if (!selected || rows.length === 0) return;
    const data = rows.map((r, i) => {
      const j = jornadaRows[i];
      return {
        'Data': format(r.dateObj, 'dd/MM/yyyy'),
        'Dia': r.weekday,
        'Entrada': r.entrada ?? '',
        'Saída Int.': r.saidaInt ?? '',
        'Retorno Int.': r.retornoInt ?? '',
        'Saída': r.saida ?? '',
        'Horas Trab.': r.hoursMin != null ? formatMinutes(r.hoursMin) : '',
        'Status': r.status,
        'CH Prevista': fmtHHMM(j?.chPrevista ?? null),
        'Normais': fmtHHMM(j?.normais ?? null),
        'Faltas': fmtHHMM(j?.faltas ?? null),
        'Atraso': fmtHHMM(j?.atraso ?? null),
        'Adiantamento': fmtHHMM(j?.adiantamento ?? null),
        'Extra BH': fmtHHMM(j?.extraBH ?? null),
        'Extra 100%': fmtHHMM(j?.extra100 ?? null),
        'Ad. Noturno': fmtHHMM(j?.adNoturno ?? null),
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

  const exportPDF = () => { window.print(); };

  const saldoMes = fmtSaldo(currentMonthSaldo);
  const saldoAcum = fmtSaldo(accumulatedBalance);

  return (
    <div className="space-y-4">
      <PrintHeader title="Espelho de Ponto" subtitle={selected ? `${selected.collaborator_name} — ${selected.sector} — ${MONTHS[selectedMonth].label}/${selectedYear}` : undefined} />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold">Espelho de Ponto</h1>
          <p className="text-sm text-muted-foreground">Gestão de jornada — visualização mensal por colaborador</p>
        </div>
        {selected && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportPDF}>
              <FileText className="w-4 h-4 mr-1" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={exportExcel}>
              <Download className="w-4 h-4 mr-1" /> Excel
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        {/* Sidebar */}
        <div className="w-full md:w-64 shrink-0 print:hidden">
          <Card className="h-full">
            <CardContent className="p-3 space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar colaborador..." value={searchName} onChange={e => setSearchName(e.target.value)} className="pl-9 h-9 text-sm" />
              </div>
              <div className="max-h-[calc(100vh-280px)] overflow-y-auto space-y-0.5">
                {filteredCollabs.map(c => (
                  <button key={c.id} onClick={() => setSelectedCollaboratorId(c.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedCollaboratorId === c.id ? 'bg-primary text-primary-foreground font-medium' : 'hover:bg-muted'}`}>
                    <span className="block truncate">{c.collaborator_name}</span>
                    <span className={`text-[10px] ${selectedCollaboratorId === c.id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{c.sector}</span>
                  </button>
                ))}
                {filteredCollabs.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhum colaborador encontrado</p>}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main content */}
        <div className="flex-1 space-y-4">
          <div className="flex items-center gap-2 print:hidden">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <Select value={String(selectedMonth)} onValueChange={v => setSelectedMonth(Number(v))}>
              <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{MONTHS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
              <SelectTrigger className="w-24 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {!selected ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Selecione um colaborador</p>
                <p className="text-xs mt-1">Escolha na lista ao lado para ver o espelho de ponto</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card>
                  <CardContent className="p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Dias Trabalhados</p>
                    <p className="text-xl font-bold tabular-nums">{totalWorked}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Faltas</p>
                    <p className="text-xl font-bold tabular-nums text-destructive">{totalFaltas}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Horas Totais</p>
                    <p className="text-xl font-bold tabular-nums">{formatMinutes(totalHoursMin)}</p>
                  </CardContent>
                </Card>
                <Card className="border-2 border-primary/20">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-1 mb-1">
                      <Banknote className="w-3.5 h-3.5 text-primary" />
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Banco de Horas</p>
                    </div>
                    <div className="flex items-baseline gap-3">
                      <div>
                        <p className="text-[9px] text-muted-foreground">Mês</p>
                        <p className={`text-lg font-bold tabular-nums ${saldoMes.className}`}>{saldoMes.text || '00:00'}</p>
                      </div>
                      <div className="border-l pl-3">
                        <p className="text-[9px] text-muted-foreground">Acumulado</p>
                        <p className={`text-lg font-bold tabular-nums ${saldoAcum.className}`}>{saldoAcum.text || '00:00'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Print header */}
              <div className="hidden print:!block mb-2">
                <p className="text-sm"><strong>{selected.collaborator_name}</strong> — {selected.sector}</p>
                <p className="text-xs text-muted-foreground">{MONTHS[selectedMonth].label} / {selectedYear} · Dias trabalhados: {totalWorked} · Faltas: {totalFaltas} · Horas: {formatMinutes(totalHoursMin)}</p>
              </div>

              {/* Main table */}
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-auto max-h-[calc(100vh-380px)] print:max-h-none">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-24 sticky left-0 bg-background z-10">Data</TableHead>
                          <TableHead>Entrada</TableHead>
                          <TableHead>Saída Int.</TableHead>
                          <TableHead>Ret. Int.</TableHead>
                          <TableHead>Saída</TableHead>
                          <TableHead>Horas</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-center">CH Prev.</TableHead>
                          <TableHead className="text-center">Normais</TableHead>
                          <TableHead className="text-center">Faltas</TableHead>
                          <TableHead className="text-center">Atraso</TableHead>
                          <TableHead className="text-center">Adiant.</TableHead>
                          <TableHead className="text-center">Extra BH</TableHead>
                          <TableHead className="text-center">Extra 100%</TableHead>
                          <TableHead className="text-center">Ad. Not.</TableHead>
                          <TableHead className="text-center">Not. 100%</TableHead>
                          <TableHead className="text-center">Saldo BH</TableHead>
                          {canEdit && <TableHead className="w-10 print:hidden"></TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((r, i) => {
                          const j = jornadaRows[i];
                          const isWeekend = [0, 6].includes(getDay(r.dateObj));
                          const isFalta = r.status === '❌ Falta';
                          const saldo = j ? fmtSaldo(j.saldoBH) : { text: '', className: '' };
                          return (
                            <TableRow key={r.date} className={isWeekend ? 'bg-muted/30' : ''}>
                              <TableCell className="text-xs font-medium whitespace-nowrap tabular-nums sticky left-0 bg-background z-10">
                                {format(r.dateObj, 'dd/MM')} <span className="text-muted-foreground">{r.weekday}</span>
                              </TableCell>
                              <TableCell className="text-xs tabular-nums">{r.entrada ?? '—'}</TableCell>
                              <TableCell className="text-xs tabular-nums">{r.saidaInt ?? '—'}</TableCell>
                              <TableCell className="text-xs tabular-nums">{r.retornoInt ?? '—'}</TableCell>
                              <TableCell className="text-xs tabular-nums">{r.saida ?? '—'}</TableCell>
                              <TableCell className="text-xs tabular-nums font-medium">{r.hoursMin != null ? formatMinutes(r.hoursMin) : '—'}</TableCell>
                              <TableCell>
                                <span className="text-xs whitespace-nowrap flex items-center gap-1">
                                  {r.status}
                                  {r.isAdjusted && <span title="Ajuste manual" className="text-muted-foreground"><Wrench className="w-3 h-3 inline" /></span>}
                                </span>
                              </TableCell>
                              <TableCell className="text-xs tabular-nums text-center">{fmtHHMM(j?.chPrevista ?? null)}</TableCell>
                              <TableCell className="text-xs tabular-nums text-center">{fmtHHMM(j?.normais ?? null)}</TableCell>
                              <TableCell className="text-xs tabular-nums text-center text-red-600">{fmtHHMM(j?.faltas ?? null)}</TableCell>
                              <TableCell className="text-xs tabular-nums text-center text-amber-600">{fmtHHMM(j?.atraso ?? null)}</TableCell>
                              <TableCell className="text-xs tabular-nums text-center text-blue-600">{fmtHHMM(j?.adiantamento ?? null)}</TableCell>
                              <TableCell className="text-xs tabular-nums text-center text-green-600">{fmtHHMM(j?.extraBH ?? null)}</TableCell>
                              <TableCell className="text-xs tabular-nums text-center text-purple-600">{fmtHHMM(j?.extra100 ?? null)}</TableCell>
                              <TableCell className="text-xs tabular-nums text-center text-indigo-600">{fmtHHMM(j?.adNoturno ?? null)}</TableCell>
                              <TableCell className="text-xs tabular-nums text-center text-indigo-600">{fmtHHMM(j?.not100 ?? null)}</TableCell>
                              <TableCell className={`text-xs tabular-nums text-center font-medium ${saldo.className}`}>{saldo.text}</TableCell>
                              {canEdit && (
                                <TableCell className="print:hidden">
                                  {isFalta ? (
                                    <button onClick={() => { setAdjustmentRow({ date: r.date, dateObj: r.dateObj, entrada: null, saidaInt: null, retornoInt: null, saida: null }); setAdjustmentOpen(true); }}
                                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Adicionar batida">
                                      <Plus className="w-3.5 h-3.5" />
                                    </button>
                                  ) : (
                                    <button onClick={() => { setAdjustmentRow({ date: r.date, dateObj: r.dateObj, entrada: r.entrada, saidaInt: r.saidaInt, retornoInt: r.retornoInt, saida: r.saida }); setAdjustmentOpen(true); }}
                                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Editar batida">
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                      {jornadaTotals && (
                        <TableFooter>
                          <TableRow className="font-semibold bg-muted/50">
                            <TableCell colSpan={7} className="text-xs text-right sticky left-0 bg-muted/50 z-10">TOTAIS</TableCell>
                            <TableCell className="text-xs tabular-nums text-center">{fmtHHMM(jornadaTotals.chPrevista)}</TableCell>
                            <TableCell className="text-xs tabular-nums text-center">{fmtHHMM(jornadaTotals.normais)}</TableCell>
                            <TableCell className="text-xs tabular-nums text-center text-red-600">{fmtHHMM(jornadaTotals.faltas)}</TableCell>
                            <TableCell className="text-xs tabular-nums text-center text-amber-600">{fmtHHMM(jornadaTotals.atraso)}</TableCell>
                            <TableCell className="text-xs tabular-nums text-center text-blue-600">{fmtHHMM(jornadaTotals.adiantamento)}</TableCell>
                            <TableCell className="text-xs tabular-nums text-center text-green-600">{fmtHHMM(jornadaTotals.extraBH)}</TableCell>
                            <TableCell className="text-xs tabular-nums text-center text-purple-600">{fmtHHMM(jornadaTotals.extra100)}</TableCell>
                            <TableCell className="text-xs tabular-nums text-center text-indigo-600">{fmtHHMM(jornadaTotals.adNoturno)}</TableCell>
                            <TableCell className="text-xs tabular-nums text-center text-indigo-600">{fmtHHMM(jornadaTotals.not100)}</TableCell>
                            <TableCell className={`text-xs tabular-nums text-center font-bold ${fmtSaldo(jornadaTotals.saldoBH).className}`}>{fmtSaldo(jornadaTotals.saldoBH).text}</TableCell>
                            {canEdit && <TableCell className="print:hidden" />}
                          </TableRow>
                        </TableFooter>
                      )}
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      {/* Registro de Ponto collapsible */}
      <Collapsible className="print:hidden">
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between gap-2">
            <span className="flex items-center gap-2"><Fingerprint className="w-4 h-4" />Registro de Ponto</span>
            <ChevronDown className="w-4 h-4 transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4">
          <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Carregando...</div>}>
            <RegistroPonto />
          </Suspense>
        </CollapsibleContent>
      </Collapsible>

      <PrintFooter />

      {selected && adjustmentRow && (
        <PunchAdjustmentDialog
          open={adjustmentOpen} onOpenChange={setAdjustmentOpen}
          collaboratorId={selected.id} collaboratorName={selected.collaborator_name}
          date={adjustmentRow.date} dateObj={adjustmentRow.dateObj}
          entrada={adjustmentRow.entrada} saidaInt={adjustmentRow.saidaInt}
          retornoInt={adjustmentRow.retornoInt} saida={adjustmentRow.saida}
        />
      )}
    </div>
  );
}
