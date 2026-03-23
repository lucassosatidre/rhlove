import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useTasks, useTaskComments, useTaskHistory, useUsuarios, type Task } from '@/hooks/useTasks';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

const STATUS_LABELS: Record<string, string> = {
  aberta: '🔵 Aberta',
  em_andamento: '🟡 Em andamento',
  aguardando_aprovacao: '🟠 Aguardando aprovação',
  concluida: '✅ Concluída',
  cancelada: '❌ Cancelada',
};

interface Props {
  task: Task;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export default function TaskDetailDialog({ task, open, onOpenChange }: Props) {
  const { usuario } = useAuth();
  const { updateTaskStatus } = useTasks();
  const { commentsQuery, addComment } = useTaskComments(task.id);
  const { data: history } = useTaskHistory(task.id);
  const { data: usuarios } = useUsuarios();
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const isCreator = usuario?.id === task.created_by;
  const isAssignee = usuario?.id === task.assigned_to;
  const getUserName = (id: string) => usuarios?.find(u => u.id === id)?.nome || '...';

  const changeStatus = async (newStatus: string) => {
    setSaving(true);
    try {
      await updateTaskStatus.mutateAsync({
        taskId: task.id,
        oldStatus: task.status,
        newStatus,
        userId: usuario!.id,
      });
      toast.success('Status atualizado!');
      onOpenChange(false);
    } catch {
      toast.error('Erro ao atualizar status');
    } finally {
      setSaving(false);
    }
  };

  const handleComment = async () => {
    if (!comment.trim() || !usuario) return;
    try {
      await addComment.mutateAsync({ userId: usuario.id, comment: comment.trim() });
      setComment('');
      toast.success('Comentário adicionado');
    } catch {
      toast.error('Erro ao comentar');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{task.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {task.description && <p className="text-sm text-muted-foreground">{task.description}</p>}

          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="secondary">{task.category}</Badge>
            <Badge variant="outline" className="capitalize">{task.priority}</Badge>
            <Badge>{STATUS_LABELS[task.status] || task.status}</Badge>
          </div>

          <div className="text-xs space-y-1 text-muted-foreground">
            <p>Criado por: <span className="text-foreground font-medium">{getUserName(task.created_by)}</span></p>
            <p>Direcionado para: <span className="text-foreground font-medium">{getUserName(task.assigned_to)}</span></p>
            <p>Prazo: <span className="text-foreground font-medium">{parseISO(task.due_date).toLocaleDateString('pt-BR')}</span></p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            {isAssignee && task.status === 'aberta' && (
              <Button size="sm" variant="outline" onClick={() => changeStatus('em_andamento')} disabled={saving}>
                Iniciar
              </Button>
            )}
            {isAssignee && task.status === 'em_andamento' && (
              <Button size="sm" variant="outline" onClick={() => changeStatus('aguardando_aprovacao')} disabled={saving}>
                Marcar como concluída
              </Button>
            )}
            {isCreator && task.status === 'aguardando_aprovacao' && (
              <Button size="sm" onClick={() => changeStatus('concluida')} disabled={saving}>
                Aprovar conclusão
              </Button>
            )}
            {isCreator && !['concluida', 'cancelada'].includes(task.status) && (
              <Button size="sm" variant="destructive" onClick={() => changeStatus('cancelada')} disabled={saving}>
                Cancelar
              </Button>
            )}
          </div>

          <Separator />

          {/* Timeline */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Histórico</h4>
            <div className="space-y-2">
              {history?.map(h => (
                <div key={h.id} className="flex items-start gap-2 text-xs">
                  <div className="w-2 h-2 rounded-full bg-primary mt-1 shrink-0" />
                  <div>
                    <span className="font-medium">{getUserName(h.changed_by)}</span>
                    {' '}{h.old_status ? `${STATUS_LABELS[h.old_status] || h.old_status} → ` : ''}
                    {STATUS_LABELS[h.new_status] || h.new_status}
                    <span className="text-muted-foreground ml-2">{format(parseISO(h.created_at), 'dd/MM HH:mm')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Comments */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Comentários</h4>
            <div className="space-y-2 mb-3 max-h-40 overflow-y-auto">
              {commentsQuery.data?.map(c => (
                <div key={c.id} className={cn('rounded-lg p-2 text-xs', c.user_id === usuario?.id ? 'bg-primary/10 ml-4' : 'bg-muted mr-4')}>
                  <span className="font-semibold">{getUserName(c.user_id)}</span>
                  <span className="text-muted-foreground ml-2">{format(parseISO(c.created_at), 'dd/MM HH:mm')}</span>
                  <p className="mt-1">{c.comment}</p>
                </div>
              ))}
              {commentsQuery.data?.length === 0 && <p className="text-xs text-muted-foreground">Nenhum comentário.</p>}
            </div>
            {!['concluida', 'cancelada'].includes(task.status) && (
              <div className="flex gap-2">
                <Textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Adicionar comentário..." rows={2} className="text-xs" />
                <Button size="sm" onClick={handleComment} disabled={!comment.trim()}>Enviar</Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
