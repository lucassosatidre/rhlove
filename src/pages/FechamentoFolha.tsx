import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { DropZone } from '@/components/ui/drop-zone';
import { Calendar, Upload, Play, Download, RefreshCw, AlertTriangle, CheckCircle, Users, FileText } from 'lucide-react';
import { format, getDaysInMonth, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { useCollaborators } from '@/hooks/useCollaborators';
import { usePunchRecords } from '@/hooks/usePunchRecords';
import { useScheduleEvents, buildSwapOverrides, buildEventsMap } from '@/hooks/useScheduleEvents';
import { useScheduledVacations } from '@/hooks/useScheduledVacations';
import { useAfastamentos } from '@/hooks/useAfastamentos';
import { useQuery } from '@tanstack/react-query';
import { calculateJornada, type JornadaTotals } from '@/lib/jornadaEngine';
import { useAuth } from '@/contexts/AuthContext';
import type { Collaborator, DayOfWeek } from '@/types/collaborator';

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i),
  label: format(new Date(2024, i, 1), 'MMMM', { locale: ptBR }).replace(/^\w/, c => c.toUpperCase()),
}));

const WEEKDAY_MAP: Record<number, DayOfWeek> = {
  0: 'DOMINGO', 1: 'SEGUNDA', 2: 'TERCA', 3: 'QUARTA', 4: 'QUINTA', 5: 'SEXTA', 6: 'SABADO',
};

// Alias map for name matching
const NAME_ALIASES: Record<string, string[]> = {
  'DINHO': ['JOEDILSON'],
  'JOEDILSON': ['DINHO'],
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

interface MatchedCollab {
  sheetName: string;
  sheetRow: number;
  collaborator: Collaborator | null;
  manualOverride?: string;
}

interface ProcessedData {
  collaboratorId: string;
  collaboratorName: string;
  sector: string;
  genero: string;
  extra100: number;
  not100: number;
  adNoturno: number;
  bonus10: number;
  vtDesconto: number;
  warnings: string[];
}

type Step = 'upload' | 'match' | 'review' | 'export';

export default function FechamentoFolha() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [step, setStep] = useState<Step>('upload');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [matches, setMatches] = useState<MatchedCollab[]>([]);
  const [processedData, setProcessedData] = useState<ProcessedData[]>([]);
  const [processing, setProcessing] = useState(false);
  const { usuario } = useAuth();

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

  const { data: existingClosing } = useQuery({
    queryKey: ['payroll_closing', selectedMonth, selectedYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payroll_closings' as any)
        .select('*')
        .eq('month', selectedMonth + 1)
        .eq('year', selectedYear)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const activeCollabs = useMemo(
    () => collaborators.filter(c => c.status !== 'DESLIGADO'),
    [collaborators]
  );

  const years = useMemo(() => { const y = now.getFullYear(); return [y - 1, y, y + 1]; }, []);

  const swapOverrides = useMemo(() => buildSwapOverrides(scheduleEvents), [scheduleEvents]);
  const eventsMap = useMemo(() => buildEventsMap(scheduleEvents), [scheduleEvents]);
  const holidaySet = useMemo(() => new Set(holidays.map(h => h.date)), [holidays]);
  const daysInMonth = getDaysInMonth(new Date(selectedYear, selectedMonth));

  // Match sheet name to collaborator
  const findCollaborator = useCallback((sheetName: string): Collaborator | null => {
    const normalized = sheetName.trim().toUpperCase();
    // Direct match
    let found = activeCollabs.find(c => c.collaborator_name.toUpperCase() === normalized);
    if (found) return found;
    // Partial match (sheet name contains collab name or vice versa)
    found = activeCollabs.find(c => normalized.includes(c.collaborator_name.toUpperCase()));
    if (found) return found;
    found = activeCollabs.find(c => c.collaborator_name.toUpperCase().includes(normalized));
    if (found) return found;
    // First name match
    const firstName = normalized.split(' ')[0];
    found = activeCollabs.find(c => c.collaborator_name.toUpperCase().split(' ')[0] === firstName);
    if (found) return found;
    // Alias match
    for (const [alias, names] of Object.entries(NAME_ALIASES)) {
      if (normalized.includes(alias)) {
        for (const name of names) {
          found = activeCollabs.find(c => c.collaborator_name.toUpperCase().includes(name));
          if (found) return found;
        }
      }
      for (const name of names) {
        if (normalized.includes(name)) {
          found = activeCollabs.find(c => c.collaborator_name.toUpperCase().includes(alias));
          if (found) return found;
        }
      }
    }
    return null;
  }, [activeCollabs]);

  // Handle file upload
  const handleFileUpload = useCallback((files: FileList) => {
    const file = files[0];
    if (!file) return;
    setUploadedFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<any>(sheet, { header: 1 });

        const matched: MatchedCollab[] = [];
        for (let i = 9; i < rows.length; i++) {
          const row = rows[i];
          if (!row) continue;
          const colA = String(row[0] ?? '').trim();
          if (colA.toUpperCase() === 'TOTAL') break;
          // Only consider rows where column A is "11"
          if (colA !== '11') continue;
          const colC = String(row[2] ?? '').trim();
          if (!colC) continue;
          // Skip header-like values in column C
          const colCUpper = colC.toUpperCase().trim();
          if (colCUpper === 'COLABORADORES' || colCUpper === 'NOME DOS' || colCUpper.startsWith('COLABORADORES')) continue;
          matched.push({
            sheetName: colC,
            sheetRow: i,
            collaborator: findCollaborator(colC),
          });
        }
        setMatches(matched);
        setStep('match');
        toast.success(`${matched.length} nomes encontrados na planilha`);
      } catch (err: any) {
        toast.error('Erro ao ler planilha: ' + (err.message ?? 'formato inválido'));
      }
    };
    reader.readAsArrayBuffer(file);
  }, [findCollaborator]);

  // Update manual match
  const handleManualMatch = (index: number, collabId: string) => {
    const collab = activeCollabs.find(c => c.id === collabId) ?? null;
    setMatches(prev => prev.map((m, i) => i === index ? { ...m, collaborator: collab, manualOverride: collabId } : m));
  };

  // Calculate jornada for a collaborator (same logic as EspelhoPonto)
  const calcJornadaForCollab = useCallback((collab: Collaborator): JornadaTotals => {
    const collabPunches = punchRecords.filter(p => p.collaborator_id === collab.id);
    const punchMap = new Map<string, typeof punchRecords[0]>();
    collabPunches.forEach(p => punchMap.set(p.date, p));

    const WEEKDAY_NAME_MAP: Record<number, string> = { 0: 'domingo', 1: 'segunda', 2: 'terca', 3: 'quarta', 4: 'quinta', 5: 'sexta', 6: 'sabado' };
    const defaultChMin = collab.carga_horaria_diaria
      ? (() => { const [h, m] = collab.carga_horaria_diaria!.split(':').map(Number); return h * 60 + (m || 0); })()
      : 420;
    const avisoReducao = (collab.status === 'AVISO_PREVIO' && collab.aviso_previo_reducao === 2) ? 120 : 0;

    const dayInfos = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(selectedYear, selectedMonth, d);
      const iso = format(dateObj, 'yyyy-MM-dd');
      const wd = WEEKDAY_MAP[getDay(dateObj)];

      const punch = punchMap.get(iso);
      let entrada = punch?.entrada ?? null;
      let saida = punch?.saida ?? null;
      let saidaInt = punch?.saida_intervalo ?? null;
      let retornoInt = punch?.retorno_intervalo ?? null;

      // Auto interval
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
          }
        }
      }

      const hoursMin = calcHours(entrada, saida, saidaInt, retornoInt);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const isFuture = dateObj >= today;
      const isHoliday = holidaySet.has(iso);
      const isVacation = vacations.some(v => v.collaborator_id === collab.id && iso >= v.data_inicio_ferias && iso <= v.data_fim_ferias);
      const isAfastamento = afastamentos.some(a => a.collaborator_id === collab.id && iso >= a.data_inicio && iso <= a.data_fim);

      const weekStart = (() => {
        const dd = new Date(dateObj);
        const day = dd.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        dd.setDate(dd.getDate() + diff);
        return format(dd, 'yyyy-MM-dd');
      })();
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

      const dayOfWeek = getDay(dateObj);
      const dayName = WEEKDAY_NAME_MAP[dayOfWeek];
      let chForDay = defaultChMin;
      if (collab.jornadas_especiais && collab.jornadas_especiais.length > 0) {
        const especial = collab.jornadas_especiais.find((je: any) => je.dias.includes(dayName));
        if (especial && (especial as any).ch) {
          const [eh, em] = (especial as any).ch.split(':').map(Number);
          chForDay = eh * 60 + (em || 0);
        }
      }
      if (avisoReducao > 0 && !isFolga && !isVacation && !isAfastamento) {
        chForDay = Math.max(0, chForDay - avisoReducao);
      }

      const isFolgaFinal = isFolga || isCompensacao;

      dayInfos.push({
        date: iso,
        isFolga: isFolgaFinal,
        isVacation,
        isAfastamento: isAfastamento || isAtestado,
        isHoliday,
        isFuture,
        punch: { entrada, saida, saidaInt, retornoInt },
        hoursWorkedMin: hoursMin,
        chOverride: chForDay,
      });
    }

    const result = calculateJornada(dayInfos, defaultChMin, collab.genero ?? 'M', 0);
    return result.totals;
  }, [daysInMonth, selectedMonth, selectedYear, punchRecords, swapOverrides, eventsMap, vacations, afastamentos, holidaySet]);

  // Process data
  const handleProcess = useCallback(async () => {
    setProcessing(true);
    try {
      const matchedCollabs = matches.filter(m => m.collaborator).map(m => m.collaborator!);

      // Fetch bonus and VT data
      const { data: bonusData } = await supabase
        .from('bonus_10_monthly')
        .select('*')
        .eq('month', selectedMonth + 1)
        .eq('year', selectedYear);

      const { data: vtData } = await supabase
        .from('vt_monthly')
        .select('*')
        .eq('month', selectedMonth + 1)
        .eq('year', selectedYear);

      const bonusMap = new Map((bonusData ?? []).map(b => [b.collaborator_id, b]));
      const vtMap = new Map((vtData ?? []).map(v => [v.collaborator_id, v]));

      const results: ProcessedData[] = [];

      for (const collab of matchedCollabs) {
        const warnings: string[] = [];

        // Calculate jornada
        const collabPunches = punchRecords.filter(p => p.collaborator_id === collab.id);
        let totals: JornadaTotals;
        if (collabPunches.length === 0) {
          warnings.push('Sem dados no espelho');
          totals = { chPrevista: 0, normais: 0, faltas: 0, atraso: 0, adiantamento: 0, extraBH: 0, extra100: 0, adNoturno: 0, not100: 0, saldoBH: 0 };
        } else {
          totals = calcJornadaForCollab(collab);
        }

        // E.100 and N.100 only for women
        const extra100 = collab.genero === 'F' ? Math.round((totals.extra100 / 60) * 100) / 100 : 0;
        const not100 = collab.genero === 'F' ? Math.round((totals.not100 / 60) * 100) / 100 : 0;
        const adNoturno = Math.round((totals.adNoturno / 60) * 100) / 100;

        // Bonus 10%
        const bonus = bonusMap.get(collab.id);
        const bonus10 = bonus?.valor_bonus ? Math.ceil(Number(bonus.valor_bonus)) : 0;
        if (!bonus) warnings.push('Sem bônus 10%');

        // VT
        const vt = vtMap.get(collab.id);
        const vtDesconto = vt?.desconto_folha ? Number(vt.desconto_folha) : 0;
        if (!vt && collab.vt_ativo) warnings.push('Sem VT');

        if (!collab.genero) warnings.push('Gênero não definido');

        results.push({
          collaboratorId: collab.id,
          collaboratorName: collab.collaborator_name,
          sector: collab.sector,
          genero: collab.genero ?? '?',
          extra100,
          not100,
          adNoturno,
          bonus10,
          vtDesconto,
          warnings,
        });
      }

      // Add unmatched from sheet
      for (const m of matches) {
        if (!m.collaborator) {
          results.push({
            collaboratorId: '',
            collaboratorName: m.sheetName,
            sector: '',
            genero: '?',
            extra100: 0, not100: 0, adNoturno: 0, bonus10: 0, vtDesconto: 0,
            warnings: ['Nome não encontrado'],
          });
        }
      }

      setProcessedData(results);
      setStep('review');
      toast.success(`${results.length} colaboradores processados`);
    } catch (err: any) {
      toast.error('Erro ao processar: ' + (err.message ?? 'desconhecido'));
    } finally {
      setProcessing(false);
    }
  }, [matches, selectedMonth, selectedYear, punchRecords, calcJornadaForCollab]);

  // Export filled spreadsheet
  const handleExport = useCallback(async () => {
    if (!uploadedFile || processedData.length === 0) return;

    try {
      const buffer = await uploadedFile.arrayBuffer();
      const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];

      // Fill data into the sheet
      for (const m of matches) {
        if (!m.collaborator) continue;
        const pd = processedData.find(p => p.collaboratorId === m.collaborator!.id);
        if (!pd) continue;

        const _row = m.sheetRow + 1; // XLSX is 1-indexed
        // F = col 5 (E.100), G = col 6 (N.100), H = col 7 (A.Not), K = col 10 (Bonus), O = col 14 (VT)
        if (pd.extra100 > 0) sheet[XLSX.utils.encode_cell({ r: m.sheetRow, c: 5 })] = { t: 'n', v: pd.extra100 };
        if (pd.not100 > 0) sheet[XLSX.utils.encode_cell({ r: m.sheetRow, c: 6 })] = { t: 'n', v: pd.not100 };
        if (pd.adNoturno > 0) sheet[XLSX.utils.encode_cell({ r: m.sheetRow, c: 7 })] = { t: 'n', v: pd.adNoturno };
        if (pd.bonus10 > 0) sheet[XLSX.utils.encode_cell({ r: m.sheetRow, c: 10 })] = { t: 'n', v: pd.bonus10 };
        if (pd.vtDesconto > 0) sheet[XLSX.utils.encode_cell({ r: m.sheetRow, c: 14 })] = { t: 'n', v: pd.vtDesconto };
      }

      // Save snapshot
      const snapshot = {
        processedAt: new Date().toISOString(),
        month: selectedMonth + 1,
        year: selectedYear,
        data: processedData,
        matches: matches.map(m => ({ sheetName: m.sheetName, sheetRow: m.sheetRow, collaboratorId: m.collaborator?.id })),
      };

      await supabase.from('payroll_closings' as any).upsert({
        month: selectedMonth + 1,
        year: selectedYear,
        status: 'processado',
        template_file_name: uploadedFile.name,
        processed_at: new Date().toISOString(),
        processed_by: usuario?.id,
        data_snapshot: snapshot,
      } as any, { onConflict: 'month,year' });

      XLSX.writeFile(workbook, `folha-${MONTHS[selectedMonth].label}-${selectedYear}.xls`);
      toast.success('Planilha gerada com sucesso!');
      setStep('export');
    } catch (err: any) {
      toast.error('Erro ao exportar: ' + (err.message ?? 'desconhecido'));
    }
  }, [uploadedFile, processedData, matches, selectedMonth, selectedYear, usuario]);

  // Reprocess
  const handleReprocess = () => {
    setStep('upload');
    setUploadedFile(null);
    setMatches([]);
    setProcessedData([]);
  };

  const matchedCount = matches.filter(m => m.collaborator).length;
  const unmatchedCount = matches.filter(m => !m.collaborator).length;

  // Summary totals for review
  const totals = useMemo(() => {
    return processedData.reduce((acc, p) => ({
      extra100: acc.extra100 + p.extra100,
      not100: acc.not100 + p.not100,
      adNoturno: acc.adNoturno + p.adNoturno,
      bonus10: acc.bonus10 + p.bonus10,
      vtDesconto: acc.vtDesconto + p.vtDesconto,
    }), { extra100: 0, not100: 0, adNoturno: 0, bonus10: 0, vtDesconto: 0 });
  }, [processedData]);

  const warningCount = processedData.filter(p => p.warnings.length > 0).length;

  const statusBadge = existingClosing?.status === 'processado'
    ? <Badge className="bg-green-100 text-green-700 border-green-200">Processado</Badge>
    : existingClosing?.status === 'enviado'
    ? <Badge className="bg-blue-100 text-blue-700 border-blue-200">Enviado</Badge>
    : <Badge variant="outline">Rascunho</Badge>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">Fechamento de Folha</h1>
          {statusBadge}
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <Select value={String(selectedMonth)} onValueChange={v => { setSelectedMonth(Number(v)); handleReprocess(); }}>
            <SelectTrigger className="w-32 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{MONTHS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={String(selectedYear)} onValueChange={v => { setSelectedYear(Number(v)); handleReprocess(); }}>
            <SelectTrigger className="w-20 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
          {existingClosing && (
            <Button variant="outline" size="sm" onClick={handleReprocess}>
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Reprocessar
            </Button>
          )}
        </div>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2">
        {(['upload', 'match', 'review', 'export'] as Step[]).map((s, i) => {
          const labels = ['1. Upload', '2. Match', '3. Conferência', '4. Exportar'];
          const isCurrent = step === s;
          const isDone = ['upload', 'match', 'review', 'export'].indexOf(step) > i;
          return (
            <div key={s} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
              isCurrent ? 'bg-primary text-primary-foreground' : isDone ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'
            }`}>
              {isDone && <CheckCircle className="w-3.5 h-3.5" />}
              {labels[i]}
            </div>
          );
        })}
      </div>

      {/* Step 1 — Upload */}
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="w-4 h-4" /> Upload do Modelo da Contabilidade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DropZone accept=".xls,.xlsx,.xlsm" onFiles={handleFileUpload} label="Arraste o arquivo .xls da contabilidade ou clique para selecionar" />
            {existingClosing?.data_snapshot && (
              <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Último processamento: {existingClosing.template_file_name} em {format(new Date(existingClosing.processed_at), 'dd/MM/yyyy HH:mm')}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2 — Match */}
      {step === 'match' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" /> Correspondência de Nomes
              <Badge variant="outline" className="ml-2">{matchedCount} encontrados</Badge>
              {unmatchedCount > 0 && <Badge variant="destructive">{unmatchedCount} não encontrados</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="max-h-96 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Nome na Planilha</TableHead>
                    <TableHead className="text-xs">Colaborador RH Love</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matches.map((m, i) => (
                    <TableRow key={i} className={!m.collaborator ? 'bg-destructive/5' : ''}>
                      <TableCell className="text-sm font-medium">{m.sheetName}</TableCell>
                      <TableCell>
                        {m.collaborator ? (
                          <span className="text-sm">{m.collaborator.collaborator_name}</span>
                        ) : (
                          <Select onValueChange={v => handleManualMatch(i, v)}>
                            <SelectTrigger className="h-7 text-xs w-48">
                              <SelectValue placeholder="Selecionar..." />
                            </SelectTrigger>
                            <SelectContent>
                              {activeCollabs.map(c => (
                                <SelectItem key={c.id} value={c.id} className="text-xs">{c.collaborator_name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell>
                        {m.collaborator ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-destructive" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-between items-center pt-2">
              <Button variant="outline" size="sm" onClick={() => setStep('upload')}>Voltar</Button>
              <Button size="sm" onClick={handleProcess} disabled={processing || matchedCount === 0}>
                <Play className="w-3.5 h-3.5 mr-1" />
                {processing ? 'Processando...' : 'Processar Dados'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3 — Review */}
      {step === 'review' && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-5 gap-3">
            <Card><CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground">Colaboradores</p>
              <p className="text-lg font-bold tabular-nums">{processedData.length}</p>
            </CardContent></Card>
            <Card className={warningCount > 0 ? 'border-amber-300 bg-amber-50/50' : ''}>
              <CardContent className="p-3">
                <p className="text-[10px] text-muted-foreground">Com avisos</p>
                <p className={`text-lg font-bold tabular-nums ${warningCount > 0 ? 'text-amber-600' : ''}`}>{warningCount}</p>
              </CardContent>
            </Card>
            <Card><CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground">Total Bônus 10%</p>
              <p className="text-lg font-bold tabular-nums">R$ {totals.bonus10.toLocaleString('pt-BR')}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground">Total VT</p>
              <p className="text-lg font-bold tabular-nums">R$ {totals.vtDesconto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground">Total A.Not (dec)</p>
              <p className="text-lg font-bold tabular-nums">{totals.adNoturno.toFixed(2)}</p>
            </CardContent></Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Conferência de Dados
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setStep('match')}>Voltar</Button>
                  <Button size="sm" onClick={handleExport}>
                    <Download className="w-3.5 h-3.5 mr-1" /> Gerar Planilha
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-auto max-h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky top-0 z-10 bg-gray-100 text-xs font-bold h-8">Colaborador</TableHead>
                      <TableHead className="sticky top-0 z-10 bg-gray-100 text-xs font-bold h-8">Setor</TableHead>
                      <TableHead className="sticky top-0 z-10 bg-gray-100 text-xs font-bold h-8 text-center">Gên.</TableHead>
                      <TableHead className="sticky top-0 z-10 bg-gray-100 text-xs font-bold h-8 text-center">E.100</TableHead>
                      <TableHead className="sticky top-0 z-10 bg-gray-100 text-xs font-bold h-8 text-center">N.100</TableHead>
                      <TableHead className="sticky top-0 z-10 bg-gray-100 text-xs font-bold h-8 text-center">A.Not</TableHead>
                      <TableHead className="sticky top-0 z-10 bg-gray-100 text-xs font-bold h-8 text-center">Bônus 10%</TableHead>
                      <TableHead className="sticky top-0 z-10 bg-gray-100 text-xs font-bold h-8 text-center">VT</TableHead>
                      <TableHead className="sticky top-0 z-10 bg-gray-100 text-xs font-bold h-8">Avisos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {processedData.map((p, i) => (
                      <TableRow key={i} className={p.warnings.length > 0 ? 'bg-amber-50/50' : i % 2 === 1 ? 'bg-gray-50/60' : ''}>
                        <TableCell className="text-xs font-medium">{p.collaboratorName}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{p.sector}</TableCell>
                        <TableCell className="text-xs text-center">{p.genero}</TableCell>
                        <TableCell className="text-xs tabular-nums text-center">{p.extra100 > 0 ? p.extra100.toFixed(2) : '—'}</TableCell>
                        <TableCell className="text-xs tabular-nums text-center">{p.not100 > 0 ? p.not100.toFixed(2) : '—'}</TableCell>
                        <TableCell className="text-xs tabular-nums text-center">{p.adNoturno > 0 ? p.adNoturno.toFixed(2) : '—'}</TableCell>
                        <TableCell className="text-xs tabular-nums text-center font-medium">{p.bonus10 > 0 ? `R$ ${p.bonus10}` : '—'}</TableCell>
                        <TableCell className="text-xs tabular-nums text-center">{p.vtDesconto > 0 ? `R$ ${p.vtDesconto.toFixed(2)}` : '—'}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {p.warnings.map((w, j) => (
                              <span key={j} className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-100 text-amber-700 border border-amber-200">
                                ⚠️ {w}
                              </span>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow className="font-semibold bg-muted/50">
                      <TableCell colSpan={3} className="text-xs text-right">TOTAIS</TableCell>
                      <TableCell className="text-xs tabular-nums text-center">{totals.extra100.toFixed(2)}</TableCell>
                      <TableCell className="text-xs tabular-nums text-center">{totals.not100.toFixed(2)}</TableCell>
                      <TableCell className="text-xs tabular-nums text-center">{totals.adNoturno.toFixed(2)}</TableCell>
                      <TableCell className="text-xs tabular-nums text-center font-bold">R$ {totals.bonus10.toLocaleString('pt-BR')}</TableCell>
                      <TableCell className="text-xs tabular-nums text-center font-bold">R$ {totals.vtDesconto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Step 4 — Export done */}
      {step === 'export' && (
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto" />
            <h3 className="text-lg font-semibold">Planilha gerada com sucesso!</h3>
            <p className="text-sm text-muted-foreground">
              O arquivo foi baixado e os dados foram salvos como processados.
            </p>
            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={handleReprocess}>
                <RefreshCw className="w-3.5 h-3.5 mr-1" /> Novo Processamento
              </Button>
              <Button onClick={handleExport}>
                <Download className="w-3.5 h-3.5 mr-1" /> Baixar Novamente
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
