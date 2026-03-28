import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Send, Clock, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUpdateDemandStatus, useDemandComments, useDemandHistory, useUsuarios, type Demand } from '@/hooks/useDemands';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  em_andamento: { label: '🟡 Em andamento', className: 'bg-yellow-100 text-yellow-700' },
  concluida: { label: '✅ Concluído', className: 'bg-green-100 text-green-700' },
  aberta: { label: '🟡 Em andamento', className: 'bg-yellow-100 text-yellow-700' },
  aguardando_aprovacao: { label: '🟡 Em andamento', className: 'bg-yellow-100 text-yellow-700' },
  cancelada: { label: '✅ Concluído', className: 'bg-green-100 text-green-700' },
};

const TYPE_LABELS: Record<string, string> = {
  manutencao: '🔧 Manutenção', compra: '🛒 Compra', tarefa: '✅ Tarefa',
  acompanhamento: '✅ Tarefa', ordem: '✅ Tarefa', melhoria: '✅ Tarefa',
};

const PRIORITY_LABELS: Record<string, string> = {
  imp_urg: '🔴 Importante e Urgente',
  imp_nao_urg: '🟠 Importante mas não Urgente',
  urg_nao_imp: '🟡 Urgente mas não Importante',
  nao_urg_nao_imp: '⚪ Não Urgente e Não Importante',
  urgente: '🔴 Importante e Urgente',
  alta: '🟠 Importante mas não Urgente',
  media: '🟡 Urgente mas não Importante',
  baixa: '⚪ Não Urgente e Não Importante',
};

function getPublicUrl(path: string) {
  const { data } = supabase.storage.from('manutencao-fotos').getPublicUrl(path);
  return data.publicUrl;
}

interface DemandDetailDialogProps {
  demand: Demand;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function DemandDetailDialog({ demand, open, onOpenChange }: DemandDetailDialogProps) {
  const { usuario } = useAuth();
  const updateStatus = useUpdateDemandStatus();
  const { commentsQuery, addComment } = useDemandComments(demand.id);
  const { data: history = [] } = useDemandHistory(demand.id);
  const { data: usuarios = [] } = useUsuarios();
  const [newComment, setNewComment] = useState('');
  const [sending, setSending] = useState(false);

  const userMap = new Map(usuarios.map(u => [u.id, u.nome]));
  const isDone = ['concluida', 'cancelada'].includes(demand.status);
  const statusBadge = STATUS_BADGE[demand.status] ?? STATUS_BADGE.em_andamento;

  const handleConclude = () => {
    if (!usuario) return;
    updateStatus.mutate({
      demandId: demand.id, oldStatus: demand.status,
      newStatus: 'concluida', userId: usuario.id,
    }, {
      onSuccess: () => toast.success('Demanda concluída!'),
      onError: (e: any) => toast.error(e.message),
    });
  };

  const handleReopen = () => {
    if (!usuario) return;
    updateStatus.mutate({
      demandId: demand.id, oldStatus: demand.status,
      newStatus: 'em_andamento', userId: usuario.id,
    }, {
      onSuccess: () => toast.success('Demanda reaberta!'),
      onError: (e: any) => toast.error(e.message),
    });
  };

  const handleSendComment = async () => {
    if (!newComment.trim() || !usuario) return;
    setSending(true);
    try {
      await addComment.mutateAsync({ userId: usuario.id, comment: newComment.trim() });
      setNewComment('');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  const isOverdue = demand.due_date && demand.due_date < new Date().toISOString().slice(0, 10) && !isDone;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">{demand.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Meta */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-xs">{TYPE_LABELS[demand.type] || demand.type}</Badge>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusBadge.className}`}>
              {statusBadge.label}
            </span>
            {isOverdue && <Badge variant="destructive" className="text-[10px]">⚠️ Atrasada</Badge>}
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {demand.sector && <div><span className="text-muted-foreground text-xs">Setor</span><p className="font-medium">{demand.sector}</p></div>}
            {demand.due_date && <div><span className="text-muted-foreground text-xs">Prazo</span><p className={`font-medium ${isOverdue ? 'text-destructive' : ''}`}>{new Date(demand.due_date + 'T12:00').toLocaleDateString('pt-BR')}</p></div>}
            {demand.assigned_to && <div><span className="text-muted-foreground text-xs">Responsável</span><p className="font-medium">{userMap.get(demand.assigned_to) ?? '—'}</p></div>}
            <div><span className="text-muted-foreground text-xs">Criado por</span><p className="font-medium">{userMap.get(demand.created_by) ?? '—'}</p></div>
            {demand.item_name && <div><span className="text-muted-foreground text-xs">Item</span><p className="font-medium">{demand.item_name}</p></div>}
            {demand.stock_quantity && <div><span className="text-muted-foreground text-xs">Qtd estoque</span><p className="font-medium">{demand.stock_quantity}</p></div>}
            <div><span className="text-muted-foreground text-xs">Criado em</span><p className="font-medium">{new Date(demand.created_at).toLocaleDateString('pt-BR')}</p></div>
            <div><span className="text-muted-foreground text-xs">Prioridade</span><p className="font-medium">{PRIORITY_LABELS[demand.priority] ?? demand.priority}</p></div>
          </div>

          {demand.description && (
            <div>
              <span className="text-xs text-muted-foreground">Descrição</span>
              <p className="text-sm bg-muted rounded-lg p-3 mt-1 whitespace-pre-wrap">{demand.description}</p>
            </div>
          )}
          {demand.observation && (
            <div>
              <span className="text-xs text-muted-foreground">Observação</span>
              <p className="text-sm bg-muted rounded-lg p-2 mt-1">{demand.observation}</p>
            </div>
          )}

          {/* Photos */}
          {demand.photos && demand.photos.length > 0 && (
            <div>
              <span className="text-xs text-muted-foreground">Fotos ({demand.photos.length})</span>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {demand.photos.map((p, i) => (
                  <a key={i} href={getPublicUrl(p)} target="_blank" rel="noreferrer">
                    <img src={getPublicUrl(p)} alt="" className="w-full h-24 object-cover rounded-lg border border-border hover:opacity-80 transition-opacity" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          {usuario && (demand.created_by === usuario.id || demand.assigned_to === usuario.id) && (
            <div className="flex gap-2">
              {!isDone && (
                <Button size="sm" onClick={handleConclude} className="bg-green-600 hover:bg-green-700 text-white">
                  ✅ Concluir demanda
                </Button>
              )}
              {isDone && (
                <Button size="sm" variant="outline" onClick={handleReopen}>
                  🔄 Reabrir demanda
                </Button>
              )}
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <div>
              <span className="text-xs text-muted-foreground">Histórico</span>
              <div className="space-y-1 mt-1">
                {history.map(h => (
                  <div key={h.id} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <Clock className="w-3 h-3 shrink-0" />
                    <span>{new Date(h.created_at).toLocaleString('pt-BR')}</span>
                    <span className="font-medium text-foreground">{userMap.get(h.changed_by) ?? '—'}</span>
                    {h.old_status && <><span>{h.old_status}</span><ArrowRight className="w-3 h-3" /></>}
                    <span className="font-medium">{h.new_status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comments */}
          <div>
            <span className="text-xs text-muted-foreground">Comentários</span>
            <div className="space-y-2 mt-1 max-h-40 overflow-y-auto">
              {(commentsQuery.data || []).map(c => (
                <div key={c.id} className="bg-muted rounded-lg p-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium">{userMap.get(c.user_id) ?? '—'}</span>
                    <span className="text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleString('pt-BR')}</span>
                  </div>
                  <p className="text-sm">{c.comment}</p>
                </div>
              ))}
              {(!commentsQuery.data || commentsQuery.data.length === 0) && (
                <p className="text-xs text-muted-foreground py-2">Nenhum comentário.</p>
              )}
            </div>
            <div className="flex gap-2 mt-2">
              <Textarea value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Adicionar comentário..." rows={2} className="text-sm" />
              <Button size="sm" onClick={handleSendComment} disabled={sending || !newComment.trim()} className="self-end">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
