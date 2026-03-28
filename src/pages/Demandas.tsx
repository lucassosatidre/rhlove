import { useState, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDemands, type Demand } from '@/hooks/useDemands';
import { useAuth } from '@/contexts/AuthContext';
import NewDemandDialog from '@/components/demands/NewDemandDialog';
import DemandCard from '@/components/demands/DemandCard';
import DemandDetailDialog from '@/components/demands/DemandDetailDialog';

const TYPE_OPTIONS = [
  { value: 'all', label: 'Todos os tipos' },
  { value: 'manutencao', label: '🔧 Manutenção' },
  { value: 'compra', label: '🛒 Compra' },
  { value: 'tarefa', label: '✅ Tarefa' },
  { value: 'acompanhamento', label: '👁️ Acompanhamento' },
  { value: 'ordem', label: '📋 Ordem' },
  { value: 'melhoria', label: '💡 Melhoria' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos os status' },
  { value: 'aberta', label: 'Aberta' },
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'aguardando_aprovacao', label: 'Aguardando aprovação' },
  { value: 'concluida', label: 'Concluída' },
  { value: 'cancelada', label: 'Cancelada' },
];

const PRIORITY_OPTIONS = [
  { value: 'all', label: 'Todas prioridades' },
  { value: 'urgente', label: 'Urgente' },
  { value: 'alta', label: 'Alta' },
  { value: 'media', label: 'Média' },
  { value: 'baixa', label: 'Baixa' },
];

const PRIORITY_ORDER: Record<string, number> = { urgente: 0, alta: 1, media: 2, baixa: 3 };

export default function Demandas() {
  const { usuario } = useAuth();
  const { data: allDemands = [], isLoading } = useDemands();
  const [newOpen, setNewOpen] = useState(false);
  const [selectedDemand, setSelectedDemand] = useState<Demand | null>(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  const demands = useMemo(() => {
    let list = allDemands;
    if (typeFilter !== 'all') list = list.filter(d => d.type === typeFilter);
    if (statusFilter !== 'all') list = list.filter(d => d.status === statusFilter);
    if (priorityFilter !== 'all') list = list.filter(d => d.priority === priorityFilter);
    // Sort: priority desc, then newest first
    list = [...list].sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority] ?? 2;
      const pb = PRIORITY_ORDER[b.priority] ?? 2;
      if (pa !== pb) return pa - pb;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return list;
  }, [allDemands, typeFilter, statusFilter, priorityFilter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Demandas</h1>
        <Button onClick={() => setNewOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Nova Demanda
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44 h-9 text-sm"><SelectValue /></SelectTrigger>
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

      {/* Cards */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {demands.map(d => (
            <DemandCard key={d.id} demand={d} onClick={() => setSelectedDemand(d)} />
          ))}
          {demands.length === 0 && (
            <p className="text-sm text-muted-foreground col-span-full text-center py-8">Nenhuma demanda encontrada.</p>
          )}
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
