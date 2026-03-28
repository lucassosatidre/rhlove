import { differenceInDays, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useUsuarios, type Task } from '@/hooks/useTasks';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  aberta: { label: 'Aberta', color: 'bg-blue-500' },
  em_andamento: { label: 'Em andamento', color: 'bg-yellow-500' },
  aguardando_aprovacao: { label: 'Aguardando aprovação', color: 'bg-orange-500' },
  concluida: { label: 'Concluída', color: 'bg-green-500' },
  cancelada: { label: 'Cancelada', color: 'bg-red-500' },
};

const PRIORITY_COLORS: Record<string, string> = {
  baixa: 'border-muted-foreground/30',
  media: 'border-primary/40',
  alta: 'border-orange-500',
  urgente: 'border-destructive',
};

const CATEGORY_LABELS: Record<string, string> = {
  tarefa: 'Tarefa',
  acompanhamento: 'Acompanhamento',
  ordem: 'Ordem',
  melhoria: 'Melhoria',
};

interface Props {
  task: Task;
  mode: 'received' | 'sent';
  onClick: () => void;
}

export default function TaskCard({ task, mode, onClick }: Props) {
  const { data: usuarios } = useUsuarios();
  const { usuario } = useAuth();
  const today = new Date();
  const due = parseISO(task.due_date);
  const daysLeft = differenceInDays(due, today);
  const isOverdue = daysLeft < 0 && !['concluida', 'cancelada'].includes(task.status);
  const statusInfo = STATUS_MAP[task.status] || STATUS_MAP.aberta;

  const otherUser = usuarios?.find(u => u.id === (mode === 'received' ? task.created_by : task.assigned_to));

  // Determine direction tag
  const isReceived = task.assigned_to === usuario?.id;
  const isSent = task.created_by === usuario?.id;
  const directionLabel = isReceived && isSent ? '📤 Enviada / 📥 Recebida' : isReceived ? '📥 Recebida' : '📤 Enviada';

  return (
    <Card
      onClick={onClick}
      className={cn(
        'p-4 cursor-pointer hover:shadow-md transition-shadow border-l-4',
        isOverdue ? 'border-l-destructive bg-destructive/5' : PRIORITY_COLORS[task.priority] || '',
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-semibold text-sm line-clamp-2">{task.title}</h3>
        <div className={cn('w-2.5 h-2.5 rounded-full shrink-0 mt-1', statusInfo.color)} title={statusInfo.label} />
      </div>

      <div className="flex flex-wrap gap-1.5 mb-2">
        <Badge variant="secondary" className="text-[10px]">{CATEGORY_LABELS[task.category] || task.category}</Badge>
        <Badge variant="outline" className="text-[10px] capitalize">{task.priority}</Badge>
        <Badge variant="outline" className="text-[10px]">{directionLabel}</Badge>
      </div>

      <p className="text-xs text-muted-foreground mb-1">
        {mode === 'received' ? 'De' : 'Para'}: <span className="font-medium text-foreground">{otherUser?.nome || '...'}</span>
      </p>

      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">
          Prazo: {due.toLocaleDateString('pt-BR')}
        </span>
        <span className={cn('text-[10px] font-semibold', isOverdue ? 'text-destructive' : daysLeft <= 2 ? 'text-orange-500' : 'text-muted-foreground')}>
          {isOverdue ? `${Math.abs(daysLeft)}d em atraso` : daysLeft === 0 ? 'Hoje' : `${daysLeft}d restantes`}
        </span>
      </div>

      <p className="text-[10px] mt-1 text-muted-foreground">{statusInfo.label}</p>
    </Card>
  );
}
