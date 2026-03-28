import { useState, useMemo } from 'react';
import { Plus, Eye, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useDemands, useUpdateDemandStatus, useUsuarios, type Demand } from '@/hooks/useDemands';
import { useAuth } from '@/contexts/AuthContext';
import NewDemandDialog from '@/components/demands/NewDemandDialog';
import DemandDetailDialog from '@/components/demands/DemandDetailDialog';
import { toast } from 'sonner';

const TYPE_OPTIONS = [
  { value: 'all', label: 'Todos os tipos' },
  { value: 'manutencao', label: '🔧 Manutenção' },
  { value: 'compra', label: '🛒 Compra' },
  { value: 'tarefa', label: '✅ Tarefa' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos os status' },
  { value: 'em_andamento', label: '🟡 Em andamento' },
  { value: 'concluida', label: '✅ Concluído' },
];

const PRIORITY_OPTIONS = [
  { value: 'all', label: 'Todas prioridades' },
  { value: 'imp_urg', label: '🔴 Imp. + Urg.' },
  { value: 'imp_nao_urg', label: '🟠 Imp. não Urg.' },
  { value: 'urg_nao_imp', label: '🟡 Urg. não Imp.' },
  { value: 'nao_urg_nao_imp', label: '⚪ Não Urg/Imp' },
];

const PRIORITY_ORDER: Record<string, number> = {
  imp_urg: 0, imp_nao_urg: 1, urg_nao_imp: 2, nao_urg_nao_imp: 3,
  // Legacy fallbacks
  urgente: 0, alta: 1, media: 2, baixa: 3,
};

const PRIORITY_BADGE: Record<string, { label: string; className: string }> = {
  imp_urg: { label: '🔴 Imp. + Urg.', className: 'bg-red-100 text-red-700 border-red-200' },
  imp_nao_urg: { label: '🟠 Imp. não Urg.', className: 'bg-orange-100 text-orange-700 border-orange-200' },
  urg_nao_imp: { label: '🟡 Urg. não Imp.', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  nao_urg_nao_imp: { label: '⚪ Não Urg/Imp', className: 'bg-muted text-muted-foreground border-border' },
  // Legacy
  urgente: { label: '🔴 Imp. + Urg.', className: 'bg-red-100 text-red-700 border-red-200' },
  alta: { label: '🟠 Imp. não Urg.', className: 'bg-orange-100 text-orange-700 border-orange-200' },
  media: { label: '🟡 Urg. não Imp.', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  baixa: { label: '⚪ Não Urg/Imp', className: 'bg-muted text-muted-foreground border-border' },
};

const TYPE_ICON: Record<string, string> = {
  manutencao: '🔧', compra: '🛒', tarefa: '✅',
  acompanhamento: '✅', ordem: '✅', melhoria: '✅',
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  em_andamento: { label: '🟡 Em andamento', className: 'bg-yellow-100 text-yellow-700' },
  concluida: { label: '✅ Concluído', className: 'bg-green-100 text-green-700' },
  // Legacy
  aberta: { label: '🟡 Em andamento', className: 'bg-yellow-100 text-yellow-700' },
  aguardando_aprovacao: { label: '🟡 Em andamento', className: 'bg-yellow-100 text-yellow-700' },
  cancelada: { label: '✅ Concluído', className: 'bg-green-100 text-green-700' },
};

export default function Demandas() {
  const { usuario } = useAuth();
  const { data: allDemands = [], isLoading } = useDemands();
  const { data: usuarios = [] } = useUsuarios();
  const updateStatus = useUpdateDemandStatus();
  const [newOpen, setNewOpen] = useState(false);
  const [selectedDemand, setSelectedDemand] = useState<Demand | null>(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  const userMap = useMemo(() => new Map(usuarios.map(u => [u.id, u.nome])), [usuarios]);

  const demands = useMemo(() => {
    let list = allDemands;
    if (typeFilter !== 'all') list = list.filter(d => d.type === typeFilter);
    if (statusFilter !== 'all') {
      if (statusFilter === 'em_andamento') {
        list = list.filter(d => !['concluida', 'cancelada'].includes(d.status));
      } else {
        list = list.filter(d => ['concluida', 'cancelada'].includes(d.status));
      }
    }
    if (priorityFilter !== 'all') list = list.filter(d => d.priority === priorityFilter);
    return [...list].sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority] ?? 2;
      const pb = PRIORITY_ORDER[b.priority] ?? 2;
      if (pa !== pb) return pa - pb;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [allDemands, typeFilter, statusFilter, priorityFilter]);

  const handleConclude = (d: Demand) => {
    if (!usuario) return;
    updateStatus.mutate({
      demandId: d.id, oldStatus: d.status,
      newStatus: 'concluida', userId: usuario.id,
    }, {
      onSuccess: () => toast.success('Demanda concluída!'),
      onError: (e: any) => toast.error(e.message),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Demandas</h1>
        <Button onClick={() => setNewOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Nova Demanda
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40 h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-44 h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PRIORITY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{demands.length} demanda(s)</span>
      </div>

      {/* Table */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
      ) : demands.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhuma demanda encontrada.</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-12">Tipo</TableHead>
                <TableHead>Título</TableHead>
                <TableHead className="w-32">Responsável</TableHead>
                <TableHead className="w-36">Prioridade</TableHead>
                <TableHead className="w-36">Status</TableHead>
                <TableHead className="w-24">Data</TableHead>
                <TableHead className="w-20 text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {demands.map(d => {
                const prioBadge = PRIORITY_BADGE[d.priority] ?? PRIORITY_BADGE.media;
                const statusBadge = STATUS_BADGE[d.status] ?? STATUS_BADGE.em_andamento;
                const isDone = ['concluida', 'cancelada'].includes(d.status);
                return (
                  <TableRow key={d.id} className={isDone ? 'opacity-60' : ''}>
                    <TableCell className="text-center text-lg">{TYPE_ICON[d.type] ?? '✅'}</TableCell>
                    <TableCell>
                      <div className="font-semibold text-sm line-clamp-1">{d.title}</div>
                      {d.description && <div className="text-xs text-muted-foreground line-clamp-1">{d.description}</div>}
                    </TableCell>
                    <TableCell className="text-sm">{d.assigned_to ? (userMap.get(d.assigned_to) ?? '—') : '—'}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${prioBadge.className}`}>
                        {prioBadge.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${statusBadge.className}`}>
                        {statusBadge.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(d.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedDemand(d)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        {!isDone && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600 hover:text-green-700" onClick={() => handleConclude(d)}>
                            <Check className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <NewDemandDialog open={newOpen} onOpenChange={setNewOpen} />

      {selectedDemand && (
        <DemandDetailDialog
          demand={selectedDemand}
          open={!!selectedDemand}
          onOpenChange={open => { if (!open) setSelectedDemand(null); }}
        />
      )}
    </div>
  );
}
