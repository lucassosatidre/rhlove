import { useState, useMemo, useRef } from 'react';
import { useCollaborators } from '@/hooks/useCollaborators';
import { useFreelancers } from '@/hooks/useFreelancers';
import { useFreelancerEntries, useAddFreelancerEntry, useDeleteFreelancerEntry } from '@/hooks/useFreelancerEntries';
import { useDailySales, useUpsertDailySales } from '@/hooks/useDailySales';
import { useScheduledVacations } from '@/hooks/useScheduledVacations';
import { useAfastamentos } from '@/hooks/useAfastamentos';
import { useScheduleEvents, buildEventsMap, buildSwapOverrides, type ScheduleEvent } from '@/hooks/useScheduleEvents';
import { useHolidays } from '@/hooks/useHolidayCompensations';
import { usePunchRecords } from '@/hooks/usePunchRecords';
import { INTEGRATION_START_DATE } from '@/lib/constants';
import { generateSchedule, getMonthLabel, getFirstMondayOfMonthGrid, getWeekCount, getScheduledCollaboratorIdsBySectorOnDate, type ScheduleWeek } from '@/lib/scheduleEngine';
import { buildAbsentCollaboratorIdsByDate } from '@/lib/attendanceEvents';
import { DraftModeProvider, useDraftMode, type DraftSalesEntry } from '@/contexts/DraftModeContext';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, ChevronLeft, ChevronRight, Download, History, Printer, Users, X, PenLine, Trash2 } from 'lucide-react';
import FreesDialog from '@/components/FreesDialog';
import InlineFreelancerInput from '@/components/schedule/InlineFreelancerInput';
import EditableSalesCell from '@/components/schedule/EditableSalesCell';
import CollaboratorActionMenu from '@/components/schedule/CollaboratorActionMenu';
import ScheduleAdjustmentsHistoryDialog from '@/components/schedule/ScheduleAdjustmentsHistoryDialog';
import PrintHeader, { PrintFooter } from '@/components/PrintHeader';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const DAY_NAMES = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

function EscalaInner() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [compact, setCompact] = useState(false);
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg'>('sm');
  const [singleSectorMode, setSingleSectorMode] = useState(false);
  const [selectedSector, setSelectedSector] = useState('COZINHA');
  const [showPerformance, setShowPerformance] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(-1); // -1 = not yet initialized
  const [freesDialogOpen, setFreesDialogOpen] = useState(false);
  const [freesWeekIdx, setFreesWeekIdx] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { isDraft, setIsDraft, draftEvents, draftFreelancerEntries, addDraftFreelancer, removeDraftFreelancer, draftSales, upsertDraftSales, clearDraft } = useDraftMode();

  const { data: collaborators = [] } = useCollaborators();
  const { data: scheduledVacations = [] } = useScheduledVacations();
  const { data: afastamentos = [] } = useAfastamentos();
  const { data: holidays = [] } = useHolidays();
  const { data: punchRecords = [] } = usePunchRecords(month, year);

  // Fetch Folga BH records for displayed month range
  const { data: folgasBH = [] } = useQuery({
    queryKey: ['bank_hours_folgas_escala', month, year],
    queryFn: async () => {
      const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(new Date(year, month + 1, 0).getDate()).padStart(2, '0')}`;
      const { data, error } = await supabase
        .from('bank_hours_folgas')
        .select('collaborator_id, folga_date')
        .gte('folga_date', startDate)
        .lte('folga_date', endDate);
      if (error) throw error;
      return data as { collaborator_id: string; folga_date: string }[];
    },
  });

  const folgaBHSet = useMemo(() => {
    const set = new Set<string>();
    for (const f of folgasBH) set.add(`${f.collaborator_id}|${f.folga_date}`);
    return set;
  }, [folgasBH]);
  // Helper: get upcoming holiday warnings for a week start date (within 21 days)
  const getHolidayWarnings = (weekStartDate: Date) => {
    const warnings: { name: string; daysUntil: number }[] = [];
    const startTime = weekStartDate.getTime();
    for (const h of holidays) {
      const hDate = new Date(h.date + 'T00:00:00');
      const diff = Math.round((hDate.getTime() - startTime) / (1000 * 60 * 60 * 24));
      if (diff >= 0 && diff <= 21) {
        warnings.push({ name: h.name, daysUntil: diff });
      }
    }
    return warnings.sort((a, b) => a.daysUntil - b.daysUntil);
  };

  // Compute dateRange from year/month (independent of weeks)
  const dateRange = useMemo(() => {
    const firstMonday = getFirstMondayOfMonthGrid(year, month);
    const totalWeeks = getWeekCount(year, month);
    const last = new Date(firstMonday);
    last.setDate(firstMonday.getDate() + totalWeeks * 7 - 1);
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { start: fmt(firstMonday), end: fmt(last) };
  }, [year, month]);

  // Fetch data using dateRange
  const { data: freelancers = [] } = useFreelancers(dateRange.start, dateRange.end);
  const { data: freelancerEntries = [] } = useFreelancerEntries(dateRange.start, dateRange.end);
  const { data: salesData = [] } = useDailySales(dateRange.start, dateRange.end);
  const { data: scheduleEvents = [] } = useScheduleEvents(dateRange.start, dateRange.end);

  // Merge real events with draft events
  const allScheduleEvents = useMemo(
    () => isDraft ? [...scheduleEvents, ...draftEvents] : scheduleEvents,
    [scheduleEvents, draftEvents, isDraft]
  );

  // Build overrides from events BEFORE generating schedule
  const swapOverrides = useMemo(() => buildSwapOverrides(allScheduleEvents), [allScheduleEvents]);
  const eventsMap = useMemo(() => buildEventsMap(allScheduleEvents), [allScheduleEvents]);

  // Generate schedule WITH day-off overrides applied
  const weeks = useMemo(
    () => generateSchedule(collaborators, year, month, scheduledVacations, swapOverrides, afastamentos),
    [collaborators, year, month, scheduledVacations, swapOverrides, afastamentos]
  );

  // Auto-select the week containing today when weeks change
  const effectiveSelectedWeek = useMemo(() => {
    if (selectedWeek >= 0 && selectedWeek < weeks.length) return selectedWeek;
    if (weeks.length === 0) return 0;
    const today = new Date();
    const todayTime = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    for (let i = 0; i < weeks.length; i++) {
      const start = new Date(weeks[i].days[0].date.getFullYear(), weeks[i].days[0].date.getMonth(), weeks[i].days[0].date.getDate()).getTime();
      const end = new Date(weeks[i].days[6].date.getFullYear(), weeks[i].days[6].date.getMonth(), weeks[i].days[6].date.getDate()).getTime();
      if (todayTime >= start && todayTime <= end) return i;
    }
    return 0;
  }, [weeks, selectedWeek]);

  const absentCollaboratorIdsByDate = useMemo(
    () => buildAbsentCollaboratorIdsByDate(allScheduleEvents),
    [allScheduleEvents]
  );

  // Lookup: collaborator name → collaborator object
  const collabByName = useMemo(() => {
    const map: Record<string, typeof collaborators[0]> = {};
    for (const c of collaborators) {
      map[c.collaborator_name] = c;
    }
    return map;
  }, [collaborators]);

  // Punch records: build Set of "collabId|date" with punches and find lastPunchUpdateDate
  const { punchSet, lastPunchDate } = useMemo(() => {
    const set = new Set<string>();
    let maxDate = '';
    for (const p of punchRecords) {
      if (p.entrada) {
        set.add(`${p.collaborator_id}|${p.date}`);
        if (p.date > maxDate) maxDate = p.date;
      }
    }
    return { punchSet: set, lastPunchDate: maxDate || null };
  }, [punchRecords]);

  const addFreelancerEntry = useAddFreelancerEntry();
  const deleteFreelancerEntry = useDeleteFreelancerEntry();
  const upsertSales = useUpsertDailySales();

  // Build lookup maps
  const freelancerMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const f of freelancers) {
      map[`${f.date}|${f.sector}`] = f.quantity;
    }
    return map;
  }, [freelancers]);

  // Named freelancers by date|sector (merge draft)
  const freelancerEntriesMap = useMemo(() => {
    const map: Record<string, typeof freelancerEntries> = {};
    const allEntries = isDraft ? [...freelancerEntries, ...draftFreelancerEntries] : freelancerEntries;
    for (const fe of allEntries) {
      const key = `${fe.date}|${fe.sector}`;
      if (!map[key]) map[key] = [];
      map[key].push(fe as any);
    }
    return map;
  }, [freelancerEntries, draftFreelancerEntries, isDraft]);

  const salesMap = useMemo(() => {
    const map: Record<string, typeof salesData[0]> = {};
    for (const s of salesData) {
      map[s.date] = s;
    }
    // Overlay draft sales on top of real sales
    if (isDraft) {
      for (const [date, ds] of Object.entries(draftSales)) {
        map[date] = {
          id: `draft-sale-${date}`,
          date: ds.date,
          faturamento_total: ds.faturamento_total,
          pedidos_totais: ds.pedidos_totais,
          faturamento_salao: ds.faturamento_salao,
          pedidos_salao: ds.pedidos_salao,
          faturamento_tele: ds.faturamento_tele,
          pedidos_tele: ds.pedidos_tele,
          created_at: '',
          updated_at: '',
        };
      }
    }
    return map;
  }, [salesData, draftSales, isDraft]);

  const prevMonth = () => {
    setSelectedWeek(-1);
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    setSelectedWeek(-1);
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const textSize = fontSize === 'sm' ? 'text-xs' : fontSize === 'base' ? 'text-sm' : 'text-base';

  const handlePrint = () => window.print();

  const handleExport = () => {
    const wb = XLSX.utils.book_new();

    weeks.forEach((week, i) => {
      const rows: Record<string, string>[] = [];
      const allSectors = new Set<string>();
      week.days.forEach(d => Object.keys(d.collaboratorsBySector).forEach(s => allSectors.add(s)));

      for (const sector of ['COZINHA', 'SALÃO', 'TELE - ENTREGA', 'DIURNO'].filter(s => allSectors.has(s)).concat([...allSectors].filter(s => !['COZINHA', 'SALÃO', 'TELE - ENTREGA', 'DIURNO'].includes(s)).sort())) {
        rows.push({ '': `--- ${sector} ---` });
        const maxNames = Math.max(...week.days.map(d => (d.collaboratorsBySector[sector] || []).length), 0);
        for (let n = 0; n < maxNames; n++) {
          const row: Record<string, string> = {};
          week.days.forEach(d => {
            row[d.label] = (d.collaboratorsBySector[sector] || [])[n] || '';
          });
          rows.push(row);
        }
      }

      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, `Semana ${i + 1}`);
    });

    const allRows: Record<string, string>[] = [];
    weeks.forEach((week, i) => {
      allRows.push({ '': `=== SEMANA ${i + 1} ===` });
      const allSectors = new Set<string>();
      week.days.forEach(d => Object.keys(d.collaboratorsBySector).forEach(s => allSectors.add(s)));
      for (const sector of ['COZINHA', 'SALÃO', 'TELE - ENTREGA', 'DIURNO'].filter(s => allSectors.has(s)).concat([...allSectors].filter(s => !['COZINHA', 'SALÃO', 'TELE - ENTREGA', 'DIURNO'].includes(s)).sort())) {
        allRows.push({ '': `--- ${sector} ---` });
        const maxNames = Math.max(...week.days.map(d => (d.collaboratorsBySector[sector] || []).length), 0);
        for (let n = 0; n < maxNames; n++) {
          const row: Record<string, string> = {};
          week.days.forEach(d => {
            row[d.label] = (d.collaboratorsBySector[sector] || [])[n] || '';
          });
          allRows.push(row);
        }
      }
      allRows.push({ '': '' });
    });
    const wsAll = XLSX.utils.json_to_sheet(allRows);
    XLSX.utils.book_append_sheet(wb, wsAll, 'Consolidado');

    XLSX.writeFile(wb, `Escala_${MONTHS[month]}_${year}.xlsx`);
  };

  const isAlertName = (name: string) =>
    name.includes('(EXPERIÊNCIA VENCENDO)') || name.includes('(AVISO TERMINANDO)');

  const SECTOR_ORDER = ['COZINHA', 'SALÃO', 'TELE - ENTREGA', 'DIURNO'];

  const SECTOR_HEADER_CLASSES: Record<string, string> = {
    'COZINHA': 'bg-sector-cozinha text-white',
    'SALÃO': 'bg-sector-salao text-white',
    'TELE - ENTREGA': 'bg-sector-tele text-white',
    'DIURNO': 'bg-sector-diurno text-white',
  };

  const formatDateBR = (d: Date) =>
    `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

  const formatDateKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const getSectorSales = (sale: typeof salesData[0] | undefined, sector: string) => {
    if (!sale) return { vendas: 0, pedidos: 0 };
    const ft = Number(sale.faturamento_total) || 0;
    const pt = Number(sale.pedidos_totais) || 0;
    const fs = Number(sale.faturamento_salao) || 0;
    const ps = Number(sale.pedidos_salao) || 0;
    const fte = Number(sale.faturamento_tele) || 0;
    const pte = Number(sale.pedidos_tele) || 0;

    switch (sector) {
      case 'COZINHA': return { vendas: ft, pedidos: pt };
      case 'DIURNO': return { vendas: ft, pedidos: pt };
      case 'SALÃO': return { vendas: fs, pedidos: ps };
      case 'TELE - ENTREGA': return { vendas: fte, pedidos: pte };
      default: return { vendas: 0, pedidos: 0 };
    }
  };

  const formatNum = (v: number) =>
    v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleAddFreelancer = async (date: string, sector: string, name: string) => {
    if (isDraft) {
      addDraftFreelancer({ date, sector, name });
      toast({ title: `[Rascunho] ${name} (F) simulado` });
      return;
    }
    try {
      await addFreelancerEntry.mutateAsync({ date, sector, name });
      toast({ title: `${name} (F) adicionado` });
    } catch {
      toast({ title: 'Erro ao adicionar free-lancer', variant: 'destructive' });
    }
  };

  const handleRemoveFreelancer = async (id: string) => {
    if (isDraft && id.startsWith('draft-')) {
      removeDraftFreelancer(id);
      return;
    }
    if (isDraft) return; // Don't delete real entries in draft mode
    try {
      await deleteFreelancerEntry.mutateAsync(id);
    } catch {
      toast({ title: 'Erro ao remover free-lancer', variant: 'destructive' });
    }
  };

  const handleSaveSales = async (dateKey: string, sector: string, field: 'vendas' | 'pedidos', value: number) => {
    if (isDraft) {
      // Build a draft sales entry merging existing real/draft data with new value
      const existingSale = salesMap[dateKey];
      const base: DraftSalesEntry = {
        date: dateKey,
        faturamento_total: existingSale ? Number(existingSale.faturamento_total) || 0 : 0,
        pedidos_totais: existingSale ? Number(existingSale.pedidos_totais) || 0 : 0,
        faturamento_salao: existingSale ? Number(existingSale.faturamento_salao) || 0 : 0,
        pedidos_salao: existingSale ? Number(existingSale.pedidos_salao) || 0 : 0,
        faturamento_tele: existingSale ? Number(existingSale.faturamento_tele) || 0 : 0,
        pedidos_tele: existingSale ? Number(existingSale.pedidos_tele) || 0 : 0,
      };

      if (field === 'vendas') {
        switch (sector) {
          case 'COZINHA': case 'DIURNO': base.faturamento_total = value; break;
          case 'SALÃO': base.faturamento_salao = value; break;
          case 'TELE - ENTREGA': base.faturamento_tele = value; break;
        }
      } else {
        switch (sector) {
          case 'COZINHA': case 'DIURNO': base.pedidos_totais = value; break;
          case 'SALÃO': base.pedidos_salao = value; break;
          case 'TELE - ENTREGA': base.pedidos_tele = value; break;
        }
      }

      upsertDraftSales(base);
      toast({ title: '[Rascunho] Dados de vendas simulados' });
      return;
    }
    const existingSale = salesMap[dateKey];

    const input: any = {
      date: dateKey,
      faturamento_total: existingSale ? Number(existingSale.faturamento_total) || 0 : 0,
      pedidos_totais: existingSale ? Number(existingSale.pedidos_totais) || 0 : 0,
      faturamento_salao: existingSale ? Number(existingSale.faturamento_salao) || 0 : 0,
      pedidos_salao: existingSale ? Number(existingSale.pedidos_salao) || 0 : 0,
      faturamento_tele: existingSale ? Number(existingSale.faturamento_tele) || 0 : 0,
      pedidos_tele: existingSale ? Number(existingSale.pedidos_tele) || 0 : 0,
    };

    if (field === 'vendas') {
      switch (sector) {
        case 'COZINHA':
        case 'DIURNO':
          input.faturamento_total = value;
          break;
        case 'SALÃO':
          input.faturamento_salao = value;
          break;
        case 'TELE - ENTREGA':
          input.faturamento_tele = value;
          break;
      }
    } else {
      switch (sector) {
        case 'COZINHA':
        case 'DIURNO':
          input.pedidos_totais = value;
          break;
        case 'SALÃO':
          input.pedidos_salao = value;
          break;
        case 'TELE - ENTREGA':
          input.pedidos_tele = value;
          break;
      }
    }

    try {
      await upsertSales.mutateAsync(input);
      toast({ title: 'Dados salvos' });
    } catch {
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    }
  };

  /** Get total frees count (quantity-based + named entries) */
  const getTotalFrees = (dateKey: string, sector: string): number => {
    const qtyFrees = freelancerMap[`${dateKey}|${sector}`] || 0;
    const namedFrees = (freelancerEntriesMap[`${dateKey}|${sector}`] || []).length;
    return qtyFrees + namedFrees;
  };

  const getPresentScheduledCount = (date: Date, sector: string): number => {
    const dateKey = formatDateKey(date);
    const absentIds = absentCollaboratorIdsByDate.get(dateKey);
    const collaboratorsBySector = getScheduledCollaboratorIdsBySectorOnDate(
      collaborators,
      date,
      scheduledVacations,
      swapOverrides,
      afastamentos
    );

    return (collaboratorsBySector[sector] || []).filter(id => !absentIds?.has(id)).length;
  };

  /** Count punch-confirmed faltas for a sector on a date (collaborators scheduled but no punch, no event justification) */
  const getPunchFaltaCount = (date: Date, sector: string): number => {
    const dateKey = formatDateKey(date);
    if (!lastPunchDate || dateKey < INTEGRATION_START_DATE || dateKey > lastPunchDate) return 0;
    const collaboratorsBySector = getScheduledCollaboratorIdsBySectorOnDate(
      collaborators, date, scheduledVacations, swapOverrides, afastamentos
    );
    const absentIds = absentCollaboratorIdsByDate.get(dateKey);
    const scheduledIds = (collaboratorsBySector[sector] || []).filter(id => !absentIds?.has(id));
    let count = 0;
    for (const id of scheduledIds) {
      const collab = collaborators.find(c => c.id === id);
      if (!collab || !collab.controla_ponto) continue;
      if (punchSet.has(`${id}|${dateKey}`)) continue;
      // Check schedule events for this collaborator on this date
      const collabEvents = eventsMap[dateKey]?.[id] || [];
      const hasFalta = collabEvents.some(e => e.event_type === 'FALTA');
      const hasAtestado = collabEvents.some(e => e.event_type === 'ATESTADO');
      const hasCompensacao = collabEvents.some(e => e.event_type === 'COMPENSACAO');
      if (!hasFalta && !hasAtestado && !hasCompensacao) count++;
    }
    return count;
  };

  const renderWeek = (week: ScheduleWeek) => {
    const allSectors = new Set<string>();
    week.days.forEach(d => Object.keys(d.collaboratorsBySector).forEach(s => allSectors.add(s)));
    const sortedSectors = SECTOR_ORDER.filter(s => allSectors.has(s));
    [...allSectors].sort().forEach(s => {
      if (!sortedSectors.includes(s)) sortedSectors.push(s);
    });
    const visibleSectors = singleSectorMode
      ? sortedSectors.filter(s => s === selectedSector)
      : sortedSectors;

    const firstDate = week.days[0]?.date;
    const lastDate = week.days[week.days.length - 1]?.date;

    return (
      <div className="space-y-4">
        {visibleSectors.map(sector => {
          const maxNames = Math.max(
            ...week.days.map(d => (d.collaboratorsBySector[sector] || []).length),
            0
          );
          if (maxNames === 0 && !singleSectorMode) return null;

          const sectorPeriod = firstDate && lastDate
            ? `${sector} ${formatDateBR(firstDate)} à ${formatDateBR(lastDate)}`
            : sector;

          // Get max named freelancers across days for this sector
          const maxNamedFrees = Math.max(
            ...week.days.map(d => {
              const dateKey = formatDateKey(d.date);
              return (freelancerEntriesMap[`${dateKey}|${sector}`] || []).length;
            }),
            0
          );

          return (
            <div key={sector} className="overflow-x-auto">
              <table className={`w-full border-collapse table-fixed ${textSize}`}>
                <thead>
                  <tr>
                    <th
                      colSpan={7}
                      className={`border border-border ${compact ? 'px-2 py-1' : 'px-3 py-2'} text-left font-bold uppercase tracking-wide ${SECTOR_HEADER_CLASSES[sector] || 'bg-secondary text-secondary-foreground'}`}
                    >
                      {sectorPeriod}
                    </th>
                  </tr>
                  <tr>
                    {week.days.map((d, i) => (
                      <th
                        key={i}
                        className={`border border-border px-2 ${compact ? 'py-1' : 'py-2'} text-center font-semibold bg-muted ${
                          i === 6 ? 'bg-accent text-accent-foreground' : ''
                        }`}
                        style={{ width: `${100 / 7}%` }}
                      >
                        {DAY_NAMES[i]} {formatDateBR(d.date)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Regular collaborators */}
                  {Array.from({ length: maxNames }, (_, idx) => (
                    <tr key={idx}>
                      {week.days.map((d, di) => {
                        const names = d.collaboratorsBySector[sector] || [];
                        const rawName = names[idx] || '';
                        // Strip alert suffixes to find collaborator
                        const cleanName = rawName.replace(/ \(EXPERIÊNCIA VENCENDO\)/, '').replace(/ \(AVISO TERMINANDO\)/, '');
                        const hasAlert = rawName ? isAlertName(rawName) : false;
                        const numbered = rawName ? `${idx + 1} - ${rawName}` : '';
                        
                        const dateKey = formatDateKey(d.date);
                        const collab = cleanName ? collabByName[cleanName] : null;
                        const collabEvents = collab ? (eventsMap[dateKey]?.[collab.id] || []) : [];
                        const hasFalta = collabEvents.some(e => e.event_type === 'FALTA');
                        const hasAtestado = collabEvents.some(e => e.event_type === 'ATESTADO');
                        const hasCompensacao = collabEvents.some(e => e.event_type === 'COMPENSACAO');
                        const hasTroca = collabEvents.some(e => e.event_type === 'TROCA_FOLGA' || e.event_type === 'MUDANCA_FOLGA' || e.event_type === 'TROCA_DOMINGO');

                        // Check confirmed absence from punch records
                        const isPunchFalta = collab && collab.controla_ponto && lastPunchDate && dateKey >= INTEGRATION_START_DATE && dateKey <= lastPunchDate && !punchSet.has(`${collab.id}|${dateKey}`) && !hasFalta && !hasAtestado && !hasCompensacao;

                        const cellClasses = [
                          'border border-border px-2 text-left',
                          compact ? 'py-0.5' : 'py-1',
                          di === 6 ? 'bg-accent/30' : '',
                          hasAlert ? 'bg-warning/20 font-semibold' : '',
                          (hasFalta || isPunchFalta) ? 'bg-destructive/10' : '',
                          hasAtestado ? 'bg-blue-50 dark:bg-blue-950/30' : '',
                          hasCompensacao ? 'bg-green-50 dark:bg-green-950/30' : '',
                          hasTroca ? 'bg-orange-50 dark:bg-orange-950/30' : '',
                        ].filter(Boolean).join(' ');

                        if (!rawName) {
                          return <td key={di} className={cellClasses} />;
                        }

                        const alertSuffix = rawName.includes('(EXPERIÊNCIA VENCENDO)') ? 'EXP. VENC.' : rawName.includes('(AVISO TERMINANDO)') ? 'AV. TERM.' : '';
                        const displayName = cleanName ? `${idx + 1} – ${cleanName}` : '';

                        const nameContent = (
                          <span className="flex items-center gap-1 overflow-hidden max-w-full">
                            <span className={`truncate min-w-0 ${(hasFalta || isPunchFalta) ? 'line-through text-destructive/70' : ''} ${hasAtestado ? 'text-blue-600 dark:text-blue-400' : ''} ${hasAlert ? 'text-amber-700 dark:text-amber-400' : ''}`}>
                              {displayName}
                            </span>
                            {alertSuffix && <Badge variant="outline" className="text-[8px] px-1 py-0 h-4 shrink-0 border-amber-500 text-amber-700 dark:text-amber-400 whitespace-nowrap">{alertSuffix}</Badge>}
                            {hasFalta && <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4 shrink-0">faltou</Badge>}
                            {isPunchFalta && <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4 shrink-0">FALTA</Badge>}
                            {hasAtestado && <Badge className="text-[9px] px-1 py-0 h-4 shrink-0 bg-blue-500 text-white">atestado</Badge>}
                            {hasCompensacao && <Badge className="text-[9px] px-1 py-0 h-4 shrink-0 bg-green-600 text-white">compensação</Badge>}
                            {hasTroca && <Badge className="text-[9px] px-1 py-0 h-4 shrink-0 bg-orange-500 text-white">ajuste</Badge>}
                          </span>
                        );

                        return (
                          <td key={di} className={cellClasses}>
                            {collab ? (
                              <CollaboratorActionMenu
                                collaboratorName={cleanName}
                                collaboratorId={collab.id}
                                date={d.date}
                                weekStart={week.startDate}
                                allCollaborators={collaborators}
                                sector={sector}
                              >
                                <button data-print-keep className="w-full text-left cursor-pointer hover:bg-accent/50 rounded px-0.5 -mx-0.5 transition-colors">
                                  {nameContent}
                                </button>
                              </CollaboratorActionMenu>
                            ) : nameContent}
                          </td>
                        );
                      })}
                    </tr>
                  ))}

                  {/* Named freelancers rows */}
                  {Array.from({ length: maxNamedFrees }, (_, idx) => (
                    <tr key={`free-${idx}`}>
                      {week.days.map((d, di) => {
                        const dateKey = formatDateKey(d.date);
                        const namedFrees = freelancerEntriesMap[`${dateKey}|${sector}`] || [];
                        const entry = namedFrees[idx];
                        const baseNames = d.collaboratorsBySector[sector] || [];
                        const num = baseNames.length + idx + 1;

                        return (
                          <td
                            key={di}
                            className={`border border-border px-2 ${compact ? 'py-0.5' : 'py-1'} text-left ${
                              di === 6 ? 'bg-accent/30' : ''
                            }`}
                          >
                            {entry ? (
                              <span className="text-primary/80 flex items-center gap-1 group">
                                <span>{num} - {entry.name} (F)</span>
                                <button
                                  onClick={() => handleRemoveFreelancer(entry.id)}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity no-print"
                                  title="Remover free-lancer"
                                >
                                  <X className="w-3 h-3 text-destructive" />
                                </button>
                              </span>
                            ) : ''}
                          </td>
                        );
                      })}
                    </tr>
                  ))}

                  {/* Inline add freelancer row */}
                  <tr className="no-print">
                    {week.days.map((d, di) => {
                      const dateKey = formatDateKey(d.date);
                      return (
                        <td
                          key={di}
                          className={`border border-border px-2 ${compact ? 'py-0' : 'py-0.5'} ${
                            di === 6 ? 'bg-accent/30' : ''
                          }`}
                        >
                          <InlineFreelancerInput
                            onAdd={(name) => handleAddFreelancer(dateKey, sector, name)}
                            compact={compact}
                            textSize={textSize}
                          />
                        </td>
                      );
                    })}
                  </tr>

                  {/* Performance summary rows */}
                  {showPerformance && (
                    <>
                      <tr>
                        {week.days.map((d, di) => {
                          const dateKey = formatDateKey(d.date);
                          const frees = getTotalFrees(dateKey, sector);
                          return (
                            <td key={di} className={`border border-border px-2 py-0.5 text-left text-[10px] text-muted-foreground ${di === 6 ? 'bg-accent/30' : ''}`}>
                              Frees: {frees}
                            </td>
                          );
                        })}
                      </tr>
                      <tr>
                        {week.days.map((d, di) => {
                          const dateKey = formatDateKey(d.date);
                          const scheduled = getPresentScheduledCount(d.date, sector);
                          const frees = getTotalFrees(dateKey, sector);
                          const faltas = getPunchFaltaCount(d.date, sector);
                          const total = scheduled + frees - faltas;
                          return (
                            <td key={di} className={`border border-border px-2 py-0.5 text-left text-[10px] text-muted-foreground ${di === 6 ? 'bg-accent/30' : ''}`}>
                              Total: {total}{faltas > 0 && <span className="text-destructive ml-1">({faltas} falta{faltas > 1 ? 's' : ''})</span>}
                            </td>
                          );
                        })}
                      </tr>
                      <tr>
                        {week.days.map((d, di) => {
                          const dateKey = formatDateKey(d.date);
                          const sale = salesMap[dateKey];
                          if (!sale) {
                            return <td key={di} className={`border border-border px-2 py-0.5 text-left text-[10px] text-muted-foreground ${di === 6 ? 'bg-accent/30' : ''}`}>Ticket/colab.: -</td>;
                          }
                          const scheduled = getPresentScheduledCount(d.date, sector);
                          const frees = getTotalFrees(dateKey, sector);
                          const faltas = getPunchFaltaCount(d.date, sector);
                          const total = scheduled + frees - faltas;
                          const { vendas } = getSectorSales(sale, sector);
                          const tmp = total > 0 ? vendas / total : 0;
                          return (
                             <td key={di} className={`border border-border px-2 py-0.5 text-left text-[10px] text-muted-foreground ${di === 6 ? 'bg-accent/30' : ''}`}>
                               Ticket/colab.: {tmp > 0 ? formatNum(tmp) : '-'}
                            </td>
                          );
                        })}
                      </tr>
                      <tr>
                        {week.days.map((d, di) => {
                          const dateKey = formatDateKey(d.date);
                          const sale = salesMap[dateKey];
                          if (!sale) {
                            return <td key={di} className={`border border-border px-2 py-0.5 text-left text-[10px] text-muted-foreground ${di === 6 ? 'bg-accent/30' : ''}`}>Pedidos/colab.: -</td>;
                          }
                          const scheduled = getPresentScheduledCount(d.date, sector);
                          const frees = getTotalFrees(dateKey, sector);
                          const faltas = getPunchFaltaCount(d.date, sector);
                          const total = scheduled + frees - faltas;
                          const { pedidos } = getSectorSales(sale, sector);
                          const ppp = total > 0 ? pedidos / total : 0;
                          return (
                            <td key={di} className={`border border-border px-2 py-0.5 text-left text-[10px] text-muted-foreground ${di === 6 ? 'bg-accent/30' : ''}`}>
                              Pedidos/colab.: {ppp > 0 ? formatNum(ppp) : '-'}
                            </td>
                          );
                        })}
                      </tr>
                      {/* Editable Total de vendas */}
                      <tr>
                        {week.days.map((d, di) => {
                          const dateKey = formatDateKey(d.date);
                          const sale = salesMap[dateKey];
                          const { vendas } = getSectorSales(sale, sector);
                          return (
                            <td key={di} className={`border border-border px-2 py-0.5 text-left text-[10px] text-muted-foreground ${di === 6 ? 'bg-accent/30' : ''}`}>
                              <EditableSalesCell
                                label="Total de vendas:"
                                value={sale ? vendas : null}
                                isCurrency
                                onSave={(v) => handleSaveSales(dateKey, sector, 'vendas', v)}
                              />
                            </td>
                          );
                        })}
                      </tr>
                      {/* Editable Total de pedidos */}
                      <tr>
                        {week.days.map((d, di) => {
                          const dateKey = formatDateKey(d.date);
                          const sale = salesMap[dateKey];
                          const { pedidos } = getSectorSales(sale, sector);
                          return (
                            <td key={di} className={`border border-border px-2 py-0.5 text-left text-[10px] text-muted-foreground ${di === 6 ? 'bg-accent/30' : ''}`}>
                              <EditableSalesCell
                                label="Total de pedidos:"
                                value={sale ? pedidos : null}
                                onSave={(v) => handleSaveSales(dateKey, sector, 'pedidos', Math.round(v))}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4 animate-fade-in" ref={printRef}>
      <PrintHeader
        title="ESCALA SEMANAL"
        subtitle={weeks[effectiveSelectedWeek] ? `Semana: ${formatDateBR(weeks[effectiveSelectedWeek].days[0].date)} a ${formatDateBR(weeks[effectiveSelectedWeek].days[6].date)}` : getMonthLabel(year, month)}
      />
      {isDraft && (
        <Card className="border-2 border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/30 no-print">
          <CardContent className="py-2 px-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PenLine className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                Modo Rascunho — alterações aqui NÃO são salvas no banco de dados
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={clearDraft} className="text-xs border-amber-400 text-amber-700 hover:bg-amber-100 dark:border-amber-600 dark:text-amber-400 dark:hover:bg-amber-900">
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Limpar rascunho
            </Button>
          </CardContent>
        </Card>
      )}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 no-print">
        <div>
          <h1 className="text-2xl font-bold">Escala de Trabalho</h1>
          <p className="text-sm text-muted-foreground capitalize">{getMonthLabel(year, month)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth}><ChevronLeft className="w-4 h-4" /></Button>
          <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
            <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[year - 1, year, year + 1].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={nextMonth}><ChevronRight className="w-4 h-4" /></Button>
        </div>
      </div>

      <Card className="no-print">
        <CardContent className="py-3 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Label className="text-xs">Compacto</Label>
            <Switch checked={compact} onCheckedChange={setCompact} />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs">Setor único</Label>
            <Switch checked={singleSectorMode} onCheckedChange={setSingleSectorMode} />
          </div>
          {singleSectorMode && (
            <Select value={selectedSector} onValueChange={setSelectedSector}>
              <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SECTOR_ORDER.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <div className="flex items-center gap-2">
            <Label className="text-xs flex items-center gap-1">
              <PenLine className="w-3.5 h-3.5" />
              Projetar Escala
            </Label>
            <Switch checked={isDraft} onCheckedChange={setIsDraft} />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs">Desempenho</Label>
            <Switch checked={showPerformance} onCheckedChange={setShowPerformance} />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs">Fonte</Label>
            <Select value={fontSize} onValueChange={v => setFontSize(v as any)}>
              <SelectTrigger className="w-20 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sm">P</SelectItem>
                <SelectItem value="base">M</SelectItem>
                <SelectItem value="lg">G</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)}>
              <History className="w-4 h-4 mr-1" /> Histórico de Trocas
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="w-4 h-4 mr-1" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-1" /> Imprimir
            </Button>
          </div>
        </CardContent>
      </Card>

      {collaborators.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum colaborador cadastrado. Vá em <strong>Colaboradores</strong> para adicionar.
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="week" className="w-full">
          <TabsList className="no-print">
            <TabsTrigger value="today">Hoje</TabsTrigger>
            <TabsTrigger value="week">Semana</TabsTrigger>
            <TabsTrigger value="4weeks">Visão Mensal</TabsTrigger>
            <TabsTrigger value="grid">Grade</TabsTrigger>
          </TabsList>

          <TabsContent value="today">
            {(() => {
              const today = new Date();
              const todayKey = formatDateKey(today);
              const todayDayName = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][today.getDay()];
              let todayData: typeof weeks[0]['days'][0] | null = null;
              for (const w of weeks) {
                for (const d of w.days) {
                  if (formatDateKey(d.date) === todayKey) { todayData = d; break; }
                }
                if (todayData) break;
              }

              if (!todayData) {
                return (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      O dia de hoje não está neste mês. Navegue para <strong>{MONTHS[today.getMonth()]}/{today.getFullYear()}</strong>.
                      <div className="mt-3">
                        <Button size="sm" onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); }}>
                          <CalendarDays className="w-4 h-4 mr-1" /> Ir para hoje
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              }

              const allSectors = Object.keys(todayData.collaboratorsBySector);
              const sortedSectors = SECTOR_ORDER.filter(s => allSectors.includes(s));
              allSectors.sort().forEach(s => { if (!sortedSectors.includes(s)) sortedSectors.push(s); });
              const visibleSectors = singleSectorMode
                ? sortedSectors.filter(s => s === selectedSector)
                : sortedSectors;

              return (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <CalendarDays className="w-4 h-4" />
                      {todayDayName}, {formatDateBR(today)} — Escalados Hoje
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 space-y-3">
                    {visibleSectors.map(sector => {
                      const names = todayData!.collaboratorsBySector[sector] || [];
                      const namedFrees = freelancerEntriesMap[`${todayKey}|${sector}`] || [];
                      if (names.length === 0 && namedFrees.length === 0) return null;
                      const dateKey = formatDateKey(today);
                      const frees = getTotalFrees(dateKey, sector);
                      return (
                        <div key={sector} className="overflow-x-auto">
                          <table className={`w-full border-collapse ${textSize}`}>
                            <thead>
                              <tr>
                                <th className={`border border-border px-3 py-2 text-left font-bold uppercase tracking-wide ${SECTOR_HEADER_CLASSES[sector] || 'bg-secondary text-secondary-foreground'}`}>
                                  {sector} — {names.length + namedFrees.length} colaborador{(names.length + namedFrees.length) !== 1 ? 'es' : ''}{frees > 0 ? ` (${namedFrees.length} free${namedFrees.length !== 1 ? 's' : ''})` : ''}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {names.map((rawName, idx) => {
                                const cleanName = rawName.replace(/ \(EXPERIÊNCIA VENCENDO\)/, '').replace(/ \(AVISO TERMINANDO\)/, '');
                                const hasAlert = isAlertName(rawName);
                                const collab = collabByName[cleanName];
                                const collabEvents = collab ? (eventsMap[todayKey]?.[collab.id] || []) : [];
                                const hasFalta = collabEvents.some(e => e.event_type === 'FALTA');
                                const hasAtestado = collabEvents.some(e => e.event_type === 'ATESTADO');
                                const hasCompensacao = collabEvents.some(e => e.event_type === 'COMPENSACAO');
                                const hasTroca = collabEvents.some(e => e.event_type === 'TROCA_FOLGA' || e.event_type === 'MUDANCA_FOLGA' || e.event_type === 'TROCA_DOMINGO');

                                // Find the week containing today
                                const todayWeek = weeks.find(w => w.days.some(dd => formatDateKey(dd.date) === todayKey));

                                const alertSuffix = rawName.includes('(EXPERIÊNCIA VENCENDO)') ? 'EXP. VENC.' : rawName.includes('(AVISO TERMINANDO)') ? 'AV. TERM.' : '';
                                const displayClean = `${idx + 1} – ${cleanName}`;

                                const nameContent = (
                                  <span className="flex items-center gap-1 overflow-hidden">
                                    <span className={`truncate min-w-0 ${hasFalta ? 'line-through text-destructive/70' : ''} ${hasAtestado ? 'text-blue-600 dark:text-blue-400' : ''} ${hasAlert ? 'text-amber-700 dark:text-amber-400' : ''}`}>
                                      {displayClean}
                                    </span>
                                    {alertSuffix && <Badge variant="outline" className="text-[8px] px-1 py-0 h-4 shrink-0 border-amber-500 text-amber-700 dark:text-amber-400">{alertSuffix}</Badge>}
                                    {hasFalta && <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4 shrink-0">faltou</Badge>}
                                    {hasAtestado && <Badge className="text-[9px] px-1 py-0 h-4 shrink-0 bg-blue-500 text-white">atestado</Badge>}
                                    {hasCompensacao && <Badge className="text-[9px] px-1 py-0 h-4 shrink-0 bg-green-600 text-white">compensação</Badge>}
                                    {hasTroca && <Badge className="text-[9px] px-1 py-0 h-4 shrink-0 bg-orange-500 text-white">ajuste</Badge>}
                                  </span>
                                );

                                return (
                                  <tr key={idx}>
                                    <td className={`border border-border px-3 py-1.5 ${hasAlert ? 'bg-warning/20 font-semibold' : ''} ${hasFalta ? 'bg-destructive/10' : ''} ${hasAtestado ? 'bg-blue-50 dark:bg-blue-950/30' : ''}`}>
                                      {collab && todayWeek ? (
                                        <CollaboratorActionMenu
                                          collaboratorName={cleanName}
                                          collaboratorId={collab.id}
                                          date={today}
                                          weekStart={todayWeek.startDate}
                                          allCollaborators={collaborators}
                                          sector={sector}
                                        >
                                          <button className="w-full text-left cursor-pointer hover:bg-accent/50 rounded px-0.5 -mx-0.5 transition-colors no-print">
                                            {nameContent}
                                          </button>
                                        </CollaboratorActionMenu>
                                      ) : nameContent}
                                    </td>
                                  </tr>
                                );
                              })}
                              {namedFrees.map((fe, idx) => (
                                <tr key={`free-${fe.id}`}>
                                  <td className="border border-border px-3 py-1.5">
                                    <span className="text-primary/80 flex items-center gap-2 group">
                                      <span>{names.length + idx + 1} - {fe.name} (F)</span>
                                      <button
                                        onClick={() => handleRemoveFreelancer(fe.id)}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity no-print"
                                        title="Remover free-lancer"
                                      >
                                        <X className="w-3 h-3 text-destructive" />
                                      </button>
                                    </span>
                                  </td>
                                </tr>
                              ))}
                              <tr className="no-print">
                                <td className="border border-border px-3 py-1">
                                  <InlineFreelancerInput
                                    onAdd={(name) => handleAddFreelancer(todayKey, sector, name)}
                                    compact={compact}
                                    textSize={textSize}
                                  />
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      );
                    })}
                    {visibleSectors.every(s => (todayData!.collaboratorsBySector[s] || []).length === 0) && (
                      <p className="text-center text-muted-foreground py-4">Nenhum colaborador escalado hoje.</p>
                    )}
                  </CardContent>
                </Card>
              );
            })()}
          </TabsContent>

          <TabsContent value="week">
            <div className="flex items-center gap-1.5 mb-3 no-print flex-wrap">
            {weeks.map((w, i) => {
                const wStart = w.days[0].date;
                const wEnd = w.days[w.days.length - 1].date;
                const warnings = getHolidayWarnings(wStart);
                const shortName = warnings.length > 0
                  ? warnings[0].name.length > 12 ? warnings[0].name.slice(0, 12) + '…' : warnings[0].name
                  : '';
                return (
                  <Button
                    key={i}
                    variant={effectiveSelectedWeek === i ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedWeek(i)}
                    className="h-8 px-2.5 text-xs flex items-center gap-1"
                    title={warnings.length > 0 ? `${warnings[0].name} em ${warnings[0].daysUntil} dias` : undefined}
                  >
                    {formatDateBR(wStart)}–{formatDateBR(wEnd)}
                    {warnings.length > 0 && (
                      <span className={`text-[9px] font-semibold whitespace-nowrap leading-none ${effectiveSelectedWeek === i ? 'text-yellow-200' : 'text-red-600'}`}>
                        ⚠️{shortName} {warnings[0].daysUntil}d
                      </span>
                    )}
                  </Button>
                );
              })}
            </div>
            {weeks[effectiveSelectedWeek] && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">
                    {formatDateBR(weeks[effectiveSelectedWeek].days[0].date)} - {formatDateBR(weeks[effectiveSelectedWeek].days[6].date)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-2">{renderWeek(weeks[effectiveSelectedWeek])}</CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="4weeks" className="space-y-4">
            {weeks.map((week, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{formatDateBR(week.days[0].date)} - {formatDateBR(week.days[6].date)}</CardTitle>
                </CardHeader>
                <CardContent className="p-2">{renderWeek(week)}</CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="grid">
            <div className={`grid grid-cols-1 lg:grid-cols-2 ${weeks.length > 4 ? 'xl:grid-cols-3' : ''} gap-4`}>
              {weeks.map((week, i) => (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs">{formatDateBR(week.days[0].date)} - {formatDateBR(week.days[6].date)}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-1">{renderWeek(week)}</CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      )}

      {weeks[freesWeekIdx] && (
        <FreesDialog
          open={freesDialogOpen}
          onOpenChange={setFreesDialogOpen}
          weekStartDate={weeks[freesWeekIdx].days[0].date}
          weekEndDate={weeks[freesWeekIdx].days[weeks[freesWeekIdx].days.length - 1].date}
        />
      )}

      <ScheduleAdjustmentsHistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} />
      <PrintFooter />
    </div>
  );
}

export default function Escala() {
  return (
    <DraftModeProvider>
      <EscalaInner />
    </DraftModeProvider>
  );
}
