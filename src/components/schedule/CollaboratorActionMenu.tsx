import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useCreateScheduleEvent, type ScheduleEventInput } from '@/hooks/useScheduleEvents';
import { useHolidayCompensations, useUpdateHolidayCompensation, type HolidayCompensation } from '@/hooks/useHolidayCompensations';
import type { Collaborator } from '@/types/collaborator';
import { AlertTriangle, Calendar, FileText, Gift, ArrowLeftRight } from 'lucide-react';

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
  const [dialogType, setDialogType] = useState<'FALTA' | 'ATESTADO' | 'COMPENSACAO' | 'TROCA_FOLGA' | null>(null);
  const [observation, setObservation] = useState('');
  const [atestadoEnd, setAtestadoEnd] = useState('');
  const [swapCollaboratorId, setSwapCollaboratorId] = useState('');
  const [swapDay, setSwapDay] = useState('');
  const [loading, setLoading] = useState(false);

  const { toast } = useToast();
  const createEvent = useCreateScheduleEvent();
  const { data: compensations = [] } = useHolidayCompensations();
  const updateCompensation = useUpdateHolidayCompensation();

  const dateKey = formatDateKey(date);
  const weekStartKey = formatDateKey(weekStart);

  // Available compensations for this collaborator
  const availableCompensations = compensations.filter(
    (c) => c.collaborator_id === collaboratorId && c.status === 'SIM'
  );

  const [selectedCompensationId, setSelectedCompensationId] = useState('');

  const openDialog = (type: typeof dialogType) => {
    setDialogType(type);
    setOpen(false);
    setObservation('');
    setAtestadoEnd('');
    setSwapCollaboratorId('');
    setSwapDay('');
    setSelectedCompensationId('');
  };

  const handleSubmit = async () => {
    if (!dialogType) return;
    setLoading(true);

    try {
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
        // Update compensation status to COMPENSADO
        await updateCompensation.mutateAsync({
          id: compId,
          status: 'COMPENSADO',
          compensation_date: dateKey,
        });
      }

      if (dialogType === 'TROCA_FOLGA') {
        if (!swapCollaboratorId || !swapDay) {
          toast({ title: 'Selecione o colaborador e o dia da troca', variant: 'destructive' });
          setLoading(false);
          return;
        }
        const swapCollab = allCollaborators.find((c) => c.id === swapCollaboratorId);
        base.related_collaborator_id = swapCollaboratorId;
        base.related_collaborator_name = swapCollab?.collaborator_name || '';
        base.original_day = swapDay;
        // The collaborator's original day off that will now be the swapped collaborator's day off
        const collabDayOff = allCollaborators.find((c) => c.id === collaboratorId)?.folgas_semanais[0] || '';
        base.swapped_day = collabDayOff;
        base.week_start = weekStartKey;
      }

      await createEvent.mutateAsync(base);

      const labels: Record<string, string> = {
        FALTA: 'Falta registrada',
        ATESTADO: 'Atestado registrado',
        COMPENSACAO: 'Compensação aplicada',
        TROCA_FOLGA: 'Troca de folga aplicada',
      };

      toast({ title: labels[dialogType] });
      setDialogType(null);
    } catch (e: any) {
      toast({ title: 'Erro ao registrar', description: e?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const DAY_OPTIONS = [
    { value: 'SEGUNDA', label: 'Segunda' },
    { value: 'TERCA', label: 'Terça' },
    { value: 'QUARTA', label: 'Quarta' },
    { value: 'QUINTA', label: 'Quinta' },
    { value: 'SEXTA', label: 'Sexta' },
    { value: 'SABADO', label: 'Sábado' },
    { value: 'DOMINGO', label: 'Domingo' },
  ];

  // Other collaborators in same sector for swap
  const swapCandidates = allCollaborators.filter(
    (c) => c.id !== collaboratorId && c.sector === sector && c.status === 'ATIVO'
  );

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
              onClick={() => openDialog('TROCA_FOLGA')}
            >
              <ArrowLeftRight className="w-4 h-4 text-orange-500" />
              Trocar folga nesta semana
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

      {/* TROCA_FOLGA Dialog */}
      <Dialog open={dialogType === 'TROCA_FOLGA'} onOpenChange={(o) => !o && setDialogType(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5 text-orange-500" />
              Trocar Folga Nesta Semana
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">
              <strong>{collaboratorName}</strong> — Semana de{' '}
              {weekStart.toLocaleDateString('pt-BR')}
            </p>
            <div>
              <Label className="text-xs">Trocar com</Label>
              <Select value={swapCollaboratorId} onValueChange={setSwapCollaboratorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione colaborador" />
                </SelectTrigger>
                <SelectContent>
                  {swapCandidates.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.collaborator_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Dia da folga a trocar</Label>
              <Select value={swapDay} onValueChange={setSwapDay}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o dia" />
                </SelectTrigger>
                <SelectContent>
                  {DAY_OPTIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogType(null)}>Cancelar</Button>
            <Button
              onClick={handleSubmit}
              disabled={loading || !swapCollaboratorId || !swapDay}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {loading ? 'Salvando...' : 'Aplicar Troca'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
