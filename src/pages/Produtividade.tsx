import { useState, useMemo, useRef, useCallback } from 'react';
import { useCollaborators } from '@/hooks/useCollaborators';
import { useDailySales, useUpsertDailySales, useBulkInsertDailySales, useDeleteDailySales, type DailySalesInput } from '@/hooks/useDailySales';
import { useFreelancers, useBulkUpsertFreelancers } from '@/hooks/useFreelancers';
import { useBulkInsertFreelancerEntries } from '@/hooks/useFreelancerEntries';
import { useScheduledVacations } from '@/hooks/useScheduledVacations';
import { supabase } from '@/integrations/supabase/client';
import { generateProductivityData, formatCurrency, formatDecimal, formatDateBR, getSectorOrder } from '@/lib/productivityEngine';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { useToast } from '@/hooks/use-toast';
import { Download, Printer, Upload, Plus, Pencil, Trash2, BarChart3, FileSpreadsheet, AlertCircle, Check, History, Users } from 'lucide-react';
import IndicatorLegend, { IndicatorTooltip } from '@/components/IndicatorLegend';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, Legend, LabelList } from 'recharts';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import ProductivityTables from '@/components/productivity/ProductivityTables';
import FreelancerImportReviewDialog, { type FreeReviewEntry, generateEntryId } from '@/components/FreelancerImportReviewDialog';
import * as XLSX from 'xlsx';

const SECTOR_COLORS: Record<string, string> = {
  'COZINHA': 'hsl(var(--sector-cozinha))',
  'SALÃO': 'hsl(var(--sector-salao))',
  'TELE - ENTREGA': 'hsl(var(--sector-tele))',
  'DIURNO': 'hsl(var(--sector-diurno))',
};

interface ImportPreviewRow {
  date: string;
  pedidos_totais: number;
  faturamento_total: number;
  pedidos_tele: number;
  faturamento_tele: number;
  pedidos_salao: number;
  faturamento_salao: number;
  errors: string[];
}

export default function Produtividade() {
  const now = new Date();
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const lastOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`;

  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(lastOfMonth);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importDate, setImportDate] = useState(new Date().toISOString().split('T')[0]);
  const [importPreview, setImportPreview] = useState<ImportPreviewRow[]>([]);
  const [importError, setImportError] = useState('');
  const [form, setForm] = useState<DailySalesInput>({
    date: '',
    faturamento_total: 0,
    pedidos_totais: 0,
    faturamento_salao: 0,
    pedidos_salao: 0,
    faturamento_tele: 0,
    pedidos_tele: 0,
  });
  const printRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const histFileInputRef = useRef<HTMLInputElement>(null);
  const [histDialogOpen, setHistDialogOpen] = useState(false);
  const [histPreview, setHistPreview] = useState<ImportPreviewRow[]>([]);
  const [histError, setHistError] = useState('');
  const [histExistingDates, setHistExistingDates] = useState<string[]>([]);
  const [tmpSectorFilter, setTmpSectorFilter] = useState<string>('ALL');
  const [pcsSectorFilter, setPcsSectorFilter] = useState<string>('ALL');
  const [importStores, setImportStores] = useState<{ name: string; row: any[] }[]>([]);
  const [importColMap, setImportColMap] = useState<Record<string, number>>({});
  const [importValidationWarning, setImportValidationWarning] = useState('');
  // Freelancer import state
  const freeFileInputRef = useRef<HTMLInputElement>(null);
  const [freeReviewOpen, setFreeReviewOpen] = useState(false);
  const [freeReviewEntries, setFreeReviewEntries] = useState<FreeReviewEntry[]>([]);
  const { toast } = useToast();

  const { data: collaborators = [] } = useCollaborators();
  const { data: salesData = [], isLoading } = useDailySales(startDate, endDate);
  const { data: freelancersData = [] } = useFreelancers(startDate, endDate);
  const { data: scheduledVacations = [] } = useScheduledVacations();

  // Previous period for comparison
  const prevPeriod = useMemo(() => {
    const s = new Date(startDate + 'T00:00:00');
    const e = new Date(endDate + 'T00:00:00');
    const days = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
    const prevEnd = new Date(s);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - days + 1);
    const toStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { start: toStr(prevStart), end: toStr(prevEnd) };
  }, [startDate, endDate]);

  const { data: prevSalesData = [] } = useDailySales(prevPeriod.start, prevPeriod.end);
  const { data: prevFreelancersData = [] } = useFreelancers(prevPeriod.start, prevPeriod.end);

  const upsertMut = useUpsertDailySales();
  const bulkMut = useBulkInsertDailySales();
  const deleteMut = useDeleteDailySales();
  const bulkFreeMut = useBulkUpsertFreelancers();
  const bulkFreeEntriesMut = useBulkInsertFreelancerEntries();

  const productivityRows = useMemo(
    () => generateProductivityData(salesData, collaborators, freelancersData, scheduledVacations),
    [salesData, collaborators, freelancersData, scheduledVacations]
  );

  const prevProductivityRows = useMemo(
    () => generateProductivityData(prevSalesData, collaborators, prevFreelancersData, scheduledVacations),
    [prevSalesData, collaborators, prevFreelancersData, scheduledVacations]
  );

  const groupedByDate = useMemo(() => {
    const map = new Map<string, typeof productivityRows>();
    for (const row of productivityRows) {
      if (!map.has(row.date)) map.set(row.date, []);
      map.get(row.date)!.push(row);
    }
    for (const [, rows] of map) {
      rows.sort((a, b) => getSectorOrder(a.sector) - getSectorOrder(b.sector));
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [productivityRows]);

  const chartTCS = useMemo(() => {
    const sectors = tmpSectorFilter === 'ALL'
      ? ['COZINHA', 'SALÃO', 'TELE - ENTREGA', 'DIURNO']
      : [tmpSectorFilter];
    const dates = [...new Set(productivityRows.map(r => r.date))].sort();
    return dates.map(date => {
      const row: Record<string, any> = { date: formatDateBR(date) };
      for (const r of productivityRows.filter(r => r.date === date)) {
        if (sectors.includes(r.sector)) {
          row[r.sector] = Math.round(r.tcs * 100) / 100;
        }
      }
      return row;
    });
  }, [productivityRows, tmpSectorFilter]);

  const chartPCS = useMemo(() => {
    const sectors = pcsSectorFilter === 'ALL'
      ? ['COZINHA', 'SALÃO', 'TELE - ENTREGA', 'DIURNO']
      : [pcsSectorFilter];
    const dates = [...new Set(productivityRows.map(r => r.date))].sort();
    return dates.map(date => {
      const row: Record<string, any> = { date: formatDateBR(date) };
      for (const r of productivityRows.filter(r => r.date === date)) {
        if (sectors.includes(r.sector)) {
          row[r.sector] = Math.round(r.pcs * 100) / 100;
        }
      }
      return row;
    });
  }, [productivityRows, pcsSectorFilter]);

  const chartTCT = useMemo(() => {
    const dates = [...new Set(productivityRows.map(r => r.date))].sort();
    return dates.map(date => {
      const tctRow = productivityRows.find(r => r.date === date && r.sector === 'TCT');
      return {
        date: formatDateBR(date),
        TCT: tctRow ? Math.round(tctRow.tcs * 100) / 100 : 0,
      };
    });
  }, [productivityRows]);

  const chartPCT = useMemo(() => {
    const dates = [...new Set(productivityRows.map(r => r.date))].sort();
    return dates.map(date => {
      const pctRow = productivityRows.find(r => r.date === date && r.sector === 'PCT');
      return {
        date: formatDateBR(date),
        PCT: pctRow ? Math.round(pctRow.pcs * 100) / 100 : 0,
      };
    });
  }, [productivityRows]);

  const openNew = () => {
    setForm({
      date: new Date().toISOString().split('T')[0],
      faturamento_total: 0,
      pedidos_totais: 0,
      faturamento_salao: 0,
      pedidos_salao: 0,
      faturamento_tele: 0,
      pedidos_tele: 0,
    });
    setDialogOpen(true);
  };

  const openEdit = (sale: typeof salesData[0]) => {
    setForm({
      date: sale.date,
      faturamento_total: Number(sale.faturamento_total),
      pedidos_totais: Number(sale.pedidos_totais),
      faturamento_salao: Number(sale.faturamento_salao),
      pedidos_salao: Number(sale.pedidos_salao),
      faturamento_tele: Number(sale.faturamento_tele),
      pedidos_tele: Number(sale.pedidos_tele),
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.date) {
      toast({ title: 'Data obrigatória', variant: 'destructive' });
      return;
    }
    try {
      await upsertMut.mutateAsync(form);
      toast({ title: 'Dados salvos' });
      setDialogOpen(false);
    } catch {
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir dados deste dia?')) return;
    try {
      await deleteMut.mutateAsync(id);
      toast({ title: 'Dados excluídos' });
    } catch {
      toast({ title: 'Erro ao excluir', variant: 'destructive' });
    }
  };

  // ====== Helper: build preview row from a data row + column map ======
  const buildPreviewFromRow = (dataRow: any[], colMap: Record<string, number>): ImportPreviewRow => {
    const errors: string[] = [];
    const getNum = (key: string): number => {
      const idx = colMap[key];
      if (idx === undefined) return 0;
      const val = dataRow[idx];
      if (val === '' || val === null || val === undefined) return 0;
      const n = Number(val);
      if (isNaN(n)) {
        errors.push(`Coluna "${key}": valor "${val}" não é numérico`);
        return 0;
      }
      return n;
    };

    const totalQtd = getNum('TOTAL QTD');
    const totalVal = getNum('TOTAL');
    const deliveryQtd = getNum('DELIVERY QTD');
    const deliveryVal = getNum('DELIVERY');
    const telefoneQtd = getNum('TELEFONE QTD');
    const telefoneVal = getNum('TELEFONE');
    const lojaQtd = getNum('LOJA FÍSICA QTD') || getNum('LOJA FISICA QTD');
    const lojaVal = getNum('LOJA FÍSICA') || getNum('LOJA FISICA');

    const pedidos_tele = deliveryQtd + telefoneQtd;
    const faturamento_tele = deliveryVal + telefoneVal;
    const pedidos_salao = lojaQtd;
    const faturamento_salao = lojaVal;

    // Validation: salao + tele should equal total
    const pedidosDiff = Math.abs((pedidos_salao + pedidos_tele) - totalQtd);
    const fatDiff = Math.abs((faturamento_salao + faturamento_tele) - totalVal);
    let validationWarning = '';
    if (pedidosDiff > 0.01 || fatDiff > 0.01) {
      const parts: string[] = [];
      if (pedidosDiff > 0.01) parts.push(`Pedidos: Salão(${pedidos_salao}) + Tele(${pedidos_tele}) = ${pedidos_salao + pedidos_tele} ≠ Total(${totalQtd})`);
      if (fatDiff > 0.01) parts.push(`Faturamento: Salão(${faturamento_salao.toFixed(2)}) + Tele(${faturamento_tele.toFixed(2)}) = ${(faturamento_salao + faturamento_tele).toFixed(2)} ≠ Total(${totalVal.toFixed(2)})`);
      validationWarning = parts.join(' | ');
    }

    return {
      date: '',
      pedidos_totais: totalQtd,
      faturamento_total: totalVal,
      pedidos_tele,
      faturamento_tele,
      pedidos_salao,
      faturamento_salao,
      errors,
      _validationWarning: validationWarning,
    } as ImportPreviewRow & { _validationWarning?: string };
  };

  // ====== IMPORT LOGIC: Saipos "Relatório canais de venda" ======
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError('');
    setImportPreview([]);
    setImportStores([]);
    setImportColMap({});
    setImportValidationWarning('');

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];

      const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      if (raw.length < 2) {
        setImportError('Planilha vazia ou sem dados.');
        setImportDialogOpen(true);
        return;
      }

      // Find header row (row with "TOTAL QTD" or "TOTAL" columns)
      let headerIdx = -1;
      let colMap: Record<string, number> = {};
      const normalizeHeader = (v: any) => String(v || '').trim().toUpperCase();

      for (let i = 0; i < Math.min(raw.length, 10); i++) {
        const row = raw[i];
        if (!row) continue;
        const headers = row.map(normalizeHeader);
        if (headers.includes('TOTAL QTD') || headers.includes('TOTAL')) {
          headerIdx = i;
          headers.forEach((h, idx) => {
            // Ignore duplicate columns with suffixes like .1, .2 — keep only the first occurrence
            if (/\.\d+$/.test(h)) return;
            // Only keep the first occurrence of each header
            if (!(h in colMap)) {
              colMap[h] = idx;
            }
          });
          break;
        }
      }

      if (headerIdx === -1) {
        setImportError('Cabeçalho não encontrado. Esperado colunas como "TOTAL QTD", "TOTAL", "DELIVERY QTD", etc.');
        setImportDialogOpen(true);
        return;
      }

      setImportColMap(colMap);

      // Collect all data rows (potential stores)
      const allStores: { name: string; row: any[] }[] = [];
      for (let i = headerIdx + 1; i < raw.length; i++) {
        const row = raw[i];
        if (!row) continue;
        const firstCol = normalizeHeader(row[0]);
        if (!firstCol || firstCol === 'TOTAL' || firstCol === '') continue;
        allStores.push({ name: String(row[0]).trim(), row });
      }

      if (allStores.length === 0) {
        setImportError('Nenhuma linha de dados encontrada após o cabeçalho.');
        setImportDialogOpen(true);
        return;
      }

      // If multiple stores, let user choose
      if (allStores.length > 1) {
        // Auto-select "ESTRELA" if found
        const estrela = allStores.find(s => normalizeHeader(s.name).includes('ESTRELA'));
        if (estrela) {
          const preview = buildPreviewFromRow(estrela.row, colMap);
          setImportValidationWarning((preview as any)._validationWarning || '');
          setImportPreview([preview]);
          setImportStores(allStores);
        } else {
          setImportStores(allStores);
          setImportPreview([]);
        }
        setImportDialogOpen(true);
        return;
      }

      // Single store
      const preview = buildPreviewFromRow(allStores[0].row, colMap);
      setImportValidationWarning((preview as any)._validationWarning || '');
      setImportPreview([preview]);
      setImportDialogOpen(true);
    } catch {
      setImportError('Erro ao ler a planilha. Verifique se o arquivo é um Excel válido.');
      setImportDialogOpen(true);
    }

    e.target.value = '';
  };

  const handleSelectStore = (storeName: string) => {
    const store = importStores.find(s => s.name === storeName);
    if (!store) return;
    const preview = buildPreviewFromRow(store.row, importColMap);
    setImportValidationWarning((preview as any)._validationWarning || '');
    setImportPreview([preview]);
  };

  const handleConfirmImport = async () => {
    const validRows = importPreview.filter(r => r.errors.length === 0);
    if (validRows.length === 0) {
      toast({ title: 'Nenhum dado válido para importar', variant: 'destructive' });
      return;
    }

    // Use importDate for rows without a date
    const mapped: DailySalesInput[] = validRows.map((r, idx) => ({
      date: r.date || (validRows.length === 1 ? importDate : (() => {
        // Multiple rows without dates: increment day from importDate
        const d = new Date(importDate + 'T00:00:00');
        d.setDate(d.getDate() + idx);
        return d.toISOString().split('T')[0];
      })()),
      faturamento_total: r.faturamento_total,
      pedidos_totais: r.pedidos_totais,
      faturamento_salao: r.faturamento_salao,
      pedidos_salao: r.pedidos_salao,
      faturamento_tele: r.faturamento_tele,
      pedidos_tele: r.pedidos_tele,
    }));

    try {
      await bulkMut.mutateAsync(mapped);
      toast({ title: `${mapped.length} dia(s) importado(s) com sucesso` });
      setImportDialogOpen(false);
      setImportPreview([]);
    } catch {
      toast({ title: 'Erro ao salvar dados importados', variant: 'destructive' });
    }
  };

  // ====== HISTORICAL IMPORT ======
  const HIST_START_DATE = new Date(2026, 1, 23); // 23/02/2026

  const handleHistFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setHistError('');
    setHistPreview([]);
    setHistExistingDates([]);

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      if (raw.length < 2) {
        setHistError('Planilha vazia ou sem dados.');
        setHistDialogOpen(true);
        return;
      }

      const preview: ImportPreviewRow[] = [];
      let dayOffset = 0;

      for (let i = 1; i < raw.length; i++) {
        const row = raw[i];
        if (!row || row.length === 0) continue;

        const colB = row[1];
        const colC = row[2];
        const colD = row[3];
        const colE = row[4];
        const colH = row[7];
        const colI = row[8];

        if (!colB && !colC && !colD && !colE && !colH && !colI) continue;
        const colA = String(row[0] || '').trim().toUpperCase();
        if (colA === 'TOTAL') continue;

        const errors: string[] = [];
        const parseNum = (val: any, colName: string): number => {
          if (val === '' || val === null || val === undefined) return 0;
          const n = Number(val);
          if (isNaN(n)) {
            errors.push(`Coluna ${colName}: valor "${val}" não é numérico`);
            return 0;
          }
          return n;
        };

        // Date by line position: line 2 = 23/02/2026, line 3 = 24/02/2026 ...
        const d = new Date(HIST_START_DATE);
        d.setDate(d.getDate() + dayOffset);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        dayOffset++;

        preview.push({
          date: dateStr,
          pedidos_totais: parseNum(colB, 'B'),
          faturamento_total: parseNum(colC, 'C'),
          pedidos_tele: parseNum(colD, 'D'),
          faturamento_tele: parseNum(colE, 'E'),
          pedidos_salao: parseNum(colH, 'H'),
          faturamento_salao: parseNum(colI, 'I'),
          errors,
        });
      }

      if (preview.length === 0) {
        setHistError('Nenhuma linha de dados válida encontrada na planilha.');
      } else {
        // Check for existing dates
        const dates = preview.map(r => r.date);
        const { data: existing } = await supabase
          .from('daily_sales')
          .select('date')
          .in('date', dates);
        if (existing && existing.length > 0) {
          setHistExistingDates(existing.map((e: any) => e.date));
        }
      }

      setHistPreview(preview);
      setHistDialogOpen(true);
    } catch {
      setHistError('Erro ao ler a planilha.');
      setHistDialogOpen(true);
    }

    e.target.value = '';
  };

  const handleConfirmHistImport = async () => {
    const validRows = histPreview.filter(r => r.errors.length === 0);
    if (validRows.length === 0) {
      toast({ title: 'Nenhum dado válido para importar', variant: 'destructive' });
      return;
    }

    const mapped: DailySalesInput[] = validRows.map(r => ({
      date: r.date,
      faturamento_total: r.faturamento_total,
      pedidos_totais: r.pedidos_totais,
      faturamento_salao: r.faturamento_salao,
      pedidos_salao: r.pedidos_salao,
      faturamento_tele: r.faturamento_tele,
      pedidos_tele: r.pedidos_tele,
    }));

    try {
      await bulkMut.mutateAsync(mapped);
      const firstDate = formatDateBR(mapped[0].date);
      const lastDate = formatDateBR(mapped[mapped.length - 1].date);
      toast({ title: `${mapped.length} dias históricos importados com sucesso, de ${firstDate} até ${lastDate}.` });
      setHistDialogOpen(false);
      setHistPreview([]);
    } catch {
      toast({ title: 'Erro ao salvar dados históricos', variant: 'destructive' });
    }
  };

  const hasRowsWithoutDate = importPreview.some(r => !r.date);

  const handleExport = () => {
    const wb = XLSX.utils.book_new();
    const exportRows = groupedByDate.flatMap(([, rows]) =>
      rows.map(r => ({
        Data: formatDateBR(r.date),
        Setor: r.sector,
        Vendas: r.vendas || '',
        Pedidos: r.pedidos || '',
        'Nº Colaboradores': r.numero_pessoas,
        'Ticket p/ colab. do setor': r.tcs ? Math.round(r.tcs * 100) / 100 : '',
        'Pedidos p/ colab. do setor': r.pcs ? Math.round(r.pcs * 100) / 100 : '',
      }))
    );
    const ws = XLSX.utils.json_to_sheet(exportRows);
    XLSX.utils.book_append_sheet(wb, ws, 'Produtividade');
    XLSX.writeFile(wb, `Produtividade_${startDate}_${endDate}.xlsx`);
  };

  const handlePrint = () => window.print();

  const isSummaryRow = (sector: string) => ['TIME', 'TCT', 'PCT'].includes(sector);

  const tcsChartConfig = {
    COZINHA: { label: 'Cozinha', color: SECTOR_COLORS['COZINHA'] },
    DIURNO: { label: 'Diurno', color: SECTOR_COLORS['DIURNO'] },
    'SALÃO': { label: 'Salão', color: SECTOR_COLORS['SALÃO'] },
    'TELE - ENTREGA': { label: 'Tele-Entrega', color: SECTOR_COLORS['TELE - ENTREGA'] },
  };

  const tctChartConfig = {
    TCT: { label: 'Ticket por colaborador do time', color: 'hsl(var(--primary))' },
  };

  const pctChartConfig = {
    PCT: { label: 'Pedidos por colaborador do time', color: 'hsl(var(--chart-2, 160 60% 45%))' },
  };

  // ====== FREELANCER IMPORT LOGIC ======

  /** Detect sector from a description string (Modelo B) */
  const inferSectorFromDesc = (desc: string): string | null => {
    const upper = desc.toUpperCase();
    if (upper.includes('CAIXA TELE') || /\bTELE\b/.test(upper)) return 'TELE - ENTREGA';
    if (upper.includes('CAIXA SAL') || /\bSALA[OÃ]\b/.test(upper) || upper.includes('SALAO') || upper.includes('SALÃO')) return 'SALÃO';
    if (/COZINHA|COZIN|\bCOZI\b|\bCOZ\b/.test(upper)) return 'COZINHA';
    return null;
  };

  /** Extract freelancer name from description like "FREE Gabriel | Caixa Salão" */
  const extractFreeName = (desc: string): string => {
    let name = desc.replace(/^free\s+/i, '').trim();
    name = name.replace(/\|.*$/, '').trim();
    name = name.replace(/\s*(COZINHA|COZ|COZI|SALAO|SALÃO|TELE|DOBRADO)\s*$/i, '').trim();
    return name || 'FREE';
  };

  /** Parse Modelo B — financial raw file → individual review entries */
  const parseModeloBToEntries = (raw: any[][]): FreeReviewEntry[] => {
    const normalize = (v: any) => String(v || '').trim().toUpperCase();
    let headerIdx = -1;
    let colMap: Record<string, number> = {};
    for (let i = 0; i < Math.min(raw.length, 10); i++) {
      const row = raw[i];
      if (!row) continue;
      const headers = row.map(normalize);
      if (headers.some(h => h.includes('VENCIMENTO')) && headers.some(h => h.includes('DESCRI'))) {
        headerIdx = i;
        headers.forEach((h, idx) => { colMap[h] = idx; });
        break;
      }
    }
    if (headerIdx === -1) return [];

    const findCol = (keywords: string[]): number => {
      for (const key of Object.keys(colMap)) {
        if (keywords.every(k => key.includes(k))) return colMap[key];
      }
      return -1;
    };

    const vencCol = findCol(['VENCIMENTO']);
    const descCol = findCol(['DESCRI']);
    if (vencCol === -1 || descCol === -1) return [];

    const catCol = findCol(['CATEGORI']);
    const valorCol = findCol(['VALOR']);

    const parseExcelDate = (rawDate: any): string => {
      if (!rawDate) return '';
      if (typeof rawDate === 'number') {
        const ed = XLSX.SSF.parse_date_code(rawDate);
        return `${ed.y}-${String(ed.m).padStart(2, '0')}-${String(ed.d).padStart(2, '0')}`;
      }
      const ds = String(rawDate).trim();
      const brMatch = ds.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
      if (/^\d{4}-\d{2}-\d{2}$/.test(ds)) return ds;
      return '';
    };

    const inferSectorFromCategory = (cat: string): string | null => {
      const u = cat.toUpperCase();
      if (/EXTRAS\s*-\s*SAL/i.test(u)) return 'SALÃO';
      if (/EXTRAS\s*-\s*COZ/i.test(u)) return 'COZINHA';
      if (/EXTRAS\s*-\s*TELE/i.test(u)) return 'TELE - ENTREGA';
      return null;
    };

    const entries: FreeReviewEntry[] = [];
    let lastDate = '';

    for (let i = headerIdx + 1; i < raw.length; i++) {
      const row = raw[i];
      if (!row) continue;
      const desc = String(row[descCol] || '').trim();
      const rowDate = parseExcelDate(row[vencCol]);
      if (rowDate) lastDate = rowDate;
      if (!/free/i.test(desc)) continue;

      // --- Filter: only principal entries ---
      // If we have Categoria column, use it to filter
      if (catCol !== -1) {
        const cat = String(row[catCol] || '').trim().toUpperCase();
        // Skip complementary lines (Frente de Caixa, etc.)
        if (cat.includes('FRENTE DE CA') || cat.includes('FRENTE DE CAIXA')) continue;
        // Only accept lines where Categoria starts with "Extras -"
        if (!cat.startsWith('EXTRAS')) continue;
      }

      // If we have Valor column, skip positive values (complementary lines)
      if (valorCol !== -1) {
        const rawVal = row[valorCol];
        const numVal = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal || '0').replace(/[^\d.,-]/g, '').replace(',', '.'));
        if (!isNaN(numVal) && numVal > 0) continue;
      }

      // Skip lines with pipe "|" in description (complementary)
      if (desc.includes('|')) continue;

      const date = rowDate || lastDate;
      if (!date) continue;

      // Infer sector from Categoria first, fallback to description
      let sector: string | null = null;
      if (catCol !== -1) {
        sector = inferSectorFromCategory(String(row[catCol] || ''));
      }
      if (!sector) {
        sector = inferSectorFromDesc(desc);
      }

      entries.push({
        id: generateEntryId(),
        date,
        name: extractFreeName(desc).toUpperCase(),
        sector,
        origin: 'automático',
      });
    }

    // Deduplication: same date + name + sector → keep first
    const seen = new Set<string>();
    const deduped = entries.filter(e => {
      const key = `${e.date}|${(e.name || '').toUpperCase()}|${e.sector || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return deduped;
  };

  /** Parse Modelo A — consolidated file → individual review entries */
  const parseModeloAToEntries = (raw: any[][]): FreeReviewEntry[] => {
    const normalize = (v: any) => String(v || '').trim().toUpperCase();
    let headerIdx = -1;
    let colMap: Record<string, number> = {};
    for (let i = 0; i < Math.min(raw.length, 10); i++) {
      const row = raw[i];
      if (!row) continue;
      const headers = row.map(normalize);
      if (headers.some(h => h.includes('DATA')) && headers.some(h => h.includes('FREE') || h.includes('COZINHA'))) {
        headerIdx = i;
        headers.forEach((h, idx) => { colMap[h] = idx; });
        break;
      }
    }
    if (headerIdx === -1) return [];

    const findCol = (keywords: string[]): number => {
      for (const key of Object.keys(colMap)) {
        if (keywords.every(k => key.includes(k))) return colMap[key];
      }
      return -1;
    };

    const dateCol = findCol(['DATA']);
    const cozinhaCol = findCol(['COZINHA']);
    const salaoCol = findCol(['SAL']);
    const teleCol = findCol(['TELE']);

    if (dateCol === -1 || cozinhaCol === -1 || salaoCol === -1 || teleCol === -1) return [];

    const entries: FreeReviewEntry[] = [];
    for (let i = headerIdx + 1; i < raw.length; i++) {
      const row = raw[i];
      if (!row || !row[dateCol]) continue;

      let dateStr = '';
      const rawDate = row[dateCol];
      if (typeof rawDate === 'number') {
        const excelDate = XLSX.SSF.parse_date_code(rawDate);
        dateStr = `${excelDate.y}-${String(excelDate.m).padStart(2, '0')}-${String(excelDate.d).padStart(2, '0')}`;
      } else {
        const ds = String(rawDate).trim();
        const brMatch = ds.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (brMatch) dateStr = `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
        else if (/^\d{4}-\d{2}-\d{2}$/.test(ds)) dateStr = ds;
      }
      if (!dateStr) continue;

      const cozinha = Number(row[cozinhaCol]) || 0;
      const salao = Number(row[salaoCol]) || 0;
      const tele = Number(row[teleCol]) || 0;

      for (let n = 0; n < cozinha; n++) entries.push({ id: generateEntryId(), date: dateStr, name: `FREE ${n + 1}`, sector: 'COZINHA', origin: 'consolidado' });
      for (let n = 0; n < salao; n++) entries.push({ id: generateEntryId(), date: dateStr, name: `FREE ${n + 1}`, sector: 'SALÃO', origin: 'consolidado' });
      for (let n = 0; n < tele; n++) entries.push({ id: generateEntryId(), date: dateStr, name: `FREE ${n + 1}`, sector: 'TELE - ENTREGA', origin: 'consolidado' });
    }

    return entries;
  };

  const handleFreeFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      if (raw.length < 2) {
        toast({ title: 'Planilha vazia ou sem dados.', variant: 'destructive' });
        return;
      }

      const normalize = (v: any) => String(v || '').trim().toUpperCase();
      let isModeloA = false;
      let isModeloB = false;

      for (let i = 0; i < Math.min(raw.length, 10); i++) {
        const row = raw[i];
        if (!row) continue;
        const headers = row.map(normalize);
        if (headers.some(h => h.includes('DATA')) && headers.some(h => h.includes('FREE') || h.includes('COZINHA'))) {
          isModeloA = true; break;
        }
        if (headers.some(h => h.includes('VENCIMENTO')) && headers.some(h => h.includes('DESCRI'))) {
          isModeloB = true; break;
        }
      }

      let entries: FreeReviewEntry[] = [];
      if (isModeloB) {
        entries = parseModeloBToEntries(raw);
      } else if (isModeloA) {
        entries = parseModeloAToEntries(raw);
      } else {
        toast({ title: 'Formato não reconhecido', description: 'Esperado: Modelo Consolidado ou Modelo Financeiro.', variant: 'destructive' });
        return;
      }

      if (entries.length === 0) {
        toast({ title: 'Nenhum free-lancer encontrado na planilha.', variant: 'destructive' });
        return;
      }

      setFreeReviewEntries(entries);
      setFreeReviewOpen(true);
    } catch (err: any) {
      toast({ title: `Erro ao ler arquivo: ${err.message}`, variant: 'destructive' });
    }
  };

  const handleConfirmFreeReview = async (reviewed: FreeReviewEntry[]) => {
    // Consolidate by date + sector
    const consolidated: Record<string, Record<string, number>> = {};
    for (const e of reviewed) {
      if (!e.sector) continue;
      if (!consolidated[e.date]) consolidated[e.date] = {};
      consolidated[e.date][e.sector] = (consolidated[e.date][e.sector] || 0) + 1;
    }

    const rows: { date: string; sector: string; quantity: number }[] = [];
    for (const [date, sectors] of Object.entries(consolidated)) {
      for (const [sector, qty] of Object.entries(sectors)) {
        rows.push({ date, sector, quantity: qty });
      }
    }

    if (rows.length === 0) {
      toast({ title: 'Nenhum free-lancer para importar', variant: 'destructive' });
      return;
    }

    try {
      // Save consolidated quantities
      await bulkFreeMut.mutateAsync(rows);
      // Save individual named entries for display in Escala
      const individualEntries = reviewed
        .filter(e => e.sector && e.name.trim() && e.date)
        .map(e => ({ date: e.date, sector: e.sector!, name: e.name.trim() }));
      if (individualEntries.length > 0) {
        await bulkFreeEntriesMut.mutateAsync(individualEntries);
      }
      const totalFrees = rows.reduce((s, r) => s + r.quantity, 0);
      toast({ title: 'Free-lancers importados com sucesso', description: `${totalFrees} free(s) em ${Object.keys(consolidated).length} dia(s)` });
      setFreeReviewOpen(false);
      setFreeReviewEntries([]);
    } catch (err: any) {
      toast({ title: 'Erro ao importar free-lancers', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" ref={printRef}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 no-print">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Produtividade por Colaborador</h1>
          <p className="text-sm text-muted-foreground">Análise operacional por setor e time</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-1" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-1" /> Imprimir
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="no-print">
        <CardContent className="py-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: 'Hoje', fn: () => { const t = new Date().toISOString().split('T')[0]; setStartDate(t); setEndDate(t); } },
                { label: 'Ontem', fn: () => { const d = new Date(); d.setDate(d.getDate() - 1); const t = d.toISOString().split('T')[0]; setStartDate(t); setEndDate(t); } },
                { label: '7 dias', fn: () => { const e = new Date(); const s = new Date(); s.setDate(s.getDate() - 6); setStartDate(s.toISOString().split('T')[0]); setEndDate(e.toISOString().split('T')[0]); } },
                { label: '15 dias', fn: () => { const e = new Date(); const s = new Date(); s.setDate(s.getDate() - 14); setStartDate(s.toISOString().split('T')[0]); setEndDate(e.toISOString().split('T')[0]); } },
                { label: '30 dias', fn: () => { const e = new Date(); const s = new Date(); s.setDate(s.getDate() - 29); setStartDate(s.toISOString().split('T')[0]); setEndDate(e.toISOString().split('T')[0]); } },
                { label: 'Mês atual', fn: () => { setStartDate(firstOfMonth); setEndDate(lastOfMonth); } },
              ].map(p => (
                <Button key={p.label} variant="outline" size="sm" className="h-7 text-xs px-3" onClick={p.fn}>
                  {p.label}
                </Button>
              ))}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data Inicial</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data Final</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-40" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data entry */}
      <Card className="no-print">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Dados de Vendas</CardTitle>
          <CardDescription className="text-xs">
            Cadastre manualmente ou importe planilha de vendas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileSelect}
            />
            <input
              ref={histFileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleHistFileSelect}
            />
            <input
              ref={freeFileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFreeFileSelect}
            />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-4 h-4 mr-1" /> Importar Vendas
            </Button>
            <Button variant="outline" size="sm" onClick={() => freeFileInputRef.current?.click()}>
              <Users className="w-4 h-4 mr-1" /> Importar Free-lancers
            </Button>
            <Button variant="outline" size="sm" onClick={() => histFileInputRef.current?.click()}>
              <History className="w-4 h-4 mr-1" /> Carga Histórica
            </Button>
            <Button size="sm" onClick={openNew}>
              <Plus className="w-4 h-4 mr-1" /> Cadastrar Dia
            </Button>
          </div>

          {/* Historical import description */}
          <div className="rounded-lg border border-border bg-muted/30 p-3 flex items-start gap-2">
            <History className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">Carga Histórica:</strong> use esta opção para carregar os dados históricos desde 23/02/2026 a partir do arquivo base preenchido. Cada linha da planilha (a partir da linha 2) corresponde a um dia sequencial.
            </p>
          </div>

          {/* Column mapping reference */}
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex items-start gap-2">
              <FileSpreadsheet className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
              <div className="text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Relatório canais de venda — mapeamento automático</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-0.5">
                  <span><strong>TOTAL QTD</strong> → Ped. Totais</span>
                  <span><strong>TOTAL</strong> → Fat. Total</span>
                  <span><strong>LOJA FÍSICA QTD</strong> → Ped. Salão</span>
                  <span><strong>LOJA FÍSICA</strong> → Fat. Salão</span>
                  <span><strong>DELIVERY + TELEFONE QTD</strong> → Ped. Tele</span>
                  <span><strong>DELIVERY + TELEFONE</strong> → Fat. Tele</span>
                </div>
                <p className="text-muted-foreground/70">Regra: TELE = DELIVERY + TELEFONE. As demais colunas são ignoradas.</p>
              </div>
            </div>
          </div>

          {salesData.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Fat. Total</TableHead>
                    <TableHead className="text-right">Ped. Total</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Fat. Salão</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Ped. Salão</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Fat. Tele</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Ped. Tele</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesData.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{formatDateBR(s.date)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(s.faturamento_total))}</TableCell>
                      <TableCell className="text-right">{Number(s.pedidos_totais)}</TableCell>
                      <TableCell className="text-right hidden sm:table-cell">{formatCurrency(Number(s.faturamento_salao))}</TableCell>
                      <TableCell className="text-right hidden sm:table-cell">{Number(s.pedidos_salao)}</TableCell>
                      <TableCell className="text-right hidden sm:table-cell">{formatCurrency(Number(s.faturamento_tele))}</TableCell>
                      <TableCell className="text-right hidden sm:table-cell">{Number(s.pedidos_tele)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(s)} className="p-1.5 rounded hover:bg-muted transition-colors">
                            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                          <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded hover:bg-destructive/10 transition-colors">
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {productivityRows.length > 0 && (
        <>
        <Tabs defaultValue="table" className="w-full">
          <TabsList className="no-print">
            <TabsTrigger value="table">Tabela</TabsTrigger>
            <TabsTrigger value="charts">Gráficos</TabsTrigger>
          </TabsList>

          <TabsContent value="table">
            <ProductivityTables
              currentRows={productivityRows}
              previousRows={prevProductivityRows}
              startDate={startDate}
              endDate={endDate}
            />
          </TabsContent>

          <TabsContent value="charts" className="space-y-6">
            {/* 1. Pedidos por colaborador do setor */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <CardTitle className="text-sm">Pedidos por colaborador do setor</CardTitle>
                  <ToggleGroup
                    type="single"
                    value={pcsSectorFilter}
                    onValueChange={v => v && setPcsSectorFilter(v)}
                    size="sm"
                    className="flex-wrap"
                  >
                    <ToggleGroupItem value="ALL" className="text-xs px-2 h-7">Todos</ToggleGroupItem>
                    <ToggleGroupItem value="COZINHA" className="text-xs px-2 h-7">Cozinha</ToggleGroupItem>
                    <ToggleGroupItem value="SALÃO" className="text-xs px-2 h-7">Salão</ToggleGroupItem>
                    <ToggleGroupItem value="TELE - ENTREGA" className="text-xs px-2 h-7">Tele</ToggleGroupItem>
                    <ToggleGroupItem value="DIURNO" className="text-xs px-2 h-7">Diurno</ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </CardHeader>
              <CardContent>
                {pcsSectorFilter === 'ALL' ? (
                  <ChartContainer config={tcsChartConfig} className="h-[300px] w-full">
                    <BarChart data={chartPCS}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Legend />
                      <Bar dataKey="COZINHA" fill={SECTOR_COLORS['COZINHA']} name="Cozinha" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="DIURNO" fill={SECTOR_COLORS['DIURNO']} name="Diurno" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="SALÃO" fill={SECTOR_COLORS['SALÃO']} name="Salão" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="TELE - ENTREGA" fill={SECTOR_COLORS['TELE - ENTREGA']} name="Tele-Entrega" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <ChartContainer config={{ [pcsSectorFilter]: { label: pcsSectorFilter, color: SECTOR_COLORS[pcsSectorFilter] || 'hsl(220, 15%, 25%)' } }} className="h-[320px] w-full">
                    <LineChart data={chartPCS} margin={{ top: 20, right: 20, bottom: 5, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line type="monotone" dataKey={pcsSectorFilter} stroke={SECTOR_COLORS[pcsSectorFilter] || 'hsl(220, 15%, 25%)'} strokeWidth={2} dot={{ r: 4, fill: SECTOR_COLORS[pcsSectorFilter] || 'hsl(220, 15%, 25%)' }} name={pcsSectorFilter}>
                        <LabelList
                          dataKey={pcsSectorFilter}
                          position="top"
                          offset={10}
                          formatter={(v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          style={{ fontSize: 10, fontWeight: 600, fill: SECTOR_COLORS[pcsSectorFilter] || 'hsl(220, 15%, 25%)' }}
                        />
                      </Line>
                    </LineChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            {/* 2. Ticket por colaborador do setor */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <CardTitle className="text-sm">Ticket por colaborador do setor</CardTitle>
                  <ToggleGroup
                    type="single"
                    value={tmpSectorFilter}
                    onValueChange={v => v && setTmpSectorFilter(v)}
                    size="sm"
                    className="flex-wrap"
                  >
                    <ToggleGroupItem value="ALL" className="text-xs px-2 h-7">Todos</ToggleGroupItem>
                    <ToggleGroupItem value="COZINHA" className="text-xs px-2 h-7">Cozinha</ToggleGroupItem>
                    <ToggleGroupItem value="SALÃO" className="text-xs px-2 h-7">Salão</ToggleGroupItem>
                    <ToggleGroupItem value="TELE - ENTREGA" className="text-xs px-2 h-7">Tele</ToggleGroupItem>
                    <ToggleGroupItem value="DIURNO" className="text-xs px-2 h-7">Diurno</ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </CardHeader>
              <CardContent>
                {tmpSectorFilter === 'ALL' ? (
                  <ChartContainer config={tcsChartConfig} className="h-[300px] w-full">
                    <BarChart data={chartTCS}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Legend />
                      <Bar dataKey="COZINHA" fill={SECTOR_COLORS['COZINHA']} name="Cozinha" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="DIURNO" fill={SECTOR_COLORS['DIURNO']} name="Diurno" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="SALÃO" fill={SECTOR_COLORS['SALÃO']} name="Salão" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="TELE - ENTREGA" fill={SECTOR_COLORS['TELE - ENTREGA']} name="Tele-Entrega" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <ChartContainer config={{ [tmpSectorFilter]: { label: tmpSectorFilter, color: SECTOR_COLORS[tmpSectorFilter] || 'hsl(220, 15%, 25%)' } }} className="h-[320px] w-full">
                    <LineChart data={chartTCS} margin={{ top: 20, right: 20, bottom: 5, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line type="monotone" dataKey={tmpSectorFilter} stroke={SECTOR_COLORS[tmpSectorFilter] || 'hsl(220, 15%, 25%)'} strokeWidth={2} dot={{ r: 4, fill: SECTOR_COLORS[tmpSectorFilter] || 'hsl(220, 15%, 25%)' }} name={tmpSectorFilter}>
                        <LabelList
                          dataKey={tmpSectorFilter}
                          position="top"
                          offset={10}
                          formatter={(v: number) => `R$ ${Math.round(v).toLocaleString('pt-BR')}`}
                          style={{ fontSize: 10, fontWeight: 600, fill: SECTOR_COLORS[tmpSectorFilter] || 'hsl(220, 15%, 25%)' }}
                        />
                      </Line>
                    </LineChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            {/* 3. Pedidos por colaborador do time */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Pedidos por colaborador do time</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={pctChartConfig} className="h-[320px] w-full">
                  <LineChart data={chartPCT} margin={{ top: 20, right: 20, bottom: 5, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="PCT" stroke="hsl(160, 60%, 45%)" strokeWidth={2.5} dot={{ r: 4, fill: 'hsl(160, 60%, 45%)' }} name="PCT">
                      <LabelList
                        dataKey="PCT"
                        position="top"
                        offset={10}
                        formatter={(v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        style={{ fontSize: 10, fontWeight: 600, fill: 'hsl(160, 60%, 45%)' }}
                      />
                    </Line>
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* 4. Ticket por colaborador do time */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Ticket por colaborador do time</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={tctChartConfig} className="h-[320px] w-full">
                  <LineChart data={chartTCT} margin={{ top: 20, right: 20, bottom: 5, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="TCT" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4, fill: 'hsl(var(--primary))' }} name="TCT">
                      <LabelList
                        dataKey="TCT"
                        position="top"
                        offset={10}
                        formatter={(v: number) => `R$ ${Math.round(v).toLocaleString('pt-BR')}`}
                        style={{ fontSize: 10, fontWeight: 600, fill: 'hsl(var(--primary))' }}
                      />
                    </Line>
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Legenda dos Indicadores */}
        <IndicatorLegend className="print-block" />
        </>
      )}

      {productivityRows.length === 0 && !isLoading && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum dado de vendas cadastrado para o período selecionado.
            <br />
            Importe uma planilha ou cadastre manualmente.
          </CardContent>
        </Card>
      )}

      {/* Manual Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Dados de Vendas do Dia</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Data</Label>
              <Input
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Faturamento Total</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.faturamento_total || ''}
                  onChange={e => setForm(f => ({ ...f, faturamento_total: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Pedidos Totais</Label>
                <Input
                  type="number"
                  value={form.pedidos_totais || ''}
                  onChange={e => setForm(f => ({ ...f, pedidos_totais: Number(e.target.value) }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Faturamento Salão</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.faturamento_salao || ''}
                  onChange={e => setForm(f => ({ ...f, faturamento_salao: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Pedidos Salão</Label>
                <Input
                  type="number"
                  value={form.pedidos_salao || ''}
                  onChange={e => setForm(f => ({ ...f, pedidos_salao: Number(e.target.value) }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Faturamento Tele</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.faturamento_tele || ''}
                  onChange={e => setForm(f => ({ ...f, faturamento_tele: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Pedidos Tele</Label>
                <Input
                  type="number"
                  value={form.pedidos_tele || ''}
                  onChange={e => setForm(f => ({ ...f, pedidos_tele: Number(e.target.value) }))}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit">Salvar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Import Preview Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              Pré-visualização da Importação
            </DialogTitle>
            <DialogDescription>
              Revise os dados extraídos antes de importar.
            </DialogDescription>
          </DialogHeader>

          {importError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-sm text-destructive">{importError}</p>
            </div>
          )}

          {/* Store selector when multiple stores found */}
          {importStores.length > 1 && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
              <p className="text-xs font-medium text-foreground">
                Múltiplas lojas encontradas. Selecione a loja para importar:
              </p>
              <div className="flex flex-wrap gap-2">
                {importStores.map(store => (
                  <Button
                    key={store.name}
                    variant={importPreview.length > 0 && importPreview[0].pedidos_totais === Number(store.row[importColMap['TOTAL QTD']] || 0) ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs"
                    onClick={() => handleSelectStore(store.name)}
                  >
                    {store.name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {importPreview.length > 0 && (
            <div className="space-y-4">
              {/* Date input when file has no dates */}
              {hasRowsWithoutDate && (
                <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Informe a data referente a esses dados:
                  </p>
                  <Input
                    type="date"
                    value={importDate}
                    onChange={e => setImportDate(e.target.value)}
                    className="w-48"
                  />
                </div>
              )}

              {/* Validation warning */}
              {importValidationWarning && (
                <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 shrink-0" />
                  <div className="text-sm text-yellow-700">
                    <p className="font-medium">Atenção: os valores não conferem</p>
                    <p className="text-xs mt-1">{importValidationWarning}</p>
                    <p className="text-xs mt-1 text-muted-foreground">Revise os dados antes de confirmar. A importação ainda pode ser realizada.</p>
                  </div>
                </div>
              )}

              {/* Interpreted data preview */}
              <div className="rounded-lg border border-border p-3 space-y-2">
                <p className="text-xs font-medium text-foreground">Dados interpretados:</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                  <span className="text-muted-foreground">Pedidos totais:</span>
                  <span className="font-medium tabular-nums">{importPreview[0].pedidos_totais}</span>
                  <span className="text-muted-foreground">Faturamento total:</span>
                  <span className="font-medium tabular-nums">R$ {formatCurrency(importPreview[0].faturamento_total)}</span>
                  <span className="text-muted-foreground">Pedidos salão:</span>
                  <span className="font-medium tabular-nums">{importPreview[0].pedidos_salao}</span>
                  <span className="text-muted-foreground">Faturamento salão:</span>
                  <span className="font-medium tabular-nums">R$ {formatCurrency(importPreview[0].faturamento_salao)}</span>
                  <span className="text-muted-foreground">Pedidos tele:</span>
                  <span className="font-medium tabular-nums">{importPreview[0].pedidos_tele}</span>
                  <span className="text-muted-foreground">Faturamento tele:</span>
                  <span className="font-medium tabular-nums">R$ {formatCurrency(importPreview[0].faturamento_tele)}</span>
                </div>
              </div>

              {/* Column mapping reminder */}
              <div className="text-xs text-muted-foreground grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-0.5 px-1">
                <span><strong>TOTAL QTD</strong> → Ped. Total</span>
                <span><strong>TOTAL</strong> → Fat. Total</span>
                <span><strong>LOJA FÍSICA</strong> → Salão</span>
                <span><strong>DELIVERY+TEL</strong> → Tele</span>
              </div>

              {importPreview.some(r => r.errors.length > 0) && (
                <div className="text-xs text-destructive space-y-0.5">
                  {importPreview.flatMap((r, i) =>
                    r.errors.map((err, j) => (
                      <p key={`${i}-${j}`}>{err}</p>
                    ))
                  )}
                </div>
              )}

              <div className="flex justify-between items-center pt-2">
                <span className="text-xs text-muted-foreground">
                  {!importValidationWarning ? '✓ Conferência OK' : '⚠ Conferência com divergência'}
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleConfirmImport}
                    disabled={importPreview.filter(r => r.errors.length === 0).length === 0}
                  >
                    <Check className="w-4 h-4 mr-1" /> Confirmar Importação
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Historical Import Dialog */}
      <Dialog open={histDialogOpen} onOpenChange={setHistDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Carga Histórica Inicial
            </DialogTitle>
            <DialogDescription>
              Importação de dados retroativos desde 23/02/2026. Cada linha da planilha corresponde a um dia sequencial.
            </DialogDescription>
          </DialogHeader>

          {histError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-sm text-destructive">{histError}</p>
            </div>
          )}

          {histPreview.length > 0 && (
            <div className="space-y-4">
              {histExistingDates.length > 0 && (
                <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 shrink-0" />
                  <div className="text-sm text-yellow-700">
                    <p className="font-medium">Atenção: {histExistingDates.length} dia(s) já possuem dados cadastrados.</p>
                    <p className="text-xs mt-1">Os dados existentes serão sobrescritos ao confirmar a importação.</p>
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                <p><strong>{histPreview.length}</strong> dias detectados: <strong>{formatDateBR(histPreview[0].date)}</strong> até <strong>{formatDateBR(histPreview[histPreview.length - 1].date)}</strong></p>
                <p className="mt-1">Linha 2 = 23/02/2026, incrementando 1 dia por linha.</p>
              </div>

              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Data</TableHead>
                      <TableHead className="text-xs text-right">Ped. Total (B)</TableHead>
                      <TableHead className="text-xs text-right">Fat. Total (C)</TableHead>
                      <TableHead className="text-xs text-right">Ped. Tele (D)</TableHead>
                      <TableHead className="text-xs text-right">Fat. Tele (E)</TableHead>
                      <TableHead className="text-xs text-right">Ped. Salão (H)</TableHead>
                      <TableHead className="text-xs text-right">Fat. Salão (I)</TableHead>
                      <TableHead className="text-xs w-8"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {histPreview.map((row, idx) => (
                      <TableRow
                        key={idx}
                        className={`${row.errors.length > 0 ? 'bg-destructive/5' : ''} ${histExistingDates.includes(row.date) ? 'bg-yellow-500/5' : ''}`}
                      >
                        <TableCell className="text-xs font-medium">
                          {formatDateBR(row.date)}
                          {histExistingDates.includes(row.date) && (
                            <span className="ml-1 text-yellow-600" title="Dados existentes serão sobrescritos">⚠</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{row.pedidos_totais}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{formatCurrency(row.faturamento_total)}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{row.pedidos_tele}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{formatCurrency(row.faturamento_tele)}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{row.pedidos_salao}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{formatCurrency(row.faturamento_salao)}</TableCell>
                        <TableCell>
                          {row.errors.length > 0 ? (
                            <span title={row.errors.join('; ')}><AlertCircle className="w-3.5 h-3.5 text-destructive" /></span>
                          ) : (
                            <Check className="w-3.5 h-3.5 text-green-600" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className="text-xs text-muted-foreground">
                  {histPreview.filter(r => r.errors.length === 0).length} de {histPreview.length} linha(s) válida(s)
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setHistDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleConfirmHistImport}
                    disabled={histPreview.filter(r => r.errors.length === 0).length === 0}
                  >
                    <Check className="w-4 h-4 mr-1" /> Confirmar Carga Histórica
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Freelancer Import Review Dialog */}
      <FreelancerImportReviewDialog
        open={freeReviewOpen}
        onOpenChange={setFreeReviewOpen}
        entries={freeReviewEntries}
        onConfirm={handleConfirmFreeReview}
        isPending={bulkFreeMut.isPending}
      />
    </div>
  );
}
