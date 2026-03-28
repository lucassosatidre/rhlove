import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useRevertScheduleEvent, useScheduleAdjustmentHistory, type ScheduleEvent } from '@/hooks/useScheduleEvents';
import { useUpdateHolidayCompensation } from '@/hooks/useHolidayCompensations';
import { ArrowLeftRight, ArrowRight, AlertTriangle, FileText, Gift, History, RotateCcw } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type FilterTab = 'todos' | 'faltas' | 'atestados' | 'compensacoes' | 'ajustes';

const DAY_LABELS: Record<string, string> = {
  SEGUNDA: 'Segunda', TERCA: 'Terça', QUARTA: 'Quarta', QUINTA: 'Quinta',
  SEXTA: 'Sexta', SABADO: 'Sábado', DOMINGO: 'Domingo',
};

const formatDateBR = (value: string | null) => {
  if (!value) return '—';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
};

const formatDateTimeBR = (value: string | null) => {
  if (!value) return '—';
  return new Date(value).toLocaleString('pt-BR');
};

const EVENT_CONFIG: Record<string, { label: string; icon: React.ReactNode; badgeClass: string }> = {
  FALTA: {
    label: 'Falta',
    icon: <AlertTriangle className="w-4 h-4 text-destructive" />,
    badgeClass: 'bg-destructive text-destructive-foreground',
  },
  ATESTADO: {
    label: 'Atestado',
    icon: <FileText className="w-4 h-4 text-blue-500" />,
    badgeClass: 'bg-blue-500 text-white',
  },
  COMPENSACAO: {
    label: 'Compensação',
    icon: <Gift className="w-4 h-4 text-green-600" />,
    badgeClass: 'bg-green-600 text-white',
  },
  TROCA_FOLGA: {
    label: 'Troca de folga',
    icon: <ArrowLeftRight className="w-4 h-4 text-orange-500" />,
    badgeClass: 'bg-orange-500 text-white',
  },
  MUDANCA_FOLGA: {
    label: 'Mudança de folga',
    icon: <ArrowRight className="w-4 h-4 text-orange-500" />,
    badgeClass: 'bg-orange-500 text-white',
  },
  TROCA_DOMINGO: {
    label: 'Troca de domingo',
    icon: <ArrowLeftRight className="w-4 h-4 text-purple-500" />,
    badgeClass: 'bg-purple-500 text-white',
  },
};

const getDateDisplay = (event: ScheduleEvent) => {
  if (event.event_type === 'TROCA_FOLGA' || event.event_type === 'MUDANCA_FOLGA') {
    return `Semana ${formatDateBR(event.week_start || event.event_date)}`;
  }
  if (event.event_type === 'TROCA_DOMINGO') {
    return formatDateBR(event.swapped_day || event.event_date);
  }
  const start = formatDateBR(event.event_date);
  if (event.event_date_end && event.event_date_end !== event.event_date) {
    return `${start} → ${formatDateBR(event.event_date_end)}`;
  }
  return start;
};

const getDetailDisplay = (event: ScheduleEvent) => {
  if (event.event_type === 'TROCA_FOLGA' || event.event_type === 'MUDANCA_FOLGA') {
    const original = DAY_LABELS[event.original_day || ''] || event.original_day || '—';
    const next = DAY_LABELS[event.swapped_day || ''] || event.swapped_day || '—';
    return `${original} → ${next}`;
  }
  if (event.event_type === 'TROCA_DOMINGO') {
    const origDate = event.original_day ? formatDateBR(event.original_day) : '—';
    const newDate = event.swapped_day ? formatDateBR(event.swapped_day) : '—';
    return `Dom ${origDate} → Dom ${newDate}`;
  }
  return '—';
};

const getPeopleDisplay = (event: ScheduleEvent) => {
  if (event.related_collaborator_name) {
    return `${event.collaborator_name} ↔ ${event.related_collaborator_name}`;
  }
  return event.collaborator_name;
};

const FILTER_TYPES: Record<FilterTab, string[]> = {
  todos: [],
  faltas: ['FALTA'],
  atestados: ['ATESTADO'],
  compensacoes: ['COMPENSACAO'],
  ajustes: ['TROCA_FOLGA', 'MUDANCA_FOLGA'],
};

export default function ScheduleAdjustmentsHistoryDialog({ open, onOpenChange }: Props) {
  const { data: history = [], isLoading } = useScheduleAdjustmentHistory();
  const revertEvent = useRevertScheduleEvent();
  const updateCompensation = useUpdateHolidayCompensation();
  const { usuario } = useAuth();
  const { toast } = useToast();
  const [filter, setFilter] = useState<FilterTab>('todos');
  const [revertingId, setRevertingId] = useState<string | null>(null);
  const [revertReason, setRevertReason] = useState('');

  const filtered = filter === 'todos'
    ? history
    : history.filter(e => FILTER_TYPES[filter].includes(e.event_type));

  const handleRevert = async (event: ScheduleEvent) => {
    try {
      await revertEvent.mutateAsync({
        id: event.id,
        reverted_by: usuario?.nome || usuario?.email || null,
        reverted_reason: revertReason || 'Revertido manualmente',
      });

      // If COMPENSACAO, restore the holiday_compensation back to pending
      if (event.event_type === 'COMPENSACAO' && event.holiday_compensation_id) {
        await updateCompensation.mutateAsync({
          id: event.holiday_compensation_id,
          status: 'SIM',
          compensation_date: null,
        });
      }

      toast({ title: 'Evento revertido com sucesso' });
      setRevertingId(null);
      setRevertReason('');
    } catch (error: any) {
      toast({
        title: 'Erro ao reverter',
        description: error?.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-6xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              Histórico de Eventos
            </DialogTitle>
            <DialogDescription>
              Consulte todos os eventos registrados (faltas, atestados, compensações, ajustes de folga) e reverta qualquer registro ativo.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterTab)} className="mb-2">
            <TabsList>
              <TabsTrigger value="todos">Todos</TabsTrigger>
              <TabsTrigger value="faltas">Faltas</TabsTrigger>
              <TabsTrigger value="atestados">Atestados</TabsTrigger>
              <TabsTrigger value="compensacoes">Compensações</TabsTrigger>
              <TabsTrigger value="ajustes">Ajustes de Folga</TabsTrigger>
            </TabsList>
          </Tabs>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando histórico...</p>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border border-border bg-muted/30 p-6 text-sm text-muted-foreground">
              Nenhum evento encontrado.
            </div>
          ) : (
            <div className="rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Colaborador(es)</TableHead>
                    <TableHead>Detalhe</TableHead>
                    <TableHead>Observação</TableHead>
                    <TableHead>Registrado por</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((event) => {
                    const isActive = event.status === 'ATIVO';
                    const config = EVENT_CONFIG[event.event_type] || {
                      label: event.event_type,
                      icon: null,
                      badgeClass: 'bg-muted',
                    };

                    return (
                      <TableRow key={event.id} className={!isActive ? 'opacity-60' : ''}>
                        <TableCell className="font-medium whitespace-nowrap">{getDateDisplay(event)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm whitespace-nowrap">
                            {config.icon}
                            {config.label}
                          </div>
                        </TableCell>
                        <TableCell>{getPeopleDisplay(event)}</TableCell>
                        <TableCell className="whitespace-nowrap">{getDetailDisplay(event)}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-muted-foreground text-xs">
                          {event.observation || '—'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{event.created_by || '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTimeBR(event.created_at)}</TableCell>
                        <TableCell>
                          {isActive ? (
                            <Badge>Ativo</Badge>
                          ) : (
                            <Badge variant="secondary">Revertido</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {isActive ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => { setRevertingId(event.id); setRevertReason(''); }}
                              className="gap-1.5"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Reverter
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground block">
                              {event.reverted_reason && <span className="block">{event.reverted_reason}</span>}
                              {formatDateTimeBR(event.reverted_at)}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm revert dialog */}
      <Dialog open={!!revertingId} onOpenChange={(o) => { if (!o) { setRevertingId(null); setRevertReason(''); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-primary" />
              Confirmar Reversão
            </DialogTitle>
            <DialogDescription>
              Esta ação marcará o evento como revertido. A rastreabilidade será mantida.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Motivo da reversão (opcional)</Label>
              <Textarea
                value={revertReason}
                onChange={(e) => setRevertReason(e.target.value)}
                placeholder="Ex: lançamento incorreto, informação errada"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRevertingId(null); setRevertReason(''); }}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={revertEvent.isPending}
              onClick={() => {
                const event = history.find(e => e.id === revertingId);
                if (event) handleRevert(event);
              }}
            >
              {revertEvent.isPending ? 'Revertendo...' : 'Confirmar Reversão'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
