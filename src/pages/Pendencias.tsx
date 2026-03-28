import { useState, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTasks, type Task } from '@/hooks/useTasks';
import { useAuth } from '@/contexts/AuthContext';
import NewTaskDialog from '@/components/pendencias/NewTaskDialog';
import TaskCard from '@/components/pendencias/TaskCard';
import TaskDetailDialog from '@/components/pendencias/TaskDetailDialog';

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

export default function Pendencias() {
  const { usuario } = useAuth();
  const { allTasksQuery } = useTasks();
  const [newOpen, setNewOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  const tasks = useMemo(() => {
    let list = allTasksQuery.data ?? [];
    if (statusFilter !== 'all') list = list.filter(t => t.status === statusFilter);
    if (priorityFilter !== 'all') list = list.filter(t => t.priority === priorityFilter);
    return list;
  }, [allTasksQuery.data, statusFilter, priorityFilter]);

  const getMode = (task: Task): 'received' | 'sent' => {
    if (task.assigned_to === usuario?.id) return 'received';
    return 'sent';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pendências</h1>
        <Button onClick={() => setNewOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Nova Pendência
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48 h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-44 h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRIORITY_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{tasks.length} pendência(s)</span>
      </div>

      {/* Unified task list */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tasks.map(task => (
          <TaskCard key={task.id} task={task} mode={getMode(task)} onClick={() => setSelectedTask(task)} />
        ))}
        {tasks.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-full">Nenhuma pendência encontrada.</p>
        )}
      </div>

      <NewTaskDialog open={newOpen} onOpenChange={setNewOpen} />

      {selectedTask && (
        <TaskDetailDialog
          task={selectedTask}
          open={!!selectedTask}
          onOpenChange={(open) => { if (!open) setSelectedTask(null); }}
        />
      )}
    </div>
  );
}
