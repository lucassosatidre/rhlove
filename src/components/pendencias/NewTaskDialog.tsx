import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useTasks, useUsuarios } from '@/hooks/useTasks';
import { useAuth } from '@/contexts/AuthContext';
import { useCollaborators } from '@/hooks/useCollaborators';
import { toast } from 'sonner';

const CATEGORIES = [
  { value: 'tarefa', label: 'Tarefa' },
  { value: 'acompanhamento', label: 'Acompanhamento' },
  { value: 'ordem', label: 'Ordem' },
  { value: 'melhoria', label: 'Melhoria' },
];

const PRIORITIES = [
  { value: 'baixa', label: 'Baixa' },
  { value: 'media', label: 'Média' },
  { value: 'alta', label: 'Alta' },
  { value: 'urgente', label: 'Urgente' },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export default function NewTaskDialog({ open, onOpenChange }: Props) {
  const { usuario } = useAuth();
  const { createTask } = useTasks();
  const { data: usuarios } = useUsuarios();
  const { data: collaborators } = useCollaborators();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState<Date>();
  const [category, setCategory] = useState('tarefa');
  const [priority, setPriority] = useState('media');
  const [saving, setSaving] = useState(false);

  // Build list: usuarios ativos (excluding current user), showing collaborator name if linked
  const destinatarios = (usuarios || [])
    .filter(u => u.id !== usuario?.id)
    .map(u => {
      const collab = collaborators?.find((c: any) => c.id === (u as any).collaborator_id);
      return {
        userId: u.id,
        label: collab ? `${collab.collaborator_name} (${u.nome})` : u.nome,
      };
    });

  const reset = () => {
    setTitle(''); setDescription(''); setAssignedTo(''); setDueDate(undefined);
    setCategory('tarefa'); setPriority('media');
  };

  const handleSubmit = async () => {
    if (!title.trim() || !assignedTo || !dueDate || !usuario) return;
    setSaving(true);
    try {
      await createTask.mutateAsync({
        title: title.trim(),
        description,
        category,
        priority,
        created_by: usuario.id,
        assigned_to: assignedTo,
        due_date: format(dueDate, 'yyyy-MM-dd'),
      });
      toast.success('Pendência criada!');
      reset();
      onOpenChange(false);
    } catch {
      toast.error('Erro ao criar pendência');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Pendência</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Título *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Entregar relatório" />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Detalhes..." rows={3} />
          </div>
          <div>
            <Label>Direcionado para *</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger><SelectValue placeholder="Selecione o destinatário" /></SelectTrigger>
              <SelectContent>
                {destinatarios.map(d => (
                  <SelectItem key={d.userId} value={d.userId}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Prazo de entrega *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !dueDate && 'text-muted-foreground')}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, 'dd/MM/yyyy') : 'Selecione a data'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dueDate} onSelect={setDueDate} locale={ptBR} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button className="w-full" onClick={handleSubmit} disabled={saving || !title.trim() || !assignedTo || !dueDate}>
            {saving ? 'Criando...' : 'Criar Pendência'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
