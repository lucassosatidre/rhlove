import { useState, useMemo, useCallback } from 'react';
import { useCollaborators, useUpdateCollaborator } from '@/hooks/useCollaborators';
import {
  useAvisosPrevios,
  useCreateAvisoPrevio,
  useUpdateAvisoPrevio,
  getAvisoChecklist,
  computeAutoStatus,
  computeAvisosAlerts,
  type AvisoPrevio,
  type AvisoPrevioInput,
} from '@/hooks/useAvisosPrevios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Plus, ChevronDown, ChevronUp, AlertTriangle, AlertOctagon, Info, FileWarning } from 'lucide-react';

function formatDateBR(d: string | null) {
  if (!d) return '-';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

const STATUS_COLORS: Record<string, string> = {
  'Em andamento': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'Próximo do fim': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  'Aguardando pagamento': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  'Aguardando exame': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  'Aguardando assinatura': 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  'Concluído': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};

export default function AvisosPrevios() {
  const { data: avisos = [], isLoading } = useAvisosPrevios();
  const { data: collaborators = [] } = useCollaborators();
  const createAviso = useCreateAvisoPrevio();
  const updateAviso = useUpdateAvisoPrevio();
  const updateCollaborator = useUpdateCollaborator();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingAviso, setEditingAviso] = useState<AvisoPrevio | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterSector, setFilterSector] = useState('ALL');
  const [filterPago, setFilterPago] = useState('ALL');

  // New aviso form
  const [newCollabId, setNewCollabId] = useState('');
  const [newOpcao, setNewOpcao] = useState('2h a menos por dia');
  const [newDataInicio, setNewDataInicio] = useState('');
  const [newDataFim, setNewDataFim] = useState('');

  // Collaborators available (AVISO_PREVIO status or active)
  const availableCollabs = useMemo(() =>
    collaborators.filter(c => c.status !== 'DESLIGADO'),
    [collaborators]
  );

  const sectors = useMemo(() => {
    const s = new Set(avisos.map(a => a.sector));
    return [...s].sort();
  }, [avisos]);

  const filtered = useMemo(() => {
    let list = avisos;
    if (filterStatus !== 'ALL') list = list.filter(a => a.status_processo === filterStatus);
    if (filterSector !== 'ALL') list = list.filter(a => a.sector === filterSector);
    if (filterPago === 'sim') list = list.filter(a => a.pago);
    if (filterPago === 'nao') list = list.filter(a => !a.pago);
    return list;
  }, [avisos, filterStatus, filterSector, filterPago]);

  // Summary cards
  const summary = useMemo(() => {
    const ativos = avisos.filter(a => a.status_processo !== 'Concluído');
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const proximosFim = ativos.filter(a => {
      const fim = new Date(a.data_fim + 'T00:00:00');
      const diff = Math.ceil((fim.getTime() - today.getTime()) / 86400000);
      return diff >= 0 && diff <= 7;
    });
    const travados = ativos.filter(a => {
      const fim = new Date(a.data_fim + 'T00:00:00');
      return today > fim && (!a.pago || !a.exame || !a.assinatura);
    });
    return {
      emAndamento: ativos.length,
      proximosFim: proximosFim.length,
      pagPendentes: ativos.filter(a => !a.pago).length,
      examePendentes: ativos.filter(a => !a.exame).length,
      assPendentes: ativos.filter(a => !a.assinatura).length,
      envPendentes: ativos.filter(a => !a.enviado_contabilidade).length,
      travados: travados.length,
    };
  }, [avisos]);

  const alerts = useMemo(() => computeAvisosAlerts(avisos), [avisos]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const collab = collaborators.find(c => c.id === newCollabId);
    if (!collab || !newDataInicio || !newDataFim) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }
    try {
      await createAviso.mutateAsync({
        collaborator_id: collab.id,
        collaborator_name: collab.collaborator_name,
        sector: collab.sector,
        opcao: newOpcao,
        data_inicio: newDataInicio,
        data_fim: newDataFim,
      });
      // Update collaborator status
      if (collab.status !== 'AVISO_PREVIO') {
        await updateCollaborator.mutateAsync({
          id: collab.id,
          collaborator_name: collab.collaborator_name,
          sector: collab.sector,
          tipo_escala: collab.tipo_escala,
          folgas_semanais: collab.folgas_semanais,
          sunday_n: collab.sunday_n,
          status: 'AVISO_PREVIO',
          inicio_na_empresa: collab.inicio_na_empresa,
          inicio_periodo: newDataInicio,
          fim_periodo: newDataFim,
        });
      }
      toast({ title: 'Aviso prévio registrado' });
      setDialogOpen(false);
      setNewCollabId('');
      setNewDataInicio('');
      setNewDataFim('');
    } catch {
      toast({ title: 'Erro ao criar aviso prévio', variant: 'destructive' });
    }
  };

  const handleToggleField = async (aviso: AvisoPrevio, field: 'pago' | 'exame' | 'assinatura' | 'enviado_contabilidade') => {
    const newVal = !aviso[field];
    const updates: any = { id: aviso.id, [field]: newVal };
    
    // Auto-set data_envio_contabilidade
    if (field === 'enviado_contabilidade' && newVal) {
      updates.data_envio_contabilidade = new Date().toISOString().slice(0, 10);
    }

    try {
      await updateAviso.mutateAsync(updates);

      // Check auto-discharge
      const updated = { ...aviso, ...updates };
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const fim = new Date(updated.data_fim + 'T00:00:00');
      if (today >= fim && updated.pago && updated.exame && updated.assinatura) {
        // Auto desligamento
        await updateAviso.mutateAsync({ id: aviso.id, status_processo: 'Concluído' });
        const collab = collaborators.find(c => c.id === aviso.collaborator_id);
        if (collab && collab.status !== 'DESLIGADO') {
          await updateCollaborator.mutateAsync({
            id: collab.id,
            collaborator_name: collab.collaborator_name,
            sector: collab.sector,
            tipo_escala: collab.tipo_escala,
            folgas_semanais: collab.folgas_semanais,
            sunday_n: collab.sunday_n,
            status: 'DESLIGADO',
            inicio_na_empresa: collab.inicio_na_empresa,
            data_desligamento: aviso.data_fim,
          });
          toast({ title: `${collab.collaborator_name} desligado automaticamente` });
        }
      }
    } catch {
      toast({ title: 'Erro ao atualizar', variant: 'destructive' });
    }
  };

  const openEdit = (aviso: AvisoPrevio) => {
    setEditingAviso(aviso);
    setEditDialogOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAviso) return;
    const form = e.target as HTMLFormElement;
    const fd = new FormData(form);
    try {
      await updateAviso.mutateAsync({
        id: editingAviso.id,
        opcao: fd.get('opcao') as string,
        data_inicio: fd.get('data_inicio') as string,
        data_fim: fd.get('data_fim') as string,
        data_pagamento: (fd.get('data_pagamento') as string) || null,
        observacoes: fd.get('observacoes') as string,
        status_processo: fd.get('status_processo') as string,
      });
      toast({ title: 'Aviso prévio atualizado' });
      setEditDialogOpen(false);
    } catch {
      toast({ title: 'Erro ao atualizar', variant: 'destructive' });
    }
  };

  const ALERT_STYLES = {
    info: { icon: Info, bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    warning: { icon: AlertTriangle, bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    critical: { icon: AlertOctagon, bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Avisos Prévios</h1>
          <p className="text-sm text-muted-foreground">
            {avisos.length} registro(s) · {summary.emAndamento} em andamento
          </p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> Novo Aviso Prévio
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Em andamento', value: summary.emAndamento, color: 'text-blue-600' },
          { label: 'Próximos do fim', value: summary.proximosFim, color: 'text-amber-600' },
          { label: 'Pag. pendentes', value: summary.pagPendentes, color: 'text-orange-600' },
          { label: 'Exames pend.', value: summary.examePendentes, color: 'text-purple-600' },
          { label: 'Assin. pend.', value: summary.assPendentes, color: 'text-pink-600' },
          { label: 'Envio contab.', value: summary.envPendentes, color: 'text-sky-600' },
          { label: 'Travados', value: summary.travados, color: 'text-red-600' },
        ].map(card => (
          <Card key={card.label} className="border-border/60">
            <CardContent className="p-3 text-center">
              <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
              <p className="text-[10px] text-muted-foreground leading-tight mt-1">{card.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileWarning className="w-4 h-4" /> Alertas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.map((alert, i) => {
              const s = ALERT_STYLES[alert.type];
              const Icon = s.icon;
              return (
                <div key={i} className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-xs ${s.bg} ${s.text} ${s.border}`}>
                  <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>{alert.message}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card className="no-print">
        <CardContent className="py-3 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Label className="text-xs whitespace-nowrap">Status</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-44 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                <SelectItem value="Em andamento">Em andamento</SelectItem>
                <SelectItem value="Próximo do fim">Próximo do fim</SelectItem>
                <SelectItem value="Aguardando pagamento">Aguardando pagamento</SelectItem>
                <SelectItem value="Aguardando exame">Aguardando exame</SelectItem>
                <SelectItem value="Aguardando assinatura">Aguardando assinatura</SelectItem>
                <SelectItem value="Concluído">Concluído</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
          <div className="flex items-center gap-2">
            <Label className="text-xs whitespace-nowrap">Pago</Label>
            <Select value={filterPago} onValueChange={setFilterPago}>
              <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                <SelectItem value="sim">Sim</SelectItem>
                <SelectItem value="nao">Não</SelectItem>
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
            <FileWarning className="w-12 h-12 mx-auto mb-3 opacity-30" />
            Nenhum aviso prévio encontrado.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="bg-muted border border-border px-3 py-2 text-left font-semibold"></th>
                    <th className="bg-muted border border-border px-3 py-2 text-left font-semibold min-w-[140px]">Nome</th>
                    <th className="bg-muted border border-border px-2 py-2 text-center font-semibold">Setor</th>
                    <th className="bg-muted border border-border px-2 py-2 text-center font-semibold min-w-[120px]">Opção</th>
                    <th className="bg-muted border border-border px-2 py-2 text-center font-semibold">Início</th>
                    <th className="bg-muted border border-border px-2 py-2 text-center font-semibold">Fim</th>
                    <th className="bg-muted border border-border px-2 py-2 text-center font-semibold">Dt. Pgto</th>
                    <th className="bg-muted border border-border px-2 py-2 text-center font-semibold">Pago</th>
                    <th className="bg-muted border border-border px-2 py-2 text-center font-semibold">Exame</th>
                    <th className="bg-muted border border-border px-2 py-2 text-center font-semibold">Assin.</th>
                    <th className="bg-muted border border-border px-2 py-2 text-center font-semibold">Contab.</th>
                    <th className="bg-muted border border-border px-2 py-2 text-center font-semibold">Pend.</th>
                    <th className="bg-muted border border-border px-2 py-2 text-center font-semibold min-w-[130px]">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(aviso => {
                    const { pendencias, percentual } = getAvisoChecklist(aviso);
                    const autoStatus = computeAutoStatus(aviso);
                    const isExpanded = expandedId === aviso.id;
                    const today = new Date(); today.setHours(0, 0, 0, 0);
                    const fim = new Date(aviso.data_fim + 'T00:00:00');
                    const isTravado = today > fim && (!aviso.pago || !aviso.exame || !aviso.assinatura) && aviso.status_processo !== 'Concluído';

                    return (
                      <>
                        <tr key={aviso.id} className={`hover:bg-muted/50 transition-colors ${isTravado ? 'bg-red-50/50 dark:bg-red-950/20' : ''}`}>
                          <td className="border border-border px-2 py-2 text-center">
                            <button onClick={() => setExpandedId(isExpanded ? null : aviso.id)} className="p-0.5 hover:bg-accent rounded">
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          </td>
                          <td className="border border-border px-3 py-2 font-medium cursor-pointer hover:underline" onClick={() => openEdit(aviso)}>
                            {aviso.collaborator_name}
                            {isTravado && <AlertOctagon className="w-3 h-3 text-red-500 inline ml-1" />}
                          </td>
                          <td className="border border-border px-2 py-2 text-center text-muted-foreground">{aviso.sector}</td>
                          <td className="border border-border px-2 py-2 text-center">{aviso.opcao}</td>
                          <td className="border border-border px-2 py-2 text-center">{formatDateBR(aviso.data_inicio)}</td>
                          <td className="border border-border px-2 py-2 text-center">{formatDateBR(aviso.data_fim)}</td>
                          <td className="border border-border px-2 py-2 text-center">{formatDateBR(aviso.data_pagamento)}</td>
                          <td className="border border-border px-2 py-2 text-center">
                            <Checkbox checked={aviso.pago} onCheckedChange={() => handleToggleField(aviso, 'pago')} />
                          </td>
                          <td className="border border-border px-2 py-2 text-center">
                            <Checkbox checked={aviso.exame} onCheckedChange={() => handleToggleField(aviso, 'exame')} />
                          </td>
                          <td className="border border-border px-2 py-2 text-center">
                            <Checkbox checked={aviso.assinatura} onCheckedChange={() => handleToggleField(aviso, 'assinatura')} />
                          </td>
                          <td className="border border-border px-2 py-2 text-center">
                            <Checkbox checked={aviso.enviado_contabilidade} onCheckedChange={() => handleToggleField(aviso, 'enviado_contabilidade')} />
                          </td>
                          <td className="border border-border px-2 py-2 text-center">
                            {pendencias > 0 ? (
                              <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px]">
                                {pendencias}
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px]">
                                0
                              </Badge>
                            )}
                          </td>
                          <td className="border border-border px-2 py-2 text-center">
                            <Badge className={`text-[10px] ${STATUS_COLORS[aviso.status_processo] || STATUS_COLORS['Em andamento']}`}>
                              {aviso.status_processo}
                            </Badge>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${aviso.id}-checklist`}>
                            <td colSpan={13} className="border border-border p-4 bg-muted/30">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Checklist */}
                                <div>
                                  <h4 className="font-semibold text-sm mb-3">Checklist — {aviso.collaborator_name}</h4>
                                  <div className="space-y-2">
                                    {getAvisoChecklist(aviso).items.map((item, i) => (
                                      <div key={i} className="flex items-center gap-2 text-xs">
                                        <div className={`w-4 h-4 rounded-sm border flex items-center justify-center text-[10px] ${item.done ? 'bg-primary text-primary-foreground border-primary' : 'border-muted-foreground/30'}`}>
                                          {item.done && '✓'}
                                        </div>
                                        <span className={item.done ? 'line-through text-muted-foreground' : ''}>{item.label}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                {/* Summary */}
                                <div>
                                  <h4 className="font-semibold text-sm mb-3">Resumo</h4>
                                  <div className="space-y-2 text-xs">
                                    <p>Pendências: <span className="font-bold">{pendencias}</span></p>
                                    <p>Concluído: <span className="font-bold">{percentual}%</span></p>
                                    <div className="w-full bg-muted rounded-full h-2 mt-1">
                                      <div
                                        className="bg-primary h-2 rounded-full transition-all"
                                        style={{ width: `${percentual}%` }}
                                      />
                                    </div>
                                    {aviso.observacoes && (
                                      <div className="mt-3 p-2 bg-card rounded border text-xs">
                                        <p className="font-medium mb-1">Observações:</p>
                                        <p className="text-muted-foreground">{aviso.observacoes}</p>
                                      </div>
                                    )}
                                    {aviso.data_envio_contabilidade && (
                                      <p className="text-muted-foreground">Enviado para contabilidade em: {formatDateBR(aviso.data_envio_contabilidade)}</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* New Aviso Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Aviso Prévio</DialogTitle>
            <DialogDescription>Registre um novo aviso prévio para acompanhamento.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>Colaborador</Label>
              <Select value={newCollabId} onValueChange={setNewCollabId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {availableCollabs.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.collaborator_name} — {c.sector}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Forma de cumprimento</Label>
              <Select value={newOpcao} onValueChange={setNewOpcao}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="2h a menos por dia">2h a menos por dia</SelectItem>
                  <SelectItem value="7 dias a menos no mês">7 dias a menos no mês da rescisão</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data de Início</Label>
                <Input type="date" value={newDataInicio} onChange={e => setNewDataInicio(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Data de Fim</Label>
                <Input type="date" value={newDataFim} onChange={e => setNewDataFim(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createAviso.isPending}>Registrar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Aviso Prévio</DialogTitle>
            <DialogDescription>{editingAviso?.collaborator_name} — {editingAviso?.sector}</DialogDescription>
          </DialogHeader>
          {editingAviso && (
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Forma de cumprimento</Label>
                <Select name="opcao" defaultValue={editingAviso.opcao}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2h a menos por dia">2h a menos por dia</SelectItem>
                    <SelectItem value="7 dias a menos no mês">7 dias a menos no mês da rescisão</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Início</Label>
                  <Input type="date" name="data_inicio" defaultValue={editingAviso.data_inicio} />
                </div>
                <div className="space-y-2">
                  <Label>Fim</Label>
                  <Input type="date" name="data_fim" defaultValue={editingAviso.data_fim} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Data de Pagamento</Label>
                <Input type="date" name="data_pagamento" defaultValue={editingAviso.data_pagamento || ''} />
              </div>
              <div className="space-y-2">
                <Label>Status do Processo</Label>
                <Select name="status_processo" defaultValue={editingAviso.status_processo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Em andamento">Em andamento</SelectItem>
                    <SelectItem value="Próximo do fim">Próximo do fim</SelectItem>
                    <SelectItem value="Aguardando pagamento">Aguardando pagamento</SelectItem>
                    <SelectItem value="Aguardando exame">Aguardando exame</SelectItem>
                    <SelectItem value="Aguardando assinatura">Aguardando assinatura</SelectItem>
                    <SelectItem value="Concluído">Concluído</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea name="observacoes" defaultValue={editingAviso.observacoes || ''} rows={3} />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
                <Button type="submit">Salvar</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
