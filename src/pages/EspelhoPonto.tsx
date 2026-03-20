import { useState, useMemo, lazy, Suspense } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Download, FileText, Calendar, Clock, AlertCircle, CheckCircle2, ChevronDown, Fingerprint } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
const RegistroPonto = lazy(() => import('@/pages/RegistroPonto'));
import { format, getDaysInMonth, startOfMonth, addDays, getDay, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { useCollaborators } from '@/hooks/useCollaborators';
import { usePunchRecords } from '@/hooks/usePunchRecords';
import { useScheduleEvents } from '@/hooks/useScheduleEvents';
import { useScheduledVacations } from '@/hooks/useScheduledVacations';
import { useAfastamentos } from '@/hooks/useAfastamentos';
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
    // If time is between 00:00-02:59 and reference is in the afternoon/evening, add 24h
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

  const { data: collaborators = [] } = useCollaborators();
  const { data: punchRecords = [] } = usePunchRecords();
  const monthStart = format(new Date(selectedYear, selectedMonth, 1), 'yyyy-MM-dd');
  const monthEnd = format(new Date(selectedYear, selectedMonth, getDaysInMonth(new Date(selectedYear, selectedMonth)), ), 'yyyy-MM-dd');
  const { data: scheduleEvents = [] } = useScheduleEvents(monthStart, monthEnd);
  const { data: vacations = [] } = useScheduledVacations();
  const { data: afastamentos = [] } = useAfastamentos();
  const { data: holidays = [] } = useHolidays();

  const activeCollabs = useMemo(
    () => collaborators.filter(c => c.status !== 'DESLIGADO'),
    [collaborators]
  );

  const filteredCollabs = useMemo(() => {
    if (!searchName.trim()) return activeCollabs;
    const q = searchName.toLowerCase();
    return activeCollabs.filter(c => c.collaborator_name.toLowerCase().includes(q));
  }, [activeCollabs, searchName]);

  const selected = useMemo(
    () => collaborators.find(c => c.id === selectedCollaboratorId) ?? null,
    [collaborators, selectedCollaboratorId]
  );

  const daysInMonth = getDaysInMonth(new Date(selectedYear, selectedMonth));
  const holidaySet = useMemo(() => new Set(holidays.map(h => h.date)), [holidays]);
  const holidayNames = useMemo(() => {
    const m: Record<string, string> = {};
    holidays.forEach(h => { m[h.date] = h.name; });
    return m;
  }, [holidays]);

  type DayRow = {
    date: string;
    dateObj: Date;
    weekday: string;
    entrada: string | null;
    saidaInt: string | null;
    retornoInt: string | null;
    saida: string | null;
    hoursMin: number | null;
    status: string;
    statusEmoji: string;
  };

  const rows: DayRow[] = useMemo(() => {
    if (!selected) return [];

    // First, collect all punch records for this collaborator in the month
    const collabPunches = punchRecords.filter(p => p.collaborator_id === selected.id);
    
    // Build a map of punches by date for quick lookup
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

      // Detect shifted data: if entrada is 00:00-02:59 and saida_intervalo >= 12:00,
      // it means the entrada is actually the exit from previous day's shift.
      // The real punches for today are: entrada=saida_intervalo, saidaInt=retornoInt, retornoInt=saida, saida=?
      const entradaHour = entrada ? parseInt(entrada.split(':')[0]) : -1;
      const saidaIntHour = saidaInt ? parseInt(saidaInt.split(':')[0]) : -1;
      const isShifted = entradaHour >= 0 && entradaHour < 3 && saidaIntHour >= 12;

      if (isShifted) {
        // Rearrange: the 00:xx punch belongs to previous day, shift the rest
        const prevDayIso = format(addDays(dateObj, -1), 'yyyy-MM-dd');
        // Update previous day's row if it exists and has no proper saida after midnight
        const prevRow = result.find(r => r.date === prevDayIso);
        if (prevRow && prevRow.saida !== null) {
          // The previous day already has a saida (before midnight like 23:57),
          // but the real exit was the 00:xx punch. Use it if it gives more hours.
          const prevSaidaHour = parseInt(prevRow.saida.split(':')[0]);
          if (prevSaidaHour >= 20 && entradaHour < 3) {
            // Replace previous day's saida with the overnight punch
            prevRow.saida = entrada;
            prevRow.hoursMin = calcHours(prevRow.entrada, prevRow.saida, prevRow.saidaInt, prevRow.retornoInt);
          }
        }

        // Now rearrange this day's punches
        entrada = saidaInt;    // real entrada
        saidaInt = retornoInt; // real saida intervalo
        retornoInt = saida;    // real retorno intervalo
        saida = null;          // saida is unknown (after midnight, might be on next day)

        // Check if next day has a 00:xx entrada that could be today's saida
        const nextDayIso = format(addDays(dateObj, 1), 'yyyy-MM-dd');
        const nextPunch = punchMap.get(nextDayIso);
        if (nextPunch?.entrada) {
          const nextEntradaHour = parseInt(nextPunch.entrada.split(':')[0]);
          const nextSaidaIntHour = nextPunch.saida_intervalo ? parseInt(nextPunch.saida_intervalo.split(':')[0]) : -1;
          if (nextEntradaHour >= 0 && nextEntradaHour < 3 && nextSaidaIntHour >= 12) {
            saida = nextPunch.entrada; // next day's 00:xx is our exit
          }
        }
      }

      const hoursMin = calcHours(entrada, saida, saidaInt, retornoInt);

      // Status logic
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isFuture = dateObj >= today;

      let status = isFuture ? '—' : '❌ Falta';
      let statusEmoji = isFuture ? '—' : '❌';

      const isHoliday = holidaySet.has(iso);
      const isVacation = vacations.some(v =>
        v.collaborator_id === selected.id && iso >= v.data_inicio_ferias && iso <= v.data_fim_ferias
      );
      const isAfastamento = afastamentos.some(a =>
        a.collaborator_id === selected.id && iso >= a.data_inicio && iso <= a.data_fim
      );
      const isFolgaSemanal = selected.folgas_semanais?.includes(wd);
      const isFolgaEvent = scheduleEvents.some(e =>
        e.collaborator_id === selected.id && e.event_date === iso && (e.event_type === 'TROCA_FOLGA' || e.event_type === 'MUDANCA_FOLGA') && e.status === 'ATIVO'
      );

      if (isVacation) { status = '🌴 Férias'; statusEmoji = '🌴'; }
      else if (isAfastamento) { status = '🏥 Afastamento'; statusEmoji = '🏥'; }
      else if (isHoliday) { status = '🎉 Feriado'; statusEmoji = '🎉'; }
      else if (isFolgaSemanal || isFolgaEvent) { status = '🏖️ Folga'; statusEmoji = '🏖️'; }
      else if (entrada && saida) { status = '✅ Normal'; statusEmoji = '✅'; }
      else if (entrada && !saida) { status = '⚠️ Saída pendente'; statusEmoji = '⚠️'; }

      result.push({ date: iso, dateObj, weekday, entrada, saidaInt, retornoInt, saida, hoursMin, status, statusEmoji });
    }
    return result;
  }, [selected, selectedMonth, selectedYear, daysInMonth, punchRecords, scheduleEvents, vacations, afastamentos, holidaySet]);

  // Summary
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
    const data = rows.map(r => ({
      'Data': format(r.dateObj, 'dd/MM/yyyy'),
      'Dia': r.weekday,
      'Entrada': r.entrada ?? '',
      'Saída Int.': r.saidaInt ?? '',
      'Retorno Int.': r.retornoInt ?? '',
      'Saída': r.saida ?? '',
      'Horas Trab.': r.hoursMin != null ? formatMinutes(r.hoursMin) : '',
      'Status': r.status,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Espelho');
    const monthName = MONTHS[selectedMonth].label;
    XLSX.writeFile(wb, `espelho-${selected.collaborator_name}-${monthName}-${selectedYear}.xlsx`);
  };

  // Export PDF (print)
  const exportPDF = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      <PrintHeader title="Espelho de Ponto" subtitle={selected ? `${selected.collaborator_name} — ${selected.sector} — ${MONTHS[selectedMonth].label}/${selectedYear}` : undefined} />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold">Espelho de Ponto</h1>
          <p className="text-sm text-muted-foreground">Visualização mensal do espelho de ponto por colaborador</p>
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
        {/* Sidebar - collaborator list */}
        <div className="w-full md:w-64 shrink-0 print:hidden">
          <Card className="h-full">
            <CardContent className="p-3 space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar colaborador..."
                  value={searchName}
                  onChange={e => setSearchName(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>
              <div className="max-h-[calc(100vh-280px)] overflow-y-auto space-y-0.5">
                {filteredCollabs.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCollaboratorId(c.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedCollaboratorId === c.id
                        ? 'bg-primary text-primary-foreground font-medium'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <span className="block truncate">{c.collaborator_name}</span>
                    <span className={`text-[10px] ${selectedCollaboratorId === c.id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{c.sector}</span>
                  </button>
                ))}
                {filteredCollabs.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhum colaborador encontrado</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main content */}
        <div className="flex-1 space-y-4">
          {/* Month/Year selector */}
          <div className="flex items-center gap-2 print:hidden">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <Select value={String(selectedMonth)} onValueChange={v => setSelectedMonth(Number(v))}>
              <SelectTrigger className="w-36 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
              <SelectTrigger className="w-24 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
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
              <div className="grid grid-cols-3 gap-3">
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
              </div>

              {/* Print header for collaborator */}
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
                          <TableHead className="w-28">Data</TableHead>
                          <TableHead>Entrada</TableHead>
                          <TableHead>Saída Int.</TableHead>
                          <TableHead>Ret. Int.</TableHead>
                          <TableHead>Saída</TableHead>
                          <TableHead>Horas Trab.</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map(r => {
                          const isWeekend = [0, 6].includes(getDay(r.dateObj));
                          return (
                            <TableRow key={r.date} className={isWeekend ? 'bg-muted/30' : ''}>
                              <TableCell className="text-xs font-medium whitespace-nowrap tabular-nums">
                                {format(r.dateObj, 'dd/MM')} <span className="text-muted-foreground">{r.weekday}</span>
                              </TableCell>
                              <TableCell className="text-xs tabular-nums">{r.entrada ?? '—'}</TableCell>
                              <TableCell className="text-xs tabular-nums">{r.saidaInt ?? '—'}</TableCell>
                              <TableCell className="text-xs tabular-nums">{r.retornoInt ?? '—'}</TableCell>
                              <TableCell className="text-xs tabular-nums">{r.saida ?? '—'}</TableCell>
                              <TableCell className="text-xs tabular-nums font-medium">
                                {r.hoursMin != null ? formatMinutes(r.hoursMin) : '—'}
                              </TableCell>
                              <TableCell>
                                <span className="text-xs whitespace-nowrap">{r.status}</span>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
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
            <span className="flex items-center gap-2">
              <Fingerprint className="w-4 h-4" />
              Registro de Ponto
            </span>
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
    </div>
}
