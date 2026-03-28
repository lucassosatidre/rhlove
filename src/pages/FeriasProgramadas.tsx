import { useState, useMemo } from 'react';
import { useAfastamentos, type Afastamento } from '@/hooks/useAfastamentos';
import {
  useScheduledVacations,
  useCreateScheduledVacation,
  useUpdateScheduledVacation,
  useDeleteScheduledVacation,
  computeVacationStatus,
  type ScheduledVacation,
  type ScheduledVacationInput,
} from '@/hooks/useScheduledVacations';
import { useCollaborators } from '@/hooks/useCollaborators';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Download, XCircle, CalendarDays } from 'lucide-react';
import * as XLSX from 'xlsx';

const STATUS_LABELS: Record<string, string> = {
  PROGRAMADA: 'Programada',
  EM_ANDAMENTO: 'Em Andamento',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada',
};

const STATUS_COLORS: Record<string, string> = {
  PROGRAMADA: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  EM_ANDAMENTO: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  CONCLUIDA: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  CANCELADA: 'bg-gray-100 text-gray-500 dark:bg-gray-900/30 dark:text-gray-400',
};

function formatDateBR(dateStr: string) {
  if (!dateStr) return '-';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

interface FormData {
  collaborator_id: string;
  data_inicio_ferias: string;
  data_fim_ferias: string;
  data_pagamento_ferias: string;
  observacao: string;
}

const emptyForm: FormData = {
  collaborator_id: '',
  data_inicio_ferias: '',
  data_fim_ferias: '',
  data_pagamento_ferias: '',
  observacao: '',
};

function calcPayDate(startDate: string): string {
  if (!startDate) return '';
  const d = new Date(startDate + 'T00:00:00');
  d.setDate(d.getDate() - 3);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function FeriasProgramadas() {
  const { data: vacations = [], isLoading } = useScheduledVacations();
  const { data: collaborators = [] } = useCollaborators();
  const createMut = useCreateScheduledVacation();
  const updateMut = useUpdateScheduledVacation();
  const deleteMut = useDeleteScheduledVacation();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);

  // Filters
  const [filterSector, setFilterSector] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterMonth, setFilterMonth] = useState('ALL');

  // Active collaborators only (not DESLIGADO)
  const activeCollaborators = useMemo(
    () => collaborators.filter(c => c.status !== 'DESLIGADO'),
    [collaborators]
  );

  const selectedCollab = useMemo(
    () => collaborators.find(c => c.id === form.collaborator_id),
    [collaborators, form.collaborator_id]
  );

  // Enrich vacations with computed status
  const enrichedVacations = useMemo(
    () => vacations.map(v => ({ ...v, computedStatus: computeVacationStatus(v) })),
    [vacations]
  );

  // Available months from data
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    for (const v of vacations) {
      const [y, m] = v.data_inicio_ferias.split('-');
      months.add(`${y}-${m}`);
    }
    return [...months].sort();
  }, [vacations]);

  // Sectors from data
  const availableSectors = useMemo(() => {
    const sectors = new Set<string>();
    for (const v of vacations) sectors.add(v.sector);
    return [...sectors].sort();
  }, [vacations]);

  // Filter
  const filtered = useMemo(() => {
    return enrichedVacations.filter(v => {
      if (filterSector !== 'ALL' && v.sector !== filterSector) return false;
      if (filterStatus !== 'ALL' && v.computedStatus !== filterStatus) return false;
      if (filterMonth !== 'ALL') {
        const [y, m] = v.data_inicio_ferias.split('-');
        if (`${y}-${m}` !== filterMonth) return false;
      }
      return true;
    });
  }, [enrichedVacations, filterSector, filterStatus, filterMonth]);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (v: ScheduledVacation) => {
    setEditingId(v.id);
    setForm({
      collaborator_id: v.collaborator_id,
      data_inicio_ferias: v.data_inicio_ferias,
      data_fim_ferias: v.data_fim_ferias,
      data_pagamento_ferias: v.data_pagamento_ferias || calcPayDate(v.data_inicio_ferias),
      observacao: v.observacao || '',
    });
    setDialogOpen(true);
  };

  const validate = (): string | null => {
    if (!form.collaborator_id) return 'Selecione um colaborador';
    if (!form.data_inicio_ferias) return 'Data de início obrigatória';
    if (!form.data_fim_ferias) return 'Data de fim obrigatória';
    if (form.data_fim_ferias < form.data_inicio_ferias) return 'Data fim deve ser posterior à data início';

    const collab = collaborators.find(c => c.id === form.collaborator_id);
    if (!collab) return 'Colaborador não encontrado';
    if (collab.status === 'DESLIGADO') return 'Colaborador está desligado';
    if (collab.inicio_na_empresa && form.data_inicio_ferias < collab.inicio_na_empresa) {
      return 'Período de férias começa antes do início na empresa';
    }

    // Check overlap
    const overlapping = vacations.find(v => {
      if (v.collaborator_id !== form.collaborator_id) return false;
      if (v.status === 'CANCELADA') return false;
      if (editingId && v.id === editingId) return false;
      return form.data_inicio_ferias <= v.data_fim_ferias && form.data_fim_ferias >= v.data_inicio_ferias;
    });
    if (overlapping) return `Sobreposição com férias de ${formatDateBR(overlapping.data_inicio_ferias)} a ${formatDateBR(overlapping.data_fim_ferias)}`;

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const error = validate();
    if (error) {
      toast({ title: error, variant: 'destructive' });
      return;
    }

    const collab = collaborators.find(c => c.id === form.collaborator_id)!;
    const input: ScheduledVacationInput = {
      collaborator_id: form.collaborator_id,
      collaborator_name: collab.collaborator_name,
      sector: collab.sector,
      data_inicio_ferias: form.data_inicio_ferias,
      data_fim_ferias: form.data_fim_ferias,
      data_pagamento_ferias: form.data_pagamento_ferias || calcPayDate(form.data_inicio_ferias),
      observacao: form.observacao,
    };

    try {
      if (editingId) {
        await updateMut.mutateAsync({ id: editingId, ...input });
        toast({ title: 'Férias atualizadas' });
      } else {
        await createMut.mutateAsync(input);
        toast({ title: 'Férias programadas cadastradas' });
      }
      setDialogOpen(false);
    } catch {
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    }
  };

  const handleCancel = async (v: ScheduledVacation) => {
    if (!confirm(`Cancelar férias de ${v.collaborator_name}?`)) return;
    try {
      await updateMut.mutateAsync({
        id: v.id,
        collaborator_id: v.collaborator_id,
        collaborator_name: v.collaborator_name,
        sector: v.sector,
        data_inicio_ferias: v.data_inicio_ferias,
        data_fim_ferias: v.data_fim_ferias,
        observacao: v.observacao,
        status: 'CANCELADA',
      });
      toast({ title: 'Férias canceladas' });
    } catch {
      toast({ title: 'Erro ao cancelar', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este registro de férias?')) return;
    try {
      await deleteMut.mutateAsync(id);
      toast({ title: 'Registro excluído' });
    } catch {
      toast({ title: 'Erro ao excluir', variant: 'destructive' });
    }
  };

  const handleExport = () => {
    const rows = filtered.map(v => ({
      Colaborador: v.collaborator_name,
      Setor: v.sector,
      Início: formatDateBR(v.data_inicio_ferias),
      Fim: formatDateBR(v.data_fim_ferias),
      Status: STATUS_LABELS[computeVacationStatus(v)] || v.status,
      Observação: v.observacao || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const cols = Object.keys(rows[0] || {});
    ws['!cols'] = cols.map(key => {
      const maxLen = Math.max(key.length, ...rows.map(r => String((r as any)[key]).length));
      return { wch: maxLen + 2 };
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Férias Programadas');
    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `ferias_programadas_${today}.xlsx`);
  };

  const MONTH_LABELS = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Calendário de Férias Programadas</h1>
          <p className="text-sm text-muted-foreground">{vacations.length} registro(s)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={filtered.length === 0}>
            <Download className="w-4 h-4 mr-1" /> Exportar
          </Button>
          <Button size="sm" onClick={openNew}>
            <Plus className="w-4 h-4 mr-1" /> Nova Férias Programada
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="no-print">
        <CardContent className="py-3 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Label className="text-xs whitespace-nowrap">Setor</Label>
            <Select value={filterSector} onValueChange={setFilterSector}>
              <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                {availableSectors.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs whitespace-nowrap">Status</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs whitespace-nowrap">Mês</Label>
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                {availableMonths.map(m => {
                  const [y, mo] = m.split('-');
                  return <SelectItem key={m} value={m}>{MONTH_LABELS[parseInt(mo) - 1]} {y}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-30" />
            Nenhuma férias programada encontrada.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead className="hidden sm:table-cell">Setor</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Fim</TableHead>
                  <TableHead className="hidden sm:table-cell">Pgto. Férias</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Observação</TableHead>
                  <TableHead className="w-28">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(v => {
                  const cs = computeVacationStatus(v);
                  return (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium">
                        {v.collaborator_name}
                        <span className="sm:hidden block text-xs text-muted-foreground">{v.sector}</span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{v.sector}</TableCell>
                      <TableCell>{formatDateBR(v.data_inicio_ferias)}</TableCell>
                      <TableCell>{formatDateBR(v.data_fim_ferias)}</TableCell>
                      <TableCell className="hidden sm:table-cell text-xs">
                        {v.data_pagamento_ferias ? formatDateBR(v.data_pagamento_ferias) : formatDateBR(calcPayDate(v.data_inicio_ferias))}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={`text-xs ${STATUS_COLORS[cs] || ''}`}>
                          {STATUS_LABELS[cs]}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground max-w-[200px] truncate">
                        {v.observacao || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(v)} className="p-1.5 rounded hover:bg-muted transition-colors" title="Editar">
                            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                          {cs !== 'CANCELADA' && cs !== 'CONCLUIDA' && (
                            <button onClick={() => handleCancel(v)} className="p-1.5 rounded hover:bg-amber-100 dark:hover:bg-amber-900/20 transition-colors" title="Cancelar">
                              <XCircle className="w-3.5 h-3.5 text-amber-600" />
                            </button>
                          )}
                          <button onClick={() => handleDelete(v.id)} className="p-1.5 rounded hover:bg-destructive/10 transition-colors" title="Excluir">
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Férias Programadas' : 'Nova Férias Programada'}</DialogTitle>
            <DialogDescription>Preencha os dados do período de férias.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Colaborador</Label>
              <Select value={form.collaborator_id} onValueChange={v => setForm(f => ({ ...f, collaborator_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {activeCollaborators.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.collaborator_name} ({c.sector})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedCollab && (
                <p className="text-xs text-muted-foreground">Setor: {selectedCollab.sector}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data Início</Label>
                <Input
                  type="date"
                  value={form.data_inicio_ferias}
                  onChange={e => {
                    const newStart = e.target.value;
                    setForm(f => ({
                      ...f,
                      data_inicio_ferias: newStart,
                      data_pagamento_ferias: calcPayDate(newStart),
                    }));
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Input
                  type="date"
                  value={form.data_fim_ferias}
                  onChange={e => setForm(f => ({ ...f, data_fim_ferias: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Data Pagamento das Férias</Label>
              <Input
                type="date"
                value={form.data_pagamento_ferias}
                onChange={e => setForm(f => ({ ...f, data_pagamento_ferias: e.target.value }))}
              />
              <p className="text-[11px] text-muted-foreground">Padrão: 3 dias antes do início das férias. Editável se necessário.</p>
            </div>

            <div className="space-y-2">
              <Label>Observação (opcional)</Label>
              <Textarea
                value={form.observacao}
                onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))}
                placeholder="Observações sobre as férias..."
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit">{editingId ? 'Salvar' : 'Cadastrar'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <VacationHistory />
    </div>
  );
}

function VacationHistory() {
  const { data: afastamentos = [], isLoading } = useAfastamentos();
  const ferias = useMemo(
    () => afastamentos.filter(a => a.motivo === 'Férias'),
    [afastamentos]
  );

  function formatDateBR2(s: string) {
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y}`;
  }

  function calcDias(inicio: string, fim: string) {
    const d1 = new Date(inicio + 'T00:00:00');
    const d2 = new Date(fim + 'T00:00:00');
    return Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1;
  }

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-base">Histórico de Férias (Afastamentos)</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : ferias.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum histórico de férias registrado.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>Data Início</TableHead>
                <TableHead>Data Fim</TableHead>
                <TableHead>Dias</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Registrado por</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ferias.map(a => {
                const isActive = todayStr >= a.data_inicio && todayStr <= a.data_fim;
                const isPast = todayStr > a.data_fim;
                return (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.collaborator_name}</TableCell>
                    <TableCell>{a.sector}</TableCell>
                    <TableCell>{formatDateBR2(a.data_inicio)}</TableCell>
                    <TableCell>{formatDateBR2(a.data_fim)}</TableCell>
                    <TableCell>{calcDias(a.data_inicio, a.data_fim)}</TableCell>
                    <TableCell>
                      {isActive ? (
                        <Badge variant="destructive">Ativo</Badge>
                      ) : isPast ? (
                        <Badge variant="secondary">Encerrado</Badge>
                      ) : (
                        <Badge variant="outline">Futuro</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{a.created_by || '—'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
