import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, AlertTriangle } from 'lucide-react';
import type { Demand } from '@/hooks/useDemands';
import { useAuth } from '@/contexts/AuthContext';

const TYPE_CONFIG: Record<string, { icon: string; label: string; className: string }> = {
  manutencao: { icon: '🔧', label: 'Manutenção', className: 'bg-orange-100 text-orange-700 border-orange-200' },
  compra: { icon: '🛒', label: 'Compra', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  tarefa: { icon: '✅', label: 'Tarefa', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  acompanhamento: { icon: '👁️', label: 'Acompanhamento', className: 'bg-purple-100 text-purple-700 border-purple-200' },
  ordem: { icon: '📋', label: 'Ordem', className: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  melhoria: { icon: '💡', label: 'Melhoria', className: 'bg-amber-100 text-amber-700 border-amber-200' },
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  aberta: { label: 'Aberta', className: 'bg-muted text-muted-foreground' },
  em_andamento: { label: 'Em andamento', className: 'bg-blue-100 text-blue-700' },
  aguardando_aprovacao: { label: 'Aguardando', className: 'bg-yellow-100 text-yellow-700' },
  concluida: { label: 'Concluída', className: 'bg-green-100 text-green-700' },
  cancelada: { label: 'Cancelada', className: 'bg-red-100 text-red-700' },
};

const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
  urgente: { label: 'Urgente', className: 'bg-red-100 text-red-700 border-red-200' },
  alta: { label: 'Alta', className: 'bg-orange-100 text-orange-700 border-orange-200' },
  media: { label: 'Média', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  baixa: { label: 'Baixa', className: 'bg-muted text-muted-foreground' },
};

interface DemandCardProps {
  demand: Demand;
  onClick: () => void;
}

export default function DemandCard({ demand, onClick }: DemandCardProps) {
  const { usuario } = useAuth();
  const typeConf = TYPE_CONFIG[demand.type] ?? TYPE_CONFIG.tarefa;
  const statusConf = STATUS_CONFIG[demand.status] ?? STATUS_CONFIG.aberta;
  const prioConf = PRIORITY_CONFIG[demand.priority] ?? PRIORITY_CONFIG.media;

  const isOverdue = demand.due_date && demand.due_date < new Date().toISOString().slice(0, 10) && !['concluida', 'cancelada'].includes(demand.status);
  const mode = demand.assigned_to === usuario?.id ? 'received' : 'sent';

  return (
    <Card className={`cursor-pointer hover:shadow-md transition-shadow ${isOverdue ? 'border-destructive/50' : ''}`} onClick={onClick}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium border ${typeConf.className}`}>
              {typeConf.icon} {typeConf.label}
            </span>
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${statusConf.className}`}>
              {statusConf.label}
            </span>
          </div>
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${prioConf.className}`}>
            {prioConf.label}
          </span>
        </div>

        <h4 className="text-sm font-semibold line-clamp-2">{demand.title}</h4>

        {demand.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{demand.description}</p>
        )}

        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <div className="flex items-center gap-2">
            {demand.due_date && (
              <span className={`flex items-center gap-0.5 ${isOverdue ? 'text-destructive font-medium' : ''}`}>
                {isOverdue && <AlertTriangle className="w-3 h-3" />}
                <Clock className="w-3 h-3" />
                {new Date(demand.due_date + 'T12:00').toLocaleDateString('pt-BR')}
              </span>
            )}
            <span className={mode === 'received' ? 'text-blue-600' : 'text-green-600'}>
              {mode === 'received' ? '📥 Recebida' : '📤 Enviada'}
            </span>
          </div>
          <span>{new Date(demand.created_at).toLocaleDateString('pt-BR')}</span>
        </div>
      </CardContent>
    </Card>
  );
}
