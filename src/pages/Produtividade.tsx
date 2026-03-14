import { useState, useMemo, useRef } from 'react';
import { useCollaborators } from '@/hooks/useCollaborators';
import { useDailySales, useUpsertDailySales, useBulkInsertDailySales, useDeleteDailySales, type DailySalesInput } from '@/hooks/useDailySales';
import { generateProductivityData, formatCurrency, formatDecimal, formatDateBR, getSectorOrder } from '@/lib/productivityEngine';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { useToast } from '@/hooks/use-toast';
import { Download, Printer, Upload, Plus, Pencil, Trash2, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, ResponsiveContainer, Legend } from 'recharts';
import * as XLSX from 'xlsx';

const SECTOR_COLORS: Record<string, string> = {
  'COZINHA': 'hsl(220, 15%, 25%)',
  'DIURNO': 'hsl(220, 10%, 45%)',
  'SALÃO': 'hsl(220, 8%, 65%)',
  'TELE - ENTREGA': 'hsl(220, 5%, 80%)',
};

export default function Produtividade() {
  const now = new Date();
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const lastOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`;

  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(lastOfMonth);
  const [dialogOpen, setDialogOpen] = useState(false);
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
  const { toast } = useToast();

  const { data: collaborators = [] } = useCollaborators();
  const { data: salesData = [], isLoading } = useDailySales(startDate, endDate);
  const upsertMut = useUpsertDailySales();
  const bulkMut = useBulkInsertDailySales();
  const deleteMut = useDeleteDailySales();

  const productivityRows = useMemo(
    () => generateProductivityData(salesData, collaborators),
    [salesData, collaborators]
  );

  // Group by date for table rendering
  const groupedByDate = useMemo(() => {
    const map = new Map<string, typeof productivityRows>();
    for (const row of productivityRows) {
      if (!map.has(row.date)) map.set(row.date, []);
      map.get(row.date)!.push(row);
    }
    // Sort sectors within each date
    for (const [, rows] of map) {
      rows.sort((a, b) => getSectorOrder(a.sector) - getSectorOrder(b.sector));
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [productivityRows]);

  // Chart data
  const chartTMP = useMemo(() => {
    const dates = [...new Set(productivityRows.map(r => r.date))].sort();
    return dates.map(date => {
      const row: Record<string, any> = { date: formatDateBR(date) };
      for (const r of productivityRows.filter(r => r.date === date)) {
        if (['COZINHA', 'DIURNO', 'SALÃO', 'TELE - ENTREGA'].includes(r.sector)) {
          row[r.sector] = Math.round(r.tmp * 100) / 100;
        }
      }
      return row;
    });
  }, [productivityRows]);

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

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws);

      const mapped: DailySalesInput[] = rows
        .map(row => {
          let dateVal = row['data'] || row['Data'] || row['date'] || '';
          // Handle Excel serial dates
          if (typeof dateVal === 'number') {
            const d = XLSX.SSF.parse_date_code(dateVal);
            dateVal = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
          } else if (typeof dateVal === 'string' && dateVal.includes('/')) {
            const parts = dateVal.split('/');
            if (parts.length === 3) {
              dateVal = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
          }
          return {
            date: String(dateVal),
            faturamento_total: Number(row['faturamento_total'] || row['Faturamento Total'] || 0),
            pedidos_totais: Number(row['pedidos_totais'] || row['Pedidos Totais'] || 0),
            faturamento_salao: Number(row['faturamento_salao'] || row['Faturamento Salão'] || row['Faturamento Salao'] || 0),
            pedidos_salao: Number(row['pedidos_salao'] || row['Pedidos Salão'] || row['Pedidos Salao'] || 0),
            faturamento_tele: Number(row['faturamento_tele'] || row['Faturamento Tele'] || 0),
            pedidos_tele: Number(row['pedidos_tele'] || row['Pedidos Tele'] || 0),
          };
        })
        .filter(r => r.date && r.date.length >= 8);

      if (mapped.length === 0) {
        toast({ title: 'Nenhum dado encontrado', variant: 'destructive' });
        return;
      }
      await bulkMut.mutateAsync(mapped);
      toast({ title: `${mapped.length} dias importados` });
    } catch {
      toast({ title: 'Erro ao importar', variant: 'destructive' });
    }
    e.target.value = '';
  };

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
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <label className="cursor-pointer">
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
              <Button variant="outline" size="sm" asChild>
                <span><Upload className="w-4 h-4 mr-1" /> Importar Planilha</span>
              </Button>
            </label>
            <Button size="sm" onClick={openNew}>
              <Plus className="w-4 h-4 mr-1" /> Cadastrar Dia
            </Button>
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
            {/* TMP Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">TMP — Ticket Médio por Pessoa</CardTitle>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>

            {/* PPP Chart */}
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

            {/* TMT Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">TMT — Ticket Médio do Time</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={tmtChartConfig} className="h-[300px] w-full">
                  <LineChart data={chartTMT}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="TMT" stroke="hsl(220, 15%, 25%)" strokeWidth={2} dot={{ r: 4 }} name="TMT" />
                  </LineChart>
                </ChartContainer>
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

      {/* Form Dialog */}
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
    </div>
  );
}
