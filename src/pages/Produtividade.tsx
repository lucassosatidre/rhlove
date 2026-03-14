import { useState, useMemo, useRef } from 'react';
import { useCollaborators } from '@/hooks/useCollaborators';
import { useDailySales, useUpsertDailySales, useBulkInsertDailySales, useDeleteDailySales, type DailySalesInput } from '@/hooks/useDailySales';
import { useFreelancers } from '@/hooks/useFreelancers';
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
import { Download, Printer, Upload, Plus, Pencil, Trash2, BarChart3, FileSpreadsheet, AlertCircle, Check, History } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, Legend, LabelList } from 'recharts';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import * as XLSX from 'xlsx';

const SECTOR_COLORS: Record<string, string> = {
  'COZINHA': 'hsl(220, 15%, 25%)',
  'DIURNO': 'hsl(220, 10%, 45%)',
  'SALÃO': 'hsl(220, 8%, 65%)',
  'TELE - ENTREGA': 'hsl(220, 5%, 80%)',
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
  const { toast } = useToast();

  const { data: collaborators = [] } = useCollaborators();
  const { data: salesData = [], isLoading } = useDailySales(startDate, endDate);
  const { data: freelancersData = [] } = useFreelancers(startDate, endDate);
  const upsertMut = useUpsertDailySales();
  const bulkMut = useBulkInsertDailySales();
  const deleteMut = useDeleteDailySales();

  const productivityRows = useMemo(
    () => generateProductivityData(salesData, collaborators, freelancersData),
    [salesData, collaborators, freelancersData]
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

  const chartTMP = useMemo(() => {
    const sectors = tmpSectorFilter === 'ALL'
      ? ['COZINHA', 'DIURNO', 'SALÃO', 'TELE - ENTREGA']
      : [tmpSectorFilter];
    const dates = [...new Set(productivityRows.map(r => r.date))].sort();
    return dates.map(date => {
      const row: Record<string, any> = { date: formatDateBR(date) };
      for (const r of productivityRows.filter(r => r.date === date)) {
        if (sectors.includes(r.sector)) {
          row[r.sector] = Math.round(r.tmp * 100) / 100;
        }
      }
      return row;
    });
  }, [productivityRows, tmpSectorFilter]);

  const chartPPP = useMemo(() => {
    const dates = [...new Set(productivityRows.map(r => r.date))].sort();
    return dates.map(date => {
      const row: Record<string, any> = { date: formatDateBR(date) };
      for (const r of productivityRows.filter(r => r.date === date)) {
        if (['COZINHA', 'DIURNO', 'SALÃO', 'TELE - ENTREGA'].includes(r.sector)) {
          row[r.sector] = Math.round(r.ppp * 100) / 100;
        }
      }
      return row;
    });
  }, [productivityRows]);

  const chartTMT = useMemo(() => {
    const dates = [...new Set(productivityRows.map(r => r.date))].sort();
    return dates.map(date => {
      const tmtRow = productivityRows.find(r => r.date === date && r.sector === 'TMT');
      return {
        date: formatDateBR(date),
        TMT: tmtRow ? Math.round(tmtRow.tmp * 100) / 100 : 0,
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

  // ====== NEW IMPORT LOGIC: read by column position ======
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError('');
    setImportPreview([]);

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];

      // Read as array of arrays (raw, by position)
      const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      if (raw.length < 2) {
        setImportError('Planilha vazia ou sem dados. Esperado ao menos 1 linha de cabeçalho + 1 de dados.');
        setImportDialogOpen(true);
        return;
      }

      // Skip header (row 0), read data rows
      const preview: ImportPreviewRow[] = [];

      for (let i = 1; i < raw.length; i++) {
        const row = raw[i];
        if (!row || row.length === 0) continue;

        // Check if row has any meaningful data (at least column B)
        const colB = row[1]; // B = index 1 = total pedidos
        const colC = row[2]; // C = index 2 = total vendas
        const colD = row[3]; // D = index 3 = pedidos tele
        const colE = row[4]; // E = index 4 = vendas tele
        const colH = row[7]; // H = index 7 = pedidos salão
        const colI = row[8]; // I = index 8 = vendas salão

        // Skip rows where key columns are all empty
        if (!colB && !colC && !colD && !colE && !colH && !colI) continue;
        // Skip "TOTAL" summary rows
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

        // Try to extract date from column A
        let dateStr = '';
        const colAVal = row[0];
        if (colAVal) {
          if (typeof colAVal === 'number' && colAVal > 30000) {
            // Excel serial date
            const d = XLSX.SSF.parse_date_code(colAVal);
            dateStr = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
          } else if (typeof colAVal === 'string') {
            const cleaned = colAVal.trim();
            // Try DD/MM/YYYY
            const parts = cleaned.split('/');
            if (parts.length === 3 && parts[0].length <= 2) {
              dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
            // Try YYYY-MM-DD
            else if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
              dateStr = cleaned;
            }
          } else if (colAVal instanceof Date) {
            dateStr = colAVal.toISOString().split('T')[0];
          }
        }

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
        setImportError('Nenhuma linha de dados válida encontrada na planilha.');
      }

      setImportPreview(preview);
      setImportDialogOpen(true);
    } catch {
      setImportError('Erro ao ler a planilha. Verifique se o arquivo é um Excel válido.');
      setImportDialogOpen(true);
    }

    e.target.value = '';
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
        'Nº Pessoas': r.numero_pessoas,
        TMP: r.tmp ? Math.round(r.tmp * 100) / 100 : '',
        PPP: r.ppp ? Math.round(r.ppp * 100) / 100 : '',
      }))
    );
    const ws = XLSX.utils.json_to_sheet(exportRows);
    XLSX.utils.book_append_sheet(wb, ws, 'Produtividade');
    XLSX.writeFile(wb, `Produtividade_${startDate}_${endDate}.xlsx`);
  };

  const handlePrint = () => window.print();

  const isSummaryRow = (sector: string) => sector === 'TIME' || sector === 'TMT';

  const tmpChartConfig = {
    COZINHA: { label: 'Cozinha', color: SECTOR_COLORS['COZINHA'] },
    DIURNO: { label: 'Diurno', color: SECTOR_COLORS['DIURNO'] },
    'SALÃO': { label: 'Salão', color: SECTOR_COLORS['SALÃO'] },
    'TELE - ENTREGA': { label: 'Tele-Entrega', color: SECTOR_COLORS['TELE - ENTREGA'] },
  };

  const tmtChartConfig = {
    TMT: { label: 'TMT', color: 'hsl(220, 15%, 25%)' },
  };

  return (
    <div className="space-y-6 animate-fade-in" ref={printRef}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 no-print">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Produtividade por Pessoa</h1>
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
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-4 h-4 mr-1" /> Importar Planilha
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
                <p className="font-medium text-foreground">Mapeamento de colunas da planilha</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-0.5">
                  <span><strong>B</strong> = Total de pedidos</span>
                  <span><strong>C</strong> = Total de vendas</span>
                  <span><strong>D</strong> = Pedidos tele-entrega</span>
                  <span><strong>E</strong> = Vendas tele-entrega</span>
                  <span><strong>H</strong> = Pedidos salão</span>
                  <span><strong>I</strong> = Vendas salão</span>
                </div>
                <p className="text-muted-foreground/70">As demais colunas são ignoradas. Linha 1 = cabeçalho.</p>
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
        <Tabs defaultValue="table" className="w-full">
          <TabsList className="no-print">
            <TabsTrigger value="table">Tabela</TabsTrigger>
            <TabsTrigger value="charts">Gráficos</TabsTrigger>
          </TabsList>

          <TabsContent value="table">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Produtividade por Pessoa
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="font-bold">Data</TableHead>
                        <TableHead className="font-bold">Setor</TableHead>
                        <TableHead className="text-right font-bold">Vendas</TableHead>
                        <TableHead className="text-right font-bold">Pedidos</TableHead>
                        <TableHead className="text-right font-bold">Nº Pessoas</TableHead>
                        <TableHead className="text-right font-bold">TMP</TableHead>
                        <TableHead className="text-right font-bold">PPP</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupedByDate.map(([date, rows], dateIdx) => (
                        rows.map((row, rowIdx) => (
                          <TableRow
                            key={`${date}-${row.sector}`}
                            className={`${
                              isSummaryRow(row.sector)
                                ? 'bg-muted/60 font-semibold border-t-2 border-border'
                                : ''
                            } ${
                              row.sector === 'TMT' && dateIdx < groupedByDate.length - 1
                                ? 'border-b-4 border-border'
                                : ''
                            }`}
                          >
                            <TableCell className="font-medium">
                              {rowIdx === 0 ? formatDateBR(row.date) : ''}
                            </TableCell>
                            <TableCell className={`${isSummaryRow(row.sector) ? 'font-bold' : ''}`}>
                              {row.sector}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.vendas ? formatCurrency(row.vendas) : '-'}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.pedidos ? row.pedidos : '-'}
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-medium">
                              {row.numero_pessoas || '-'}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.tmp ? formatCurrency(row.tmp) : '-'}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.ppp ? formatDecimal(row.ppp) : '-'}
                            </TableCell>
                          </TableRow>
                        ))
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="charts" className="space-y-6">
            {/* 1. PPP */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">PPP — Pedidos por Pessoa</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={tmpChartConfig} className="h-[300px] w-full">
                  <BarChart data={chartPPP}>
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
              </CardContent>
            </Card>

            {/* 2. TMT with permanent labels */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">TMT — Ticket Médio do Time</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={tmtChartConfig} className="h-[320px] w-full">
                  <LineChart data={chartTMT} margin={{ top: 20, right: 20, bottom: 5, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="TMT" stroke="hsl(220, 15%, 25%)" strokeWidth={2} dot={{ r: 4, fill: 'hsl(220, 15%, 25%)' }} name="TMT">
                      <LabelList
                        dataKey="TMT"
                        position="top"
                        offset={10}
                        formatter={(v: number) => `R$ ${Math.round(v).toLocaleString('pt-BR')}`}
                        style={{ fontSize: 10, fontWeight: 600, fill: 'hsl(220, 15%, 25%)' }}
                      />
                    </Line>
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* 3. TMP with sector filter */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <CardTitle className="text-sm">TMP — Ticket Médio por Pessoa</CardTitle>
                  <ToggleGroup
                    type="single"
                    value={tmpSectorFilter}
                    onValueChange={v => v && setTmpSectorFilter(v)}
                    size="sm"
                    className="flex-wrap"
                  >
                    <ToggleGroupItem value="ALL" className="text-xs px-2 h-7">Todos</ToggleGroupItem>
                    <ToggleGroupItem value="COZINHA" className="text-xs px-2 h-7">Cozinha</ToggleGroupItem>
                    <ToggleGroupItem value="DIURNO" className="text-xs px-2 h-7">Diurno</ToggleGroupItem>
                    <ToggleGroupItem value="SALÃO" className="text-xs px-2 h-7">Salão</ToggleGroupItem>
                    <ToggleGroupItem value="TELE - ENTREGA" className="text-xs px-2 h-7">Tele</ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </CardHeader>
              <CardContent>
                {tmpSectorFilter === 'ALL' ? (
                  <ChartContainer config={tmpChartConfig} className="h-[300px] w-full">
                    <BarChart data={chartTMP}>
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
                    <LineChart data={chartTMP} margin={{ top: 20, right: 20, bottom: 5, left: 10 }}>
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
          </TabsContent>
        </Tabs>
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

          {importPreview.length > 0 && (
            <div className="space-y-4">
              {/* Date input when file has no dates */}
              {hasRowsWithoutDate && (
                <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    A planilha não contém data na coluna A. Informe a data referente a esses dados:
                  </p>
                  <Input
                    type="date"
                    value={importDate}
                    onChange={e => setImportDate(e.target.value)}
                    className="w-48"
                  />
                </div>
              )}

              {/* Column mapping reminder */}
              <div className="text-xs text-muted-foreground grid grid-cols-3 gap-x-4 gap-y-0.5 px-1">
                <span><strong>B</strong> → Ped. Total</span>
                <span><strong>C</strong> → Fat. Total</span>
                <span><strong>D</strong> → Ped. Tele</span>
                <span><strong>E</strong> → Fat. Tele</span>
                <span><strong>H</strong> → Ped. Salão</span>
                <span><strong>I</strong> → Fat. Salão</span>
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
                    {importPreview.map((row, idx) => (
                      <TableRow key={idx} className={row.errors.length > 0 ? 'bg-destructive/5' : ''}>
                        <TableCell className="text-xs font-medium">
                          {row.date ? formatDateBR(row.date) : (
                            <span className="text-muted-foreground italic">
                              {hasRowsWithoutDate ? importDate.split('-').reverse().join('/').slice(0, 5) : '—'}
                            </span>
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
                            <Check className="w-3.5 h-3.5 text-success" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {importPreview.some(r => r.errors.length > 0) && (
                <div className="text-xs text-destructive space-y-0.5">
                  {importPreview.flatMap((r, i) =>
                    r.errors.map((err, j) => (
                      <p key={`${i}-${j}`}>Linha {i + 2}: {err}</p>
                    ))
                  )}
                </div>
              )}

              <div className="flex justify-between items-center pt-2">
                <span className="text-xs text-muted-foreground">
                  {importPreview.filter(r => r.errors.length === 0).length} de {importPreview.length} linha(s) válida(s)
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
    </div>
  );
}
