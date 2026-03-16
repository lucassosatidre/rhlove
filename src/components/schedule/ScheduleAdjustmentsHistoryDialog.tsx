import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useRevertScheduleEvent, useScheduleAdjustmentHistory, type ScheduleEvent } from '@/hooks/useScheduleEvents';
import { ArrowLeftRight, ArrowRight, History, RotateCcw } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DAY_LABELS: Record<string, string> = {
  SEGUNDA: 'Segunda',
  TERCA: 'Terça',
  QUARTA: 'Quarta',
  QUINTA: 'Quinta',
  SEXTA: 'Sexta',
  SABADO: 'Sábado',
  DOMINGO: 'Domingo',
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

const getTypeLabel = (event: ScheduleEvent) => {
  if (event.event_type === 'TROCA_FOLGA') return 'Troca entre colaboradores';
  return 'Mudança excepcional sem troca';
};

const getPeopleLabel = (event: ScheduleEvent) => {
  if (event.related_collaborator_name) {
    return `${event.collaborator_name} ↔ ${event.related_collaborator_name}`;
  }
  return event.collaborator_name;
};

const getAdjustmentLabel = (event: ScheduleEvent) => {
  const original = DAY_LABELS[event.original_day || ''] || event.original_day || '—';
  const next = DAY_LABELS[event.swapped_day || ''] || event.swapped_day || '—';
  return `${original} → ${next}`;
};

export default function ScheduleAdjustmentsHistoryDialog({ open, onOpenChange }: Props) {
  const { data: history = [], isLoading } = useScheduleAdjustmentHistory();
  const revertEvent = useRevertScheduleEvent();
  const { usuario } = useAuth();
  const { toast } = useToast();

  const handleRevert = async (event: ScheduleEvent) => {
    if (!confirm('Reverter este ajuste de folga?')) return;

    try {
      await revertEvent.mutateAsync({
        id: event.id,
        reverted_by: usuario?.nome || usuario?.email || null,
        reverted_reason: 'Revertido pelo histórico de trocas',
      });
      toast({ title: 'Troca revertida com sucesso' });
    } catch (error: any) {
      toast({
        title: 'Erro ao reverter troca',
        description: error?.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            Histórico de Trocas
          </DialogTitle>
          <DialogDescription>
            Consulte os ajustes de folga e reverta qualquer registro ativo sem perder a rastreabilidade.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando histórico...</p>
        ) : history.length === 0 ? (
          <div className="rounded-lg border border-border bg-muted/30 p-6 text-sm text-muted-foreground">
            Nenhum ajuste de folga registrado ainda.
          </div>
        ) : (
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Semana</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Colaboradores</TableHead>
                  <TableHead>Ajuste</TableHead>
                  <TableHead>Observação</TableHead>
                  <TableHead>Registrado por</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((event) => {
                  const isActive = event.status === 'ATIVO';
                  return (
                    <TableRow key={event.id}>
                      <TableCell className="font-medium">{formatDateBR(event.week_start || event.event_date)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          {event.event_type === 'TROCA_FOLGA' ? (
                            <ArrowLeftRight className="w-4 h-4 text-primary" />
                          ) : (
                            <ArrowRight className="w-4 h-4 text-primary" />
                          )}
                          {getTypeLabel(event)}
                        </div>
                      </TableCell>
                      <TableCell>{getPeopleLabel(event)}</TableCell>
                      <TableCell>{getAdjustmentLabel(event)}</TableCell>
                      <TableCell className="max-w-[220px] truncate text-muted-foreground text-xs">
                        {event.observation || '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{event.created_by || '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDateTimeBR(event.created_at)}</TableCell>
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
                            onClick={() => handleRevert(event)}
                            disabled={revertEvent.isPending}
                            className="gap-2"
                          >
                            <RotateCcw className="w-4 h-4" />
                            Reverter troca
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">
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
  );
}
