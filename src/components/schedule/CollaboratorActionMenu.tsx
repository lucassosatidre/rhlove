import { useState, useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useCreateScheduleEvent, type ScheduleEventInput } from '@/hooks/useScheduleEvents';
import { useHolidayCompensations, useUpdateHolidayCompensation } from '@/hooks/useHolidayCompensations';
import type { Collaborator } from '@/types/collaborator';
import { AlertTriangle, FileText, Gift, ArrowLeftRight, ArrowRight } from 'lucide-react';

interface Props {
  collaboratorName: string;
  collaboratorId: string;
  date: Date;
  weekStart: Date;
  allCollaborators: Collaborator[];
  sector: string;
  children: React.ReactNode;
}

const formatDateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const DAY_OPTIONS = [
  { value: 'SEGUNDA', label: 'Segunda' },
  { value: 'TERCA', label: 'Terça' },
  { value: 'QUARTA', label: 'Quarta' },
  { value: 'QUINTA', label: 'Quinta' },
  { value: 'SEXTA', label: 'Sexta' },
  { value: 'SABADO', label: 'Sábado' },
  { value: 'DOMINGO', label: 'Domingo' },
];

const DAY_LABELS: Record<string, string> = {
  SEGUNDA: 'Segunda', TERCA: 'Terça', QUARTA: 'Quarta', QUINTA: 'Quinta',
  SEXTA: 'Sexta', SABADO: 'Sábado', DOMINGO: 'Domingo',
};

export default function CollaboratorActionMenu({
  collaboratorName,
  collaboratorId,
  date,
  weekStart,
  allCollaborators,
  sector,
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'FALTA' | 'ATESTADO' | 'COMPENSACAO' | 'AJUSTE_FOLGA' | null>(null);
  const [observation, setObservation] = useState('');
  const [atestadoEnd, setAtestadoEnd] = useState('');
  const [loading, setLoading] = useState(false);

  // Swap mode state
  const [ajusteMode, setAjusteMode] = useState<'troca' | 'mover'>('troca');
  const [swapCollaboratorId, setSwapCollaboratorId] = useState('');
  const [newDayOff, setNewDayOff] = useState('');

  const { toast } = useToast();
  const { usuario } = useAuth();
  const createEvent = useCreateScheduleEvent();
  const { data: compensations = [] } = useHolidayCompensations();
  const updateCompensation = useUpdateHolidayCompensation();

  const dateKey = formatDateKey(date);
  const weekStartKey = formatDateKey(weekStart);

  const currentCollab = allCollaborators.find(c => c.id === collaboratorId);
  const currentDayOff = currentCollab?.folgas_semanais[0] || '';

  const availableCompensations = compensations.filter(
    (c) => c.collaborator_id === collaboratorId && c.status === 'SIM'
  );

  const [selectedCompensationId, setSelectedCompensationId] = useState('');

  // Other collaborators in same sector for swap
  const swapCandidates = allCollaborators.filter(
    (c) => c.id !== collaboratorId && c.sector === sector && c.status === 'ATIVO'
  );

  const selectedSwapCollab = useMemo(
    () => allCollaborators.find(c => c.id === swapCollaboratorId),
    [allCollaborators, swapCollaboratorId]
  );
  const swapCollabDayOff = selectedSwapCollab?.folgas_semanais[0] || '';

  const openDialog = (type: typeof dialogType) => {
    setDialogType(type);
    setOpen(false);
    setObservation('');
    setAtestadoEnd('');
    setSwapCollaboratorId('');
    setNewDayOff('');
    setSelectedCompensationId('');
    setAjusteMode('troca');
  };

  const handleSubmit = async () => {
    if (!dialogType) return;
    setLoading(true);

    try {
      if (dialogType === 'AJUSTE_FOLGA') {
        if (ajusteMode === 'troca') {
          // TROCA_FOLGA: swap day off with another collaborator
          if (!swapCollaboratorId) {
            toast({ title: 'Selecione o colaborador para a troca', variant: 'destructive' });
            setLoading(false);
            return;
          }
          if (!currentDayOff || !swapCollabDayOff) {
            toast({ title: 'Não foi possível identificar as folgas dos colaboradores', variant: 'destructive' });
            setLoading(false);
            return;
          }

          const input: ScheduleEventInput = {
            collaborator_id: collaboratorId,
            collaborator_name: collaboratorName,
            event_type: 'TROCA_FOLGA',
            event_date: weekStartKey,
            week_start: weekStartKey,
            original_day: currentDayOff,
            swapped_day: swapCollabDayOff,
            related_collaborator_id: swapCollaboratorId,
            related_collaborator_name: selectedSwapCollab?.collaborator_name || '',
            observation,
            created_by: usuario?.nome || usuario?.email || null,
          };

          await createEvent.mutateAsync(input);
          toast({ title: 'Troca de folga aplicada' });
        } else {
          // MUDANCA_FOLGA: move own day off
          if (!newDayOff) {
            toast({ title: 'Selecione o novo dia da folga', variant: 'destructive' });
            setLoading(false);
            return;
          }
          if (!currentDayOff) {
            toast({ title: 'Não foi possível identificar a folga atual', variant: 'destructive' });
            setLoading(false);
            return;
          }

          const input: ScheduleEventInput = {
            collaborator_id: collaboratorId,
            collaborator_name: collaboratorName,
            event_type: 'MUDANCA_FOLGA',
            event_date: weekStartKey,
            week_start: weekStartKey,
            original_day: currentDayOff,
            swapped_day: newDayOff,
            observation,
            created_by: usuario?.nome || usuario?.email || null,
          };

          await createEvent.mutateAsync(input);
          toast({ title: 'Folga movida com sucesso' });
        }

        setDialogType(null);
        setLoading(false);
        return;
      }

      // Other event types (FALTA, ATESTADO, COMPENSACAO)
      const base: ScheduleEventInput = {
        collaborator_id: collaboratorId,
        collaborator_name: collaboratorName,
        event_type: dialogType,
        event_date: dateKey,
        observation,
      };

      if (dialogType === 'ATESTADO' && atestadoEnd) {
        base.event_date_end = atestadoEnd;
      }

      if (dialogType === 'COMPENSACAO') {
        if (availableCompensations.length === 0) {
          toast({ title: 'Este colaborador não possui saldo de compensação disponível', variant: 'destructive' });
          setLoading(false);
          return;
        }
        const compId = selectedCompensationId || availableCompensations[0]?.id;
        if (!compId) {
          toast({ title: 'Selecione uma compensação', variant: 'destructive' });
          setLoading(false);
          return;
        }
        base.holiday_compensation_id = compId;
        await updateCompensation.mutateAsync({
          id: compId,
          status: 'COMPENSADO',
          compensation_date: dateKey,
        });
      }

      await createEvent.mutateAsync(base);

      const labels: Record<string, string> = {
        FALTA: 'Falta registrada',
        ATESTADO: 'Atestado registrado',
        COMPENSACAO: 'Compensação aplicada',
      };

      toast({ title: labels[dialogType] });
      setDialogType(null);
    } catch (e: any) {
      toast({ title: 'Erro ao registrar', description: e?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{children}</PopoverTrigger>
        <PopoverContent className="w-56 p-2" align="start">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground px-2 py-1 truncate">
              {collaboratorName}
            </p>
            <button
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent transition-colors"
              onClick={() => openDialog('FALTA')}
            >
              <AlertTriangle className="w-4 h-4 text-destructive" />
              Faltou
            </button>
            <button
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent transition-colors"
              onClick={() => openDialog('ATESTADO')}
            >
              <FileText className="w-4 h-4 text-blue-500" />
              Atestado
            </button>
            <button
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent transition-colors"
              onClick={() => openDialog('COMPENSACAO')}
            >
              <Gift className="w-4 h-4 text-green-600" />
              Compensação de feriado
              {availableCompensations.length > 0 && (
                <span className="ml-auto text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 px-1.5 rounded-full">
                  {availableCompensations.length}
                </span>
              )}
            </button>
            <button
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent transition-colors"
              onClick={() => openDialog('AJUSTE_FOLGA')}
            >
              <ArrowLeftRight className="w-4 h-4 text-orange-500" />
              Ajustar folga nesta semana
            </button>
          </div>
        </PopoverContent>
      </Popover>

      {/* FALTA Dialog */}
      <Dialog open={dialogType === 'FALTA'} onOpenChange={(o) => !o && setDialogType(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Registrar Falta
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">
              <strong>{collaboratorName}</strong> — {new Date(dateKey + 'T00:00:00').toLocaleDateString('pt-BR')}
            </p>
            <div>
              <Label className="text-xs">Observação (opcional)</Label>
              <Textarea
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
                placeholder="Ex: faltou sem aviso"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogType(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleSubmit} disabled={loading}>
              {loading ? 'Salvando...' : 'Registrar Falta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ATESTADO Dialog */}
      <Dialog open={dialogType === 'ATESTADO'} onOpenChange={(o) => !o && setDialogType(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" />
              Registrar Atestado
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">
              <strong>{collaboratorName}</strong>
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Data início</Label>
                <Input type="date" value={dateKey} disabled />
              </div>
              <div>
                <Label className="text-xs">Data fim (opcional)</Label>
                <Input
                  type="date"
                  value={atestadoEnd}
                  onChange={(e) => setAtestadoEnd(e.target.value)}
                  min={dateKey}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Observação (opcional)</Label>
              <Textarea
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
                placeholder="Detalhes do atestado"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogType(null)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? 'Salvando...' : 'Registrar Atestado'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* COMPENSACAO Dialog */}
      <Dialog open={dialogType === 'COMPENSACAO'} onOpenChange={(o) => !o && setDialogType(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-green-600" />
              Compensação de Feriado
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">
              <strong>{collaboratorName}</strong> — {new Date(dateKey + 'T00:00:00').toLocaleDateString('pt-BR')}
            </p>
            {availableCompensations.length === 0 ? (
              <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
                Este colaborador não possui saldo de compensação disponível.
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Saldo disponível: {availableCompensations.length} compensação(ões)
                </p>
                <div>
                  <Label className="text-xs">Selecionar feriado</Label>
                  <Select
                    value={selectedCompensationId || availableCompensations[0]?.id}
                    onValueChange={setSelectedCompensationId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCompensations.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.holiday_name} ({new Date(c.holiday_date + 'T00:00:00').toLocaleDateString('pt-BR')})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Observação (opcional)</Label>
                  <Textarea
                    value={observation}
                    onChange={(e) => setObservation(e.target.value)}
                    rows={2}
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogType(null)}>Cancelar</Button>
            <Button
              onClick={handleSubmit}
              disabled={loading || availableCompensations.length === 0}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {loading ? 'Salvando...' : 'Aplicar Compensação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AJUSTE FOLGA Dialog — Two modes */}
      <Dialog open={dialogType === 'AJUSTE_FOLGA'} onOpenChange={(o) => !o && setDialogType(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5 text-orange-500" />
              Ajustar Folga — Semana de {weekStart.toLocaleDateString('pt-BR')}
            </DialogTitle>
            <DialogDescription>
              <strong>{collaboratorName}</strong> — folga fixa: {DAY_LABELS[currentDayOff] || currentDayOff || '—'}
            </DialogDescription>
          </DialogHeader>

          <Tabs value={ajusteMode} onValueChange={(v) => setAjusteMode(v as 'troca' | 'mover')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="troca" className="text-xs">
                <ArrowLeftRight className="w-3.5 h-3.5 mr-1" />
                Trocar com colega
              </TabsTrigger>
              <TabsTrigger value="mover" className="text-xs">
                <ArrowRight className="w-3.5 h-3.5 mr-1" />
                Mover folga
              </TabsTrigger>
            </TabsList>

            {/* Mode A: Swap with colleague */}
            <TabsContent value="troca" className="space-y-3 mt-3">
              <div>
                <Label className="text-xs">Trocar com</Label>
                <Select value={swapCollaboratorId} onValueChange={setSwapCollaboratorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione colaborador" />
                  </SelectTrigger>
                  <SelectContent>
                    {swapCandidates.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.collaborator_name} (folga: {DAY_LABELS[c.folgas_semanais[0]] || c.folgas_semanais[0] || '—'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {swapCollaboratorId && selectedSwapCollab && (
                <div className="rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30 p-3 space-y-1">
                  <p className="text-xs font-medium text-orange-700 dark:text-orange-400">Resultado da troca nesta semana:</p>
                  <p className="text-sm">
                    <strong>{collaboratorName}</strong>: {DAY_LABELS[currentDayOff]} → <strong>{DAY_LABELS[swapCollabDayOff]}</strong>
                  </p>
                  <p className="text-sm">
                    <strong>{selectedSwapCollab.collaborator_name}</strong>: {DAY_LABELS[swapCollabDayOff]} → <strong>{DAY_LABELS[currentDayOff]}</strong>
                  </p>
                </div>
              )}

              <div>
                <Label className="text-xs">Observação (opcional)</Label>
                <Textarea
                  value={observation}
                  onChange={(e) => setObservation(e.target.value)}
                  placeholder="Motivo da troca"
                  rows={2}
                />
              </div>
            </TabsContent>

            {/* Mode B: Move own day off */}
            <TabsContent value="mover" className="space-y-3 mt-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Folga atual nesta semana:</p>
                <p className="text-sm font-semibold">{DAY_LABELS[currentDayOff] || '—'}</p>
              </div>

              <div>
                <Label className="text-xs">Novo dia da folga nesta semana</Label>
                <Select value={newDayOff} onValueChange={setNewDayOff}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o dia" />
                  </SelectTrigger>
                  <SelectContent>
                    {DAY_OPTIONS.filter(d => d.value !== currentDayOff).map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {newDayOff && (
                <div className="rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30 p-3">
                  <p className="text-xs font-medium text-orange-700 dark:text-orange-400">Resultado nesta semana:</p>
                  <p className="text-sm">
                    <strong>{collaboratorName}</strong>: {DAY_LABELS[currentDayOff]} → <strong>{DAY_LABELS[newDayOff]}</strong>
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Apenas nesta semana. A folga fixa ({DAY_LABELS[currentDayOff]}) não será alterada.
                  </p>
                </div>
              )}

              <div>
                <Label className="text-xs">Observação (opcional)</Label>
                <Textarea
                  value={observation}
                  onChange={(e) => setObservation(e.target.value)}
                  placeholder="Motivo da mudança"
                  rows={2}
                />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogType(null)}>Cancelar</Button>
            <Button
              onClick={handleSubmit}
              disabled={
                loading ||
                (ajusteMode === 'troca' && !swapCollaboratorId) ||
                (ajusteMode === 'mover' && !newDayOff)
              }
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {loading ? 'Salvando...' : ajusteMode === 'troca' ? 'Aplicar Troca' : 'Mover Folga'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
