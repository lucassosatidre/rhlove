import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useUpdateDemand, useUsuarios, type Demand } from '@/hooks/useDemands';
import { toast } from 'sonner';

const TYPES = [
  { value: 'manutencao', label: '🔧 Manutenção' },
  { value: 'compra', label: '🛒 Compra' },
  { value: 'tarefa', label: '✅ Tarefa' },
];

const PRIORITIES = [
  { value: 'imp_urg', label: '🔴 Importante e Urgente' },
  { value: 'imp_nao_urg', label: '🟠 Importante mas não Urgente' },
  { value: 'urg_nao_imp', label: '🟡 Urgente mas não Importante' },
  { value: 'nao_urg_nao_imp', label: '⚪ Não Urgente e Não Importante' },
];

const STATUSES = [
  { value: 'em_andamento', label: '🟡 Em andamento' },
  { value: 'concluida', label: '✅ Concluído' },
];

interface EditDemandDialogProps {
  demand: Demand;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditDemandDialog({ demand, open, onOpenChange }: EditDemandDialogProps) {
  const updateDemand = useUpdateDemand();
  const { data: usuarios = [] } = useUsuarios();

  const [type, setType] = useState(demand.type);
  const [title, setTitle] = useState(demand.title);
  const [description, setDescription] = useState(demand.description ?? '');
  const [assignedTo, setAssignedTo] = useState(demand.assigned_to ?? 'none');
  const [dueDate, setDueDate] = useState(demand.due_date ?? '');
  const [priority, setPriority] = useState(demand.priority);
  const [status, setStatus] = useState(demand.status);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setType(demand.type);
    setTitle(demand.title);
    setDescription(demand.description ?? '');
    setAssignedTo(demand.assigned_to ?? 'none');
    setDueDate(demand.due_date ?? '');
    setPriority(demand.priority);
    setStatus(demand.status);
  }, [demand]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error('Título é obrigatório.');
      return;
    }
    setSubmitting(true);
    try {
      await updateDemand.mutateAsync({
        demandId: demand.id,
        updates: {
          type,
          title: title.trim(),
          description: description.trim() || null,
          assigned_to: assignedTo === 'none' ? null : assignedTo,
          due_date: dueDate || null,
          priority,
          status,
        },
      });
      toast.success('Demanda atualizada!');
      onOpenChange(false);
    } catch (err: any) {
      toast.error('Erro: ' + (err.message ?? 'desconhecido'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Demanda</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Tipo</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Título</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} />
          </div>
          <div>
            <Label>Destinatário</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Nenhum —</SelectItem>
                {usuarios.map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Prazo</Label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
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
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
