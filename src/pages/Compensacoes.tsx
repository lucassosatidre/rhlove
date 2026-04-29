import { useState, useMemo, useCallback, useEffect } from 'react';
import { useCollaborators } from '@/hooks/useCollaborators';
import { useScheduledVacations } from '@/hooks/useScheduledVacations';
import {
  useHolidays,
  useCreateHoliday,
  useDeleteHoliday,
  useHolidayCompensations,
  useBulkUpsertHolidayCompensations,
  useUpdateHolidayCompensation,
  type Holiday,
  type HolidayCompensation,
  type HolidayCompensationInput,
} from '@/hooks/useHolidayCompensations';
import { isCollaboratorScheduledOnDate } from '@/lib/scheduleEngine';
import { useFolgasResolver } from '@/hooks/useFolgasResolver';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, RefreshCw, Download, CalendarCheck } from 'lucide-react';
import * as XLSX from 'xlsx';

function formatDateBR(dateStr: string) {
  if (!dateStr) return '-';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}`;
}

function formatDateBRFull(dateStr: string) {
  if (!dateStr) return '-';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

export default function Compensacoes() {
  const { data: collaborators = [] } = useCollaborators();
  const { data: scheduledVacations = [] } = useScheduledVacations();
  const { resolver: folgasResolver } = useFolgasResolver();
  const { data: holidays = [], isLoading: loadingHolidays } = useHolidays();
  const { data: compensations = [], isLoading: loadingComps } = useHolidayCompensations();
  const createHoliday = useCreateHoliday();
  const deleteHoliday = useDeleteHoliday();
  const bulkUpsert = useBulkUpsertHolidayCompensations();
  const updateComp = useUpdateHolidayCompensation();
  const { toast } = useToast();

  const [filterSector, setFilterSector] = useState('ALL');
  const [holidayDialogOpen, setHolidayDialogOpen] = useState(false);
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayName, setNewHolidayName] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingComp, setEditingComp] = useState<HolidayCompensation | null>(null);
  const [editStatus, setEditStatus] = useState('NAO');
  const [editCompDate, setEditCompDate] = useState('');
  const [editObs, setEditObs] = useState('');

  // Only past/current holidays for auto-generation
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Active collaborators (include all for history, but only generate for non-DESLIGADO before date)
  const activeCollabs = useMemo(
    () => collaborators.filter(c => c.status !== 'DESLIGADO' || c.data_desligamento),
    [collaborators]
  );

  // Compensation lookup
  const compMap = useMemo(() => {
    const map = new Map<string, HolidayCompensation>();
    for (const c of compensations) {
      map.set(`${c.collaborator_id}|${c.holiday_date}`, c);
    }
    return map;
  }, [compensations]);

  // Auto-generate compensations for past holidays
  const handleAutoGenerate = useCallback(async () => {
    const pastHolidays = holidays.filter(h => new Date(h.date + 'T00:00:00') <= today);
    const newRecords: HolidayCompensationInput[] = [];

    for (const holiday of pastHolidays) {
      const hDate = new Date(holiday.date + 'T00:00:00');
      for (const collab of collaborators) {
        const key = `${collab.id}|${holiday.date}`;
        if (compMap.has(key)) continue; // already exists

        const scheduled = isCollaboratorScheduledOnDate(collab, hDate, scheduledVacations);
        newRecords.push({
          collaborator_id: collab.id,
          collaborator_name: collab.collaborator_name,
          sector: collab.sector,
          holiday_date: holiday.date,
          holiday_name: holiday.name,
          eligible: scheduled,
          status: scheduled ? 'SIM' : 'NAO',
        });
      }
    }

    if (newRecords.length === 0) {
      toast({ title: 'Nenhum novo registro para gerar' });
      return;
    }

    try {
      await bulkUpsert.mutateAsync(newRecords);
      toast({ title: `${newRecords.length} registros gerados automaticamente` });
    } catch {
      toast({ title: 'Erro ao gerar registros', variant: 'destructive' });
    }
  }, [holidays, collaborators, compMap, scheduledVacations, today, bulkUpsert, toast]);

  // Sectors for filter
  const sectors = useMemo(() => {
    const s = new Set(collaborators.map(c => c.sector));
    return [...s].sort();
  }, [collaborators]);

  // Filtered collaborators
  const filteredCollabs = useMemo(() => {
    let list = collaborators;
    if (filterSector !== 'ALL') list = list.filter(c => c.sector === filterSector);
    return list.sort((a, b) => a.sector.localeCompare(b.sector) || a.collaborator_name.localeCompare(b.collaborator_name));
  }, [collaborators, filterSector]);

  // Saldo per collaborator
  const saldoMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of compensations) {
      if (c.status === 'SIM') {
        map.set(c.collaborator_id, (map.get(c.collaborator_id) || 0) + 1);
      }
    }
    return map;
  }, [compensations]);

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHolidayDate || !newHolidayName.trim()) {
      toast({ title: 'Data e nome são obrigatórios', variant: 'destructive' });
      return;
    }
    try {
      await createHoliday.mutateAsync({ date: newHolidayDate, name: newHolidayName.trim() });
      toast({ title: 'Feriado cadastrado' });
      setHolidayDialogOpen(false);
      setNewHolidayDate('');
      setNewHolidayName('');
    } catch {
      toast({ title: 'Erro ao cadastrar feriado (já existe?)', variant: 'destructive' });
    }
  };

  const openEditComp = (comp: HolidayCompensation) => {
    setEditingComp(comp);
    setEditStatus(comp.status);
    setEditCompDate(comp.compensation_date || '');
    setEditObs(comp.observacao || '');
    setEditDialogOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingComp) return;
    try {
      await updateComp.mutateAsync({
        id: editingComp.id,
        status: editStatus,
        compensation_date: editStatus === 'COMPENSADO' ? editCompDate || null : null,
        observacao: editObs,
        eligible: editStatus !== 'NAO',
      });
      toast({ title: 'Compensação atualizada' });
      setEditDialogOpen(false);
    } catch {
      toast({ title: 'Erro ao atualizar', variant: 'destructive' });
    }
  };

  const handleExport = () => {
    const rows: Record<string, any>[] = [];
    for (const collab of filteredCollabs) {
      const row: Record<string, any> = {
        Colaborador: collab.collaborator_name,
        Setor: collab.sector,
        'Saldo em Aberto': saldoMap.get(collab.id) || 0,
      };
      for (const h of holidays) {
        const comp = compMap.get(`${collab.id}|${h.date}`);
        if (!comp) {
          row[`${formatDateBR(h.date)} ${h.name}`] = '-';
        } else if (comp.status === 'NAO') {
          row[`${formatDateBR(h.date)} ${h.name}`] = 'NÃO';
        } else if (comp.status === 'SIM') {
          row[`${formatDateBR(h.date)} ${h.name}`] = 'SIM';
        } else {
          row[`${formatDateBR(h.date)} ${h.name}`] = comp.compensation_date ? formatDateBRFull(comp.compensation_date) : 'COMPENSADO';
        }
      }
      rows.push(row);
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Compensações');
    const d = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `compensacoes_feriados_${d}.xlsx`);
  };

  const getCellDisplay = (comp: HolidayCompensation | undefined) => {
    if (!comp) return { text: '-', className: 'text-muted-foreground' };
    if (comp.status === 'NAO') return { text: 'NÃO', className: 'text-muted-foreground' };
    if (comp.status === 'SIM') return { text: 'SIM', className: 'text-amber-600 dark:text-amber-400 font-semibold' };
    // COMPENSADO
    const dateText = comp.compensation_date ? formatDateBRFull(comp.compensation_date) : 'COMP';
    return { text: dateText, className: 'text-emerald-600 dark:text-emerald-400 font-medium' };
  };

  const isLoading = loadingHolidays || loadingComps;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Compensações de Feriados</h1>
          <p className="text-sm text-muted-foreground">
            {holidays.length} feriado(s) · {compensations.filter(c => c.status === 'SIM').length} compensação(ões) em aberto
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={filteredCollabs.length === 0}>
            <Download className="w-4 h-4 mr-1" /> Exportar
          </Button>
          <Button variant="outline" size="sm" onClick={() => setHolidayDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> Feriado
          </Button>
          <Button size="sm" onClick={handleAutoGenerate} disabled={bulkUpsert.isPending}>
            <RefreshCw className={`w-4 h-4 mr-1 ${bulkUpsert.isPending ? 'animate-spin' : ''}`} /> Gerar Automático
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="no-print">
        <CardContent className="py-3 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Label className="text-xs whitespace-nowrap">Setor</Label>
            <Select value={filterSector} onValueChange={setFilterSector}>
              <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                {sectors.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : filteredCollabs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <CalendarCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
            Nenhum colaborador encontrado.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-muted border border-border px-3 py-2 text-left font-semibold min-w-[160px]">
                      Colaborador
                    </th>
                    <th className="bg-muted border border-border px-2 py-2 text-center font-semibold min-w-[60px]">
                      Setor
                    </th>
                    <th className="bg-muted border border-border px-2 py-2 text-center font-semibold min-w-[50px]">
                      Saldo
                    </th>
                    {holidays.map(h => (
                      <th key={h.id} className="bg-muted border border-border px-2 py-2 text-center font-semibold min-w-[80px]" title={h.name}>
                        <div className="leading-tight">
                          <span className="block">{formatDateBR(h.date)}</span>
                          <span className="block text-[9px] text-muted-foreground font-normal truncate max-w-[80px]">{h.name}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredCollabs.map(collab => {
                    const saldo = saldoMap.get(collab.id) || 0;
                    return (
                      <tr key={collab.id} className="hover:bg-muted/50 transition-colors">
                        <td className="sticky left-0 z-10 bg-card border border-border px-3 py-2 font-medium">
                          {collab.collaborator_name}
                        </td>
                        <td className="border border-border px-2 py-2 text-center text-muted-foreground">
                          {collab.sector}
                        </td>
                        <td className="border border-border px-2 py-2 text-center">
                          {saldo > 0 ? (
                            <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs">
                              {saldo}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                        {holidays.map(h => {
                          const comp = compMap.get(`${collab.id}|${h.date}`);
                          const cell = getCellDisplay(comp);
                          return (
                            <td
                              key={h.id}
                              className={`border border-border px-2 py-2 text-center cursor-pointer hover:bg-accent/50 transition-colors ${cell.className}`}
                              onClick={() => comp && openEditComp(comp)}
                              title={comp ? `Clique para editar · ${comp.observacao || ''}` : 'Sem registro'}
                            >
                              {cell.text}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Holiday Dialog */}
      <Dialog open={holidayDialogOpen} onOpenChange={setHolidayDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Feriado</DialogTitle>
            <DialogDescription>Cadastre um feriado adicional.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddHoliday} className="space-y-4">
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={newHolidayDate} onChange={e => setNewHolidayDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Nome do Feriado</Label>
              <Input value={newHolidayName} onChange={e => setNewHolidayName(e.target.value)} placeholder="Ex: Corpus Christi" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setHolidayDialogOpen(false)}>Cancelar</Button>
              <Button type="submit">Cadastrar</Button>
            </div>
          </form>

          {/* Holiday list */}
          <div className="mt-4 border-t pt-4">
            <p className="text-xs font-semibold mb-2 text-muted-foreground">Feriados cadastrados:</p>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {holidays.map(h => (
                <div key={h.id} className="flex items-center justify-between text-xs py-1">
                  <span>{formatDateBRFull(h.date)} — {h.name}</span>
                  <button
                    onClick={() => deleteHoliday.mutate(h.id)}
                    className="text-destructive hover:underline text-[10px]"
                  >
                    remover
                  </button>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Compensation Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Compensação</DialogTitle>
            <DialogDescription>
              {editingComp?.collaborator_name} — {editingComp?.holiday_name} ({editingComp ? formatDateBRFull(editingComp.holiday_date) : ''})
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NAO">NÃO (sem direito)</SelectItem>
                  <SelectItem value="SIM">SIM (pendente)</SelectItem>
                  <SelectItem value="COMPENSADO">COMPENSADO</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editStatus === 'COMPENSADO' && (
              <div className="space-y-2">
                <Label>Data da Compensação</Label>
                <Input type="date" value={editCompDate} onChange={e => setEditCompDate(e.target.value)} />
              </div>
            )}
            <div className="space-y-2">
              <Label>Observação</Label>
              <Input value={editObs} onChange={e => setEditObs(e.target.value)} placeholder="Observação opcional..." />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
              <Button type="submit">Salvar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
