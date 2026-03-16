import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateReminder, REMINDER_TYPES, PRIORITIES, RECURRENCE_OPTIONS } from '@/hooks/useReminders';
import { useToast } from '@/hooks/use-toast';
import type { Collaborator } from '@/types/collaborator';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collaborators: Collaborator[];
  defaultDate?: string;
}

export default function NewReminderDialog({ open, onOpenChange, collaborators, defaultDate }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [collaboratorId, setCollaboratorId] = useState('');
  const [sector, setSector] = useState('');
  const [responsible, setResponsible] = useState('');
  const [eventDate, setEventDate] = useState(defaultDate || '');
  const [eventTime, setEventTime] = useState('');
  const [reminderType, setReminderType] = useState('outro');
  const [priority, setPriority] = useState('media');
  const [recurrence, setRecurrence] = useState('none');

  const createReminder = useCreateReminder();
  const { toast } = useToast();

  const sectors = [...new Set(collaborators.map(c => c.sector))].sort();

  function resetForm() {
    setTitle('');
    setDescription('');
    setCollaboratorId('');
    setSector('');
    setResponsible('');
    setEventDate(defaultDate || '');
    setEventTime('');
    setReminderType('outro');
    setPriority('media');
    setRecurrence('none');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !eventDate) {
      toast({ title: 'Preencha título e data', variant: 'destructive' });
      return;
    }

    const collab = collaborators.find(c => c.id === collaboratorId);

    try {
      await createReminder.mutateAsync({
        title: title.trim(),
        description: description.trim(),
        collaborator_id: collaboratorId || null,
        collaborator_name: collab?.collaborator_name || '',
        sector: sector || collab?.sector || '',
        responsible,
        event_date: eventDate,
        event_time: eventTime || null,
        reminder_type: reminderType,
        priority,
        recurrence,
        status: 'pendente',
      });
      toast({ title: 'Lembrete criado com sucesso' });
      resetForm();
      onOpenChange(false);
    } catch {
      toast({ title: 'Erro ao criar lembrete', variant: 'destructive' });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Lembrete</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rem-title">Título *</Label>
            <Input id="rem-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Fechar banco de horas" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rem-desc">Descrição / Observação</Label>
            <Textarea id="rem-desc" value={description} onChange={e => setDescription(e.target.value)} placeholder="Detalhes do lembrete..." rows={2} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Colaborador (opcional)</Label>
              <Select value={collaboratorId} onValueChange={v => {
                setCollaboratorId(v === '__none__' ? '' : v);
                const c = collaborators.find(x => x.id === v);
                if (c) setSector(c.sector);
              }}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {collaborators.filter(c => c.status !== 'DESLIGADO').map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.collaborator_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Setor (opcional)</Label>
              <Select value={sector} onValueChange={v => setSector(v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Todos</SelectItem>
                  {sectors.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Responsável (opcional)</Label>
            <Input value={responsible} onChange={e => setResponsible(e.target.value)} placeholder="Ex: RH, Gerente, João..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="rem-date">Data *</Label>
              <Input id="rem-date" type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rem-time">Hora (opcional)</Label>
              <Input id="rem-time" type="time" value={eventTime} onChange={e => setEventTime(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={reminderType} onValueChange={setReminderType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REMINDER_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map(p => (
                    <SelectItem key={p.value} value={p.value}>
                      <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${p.color}`} />
                        {p.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Repetição</Label>
            <Select value={recurrence} onValueChange={setRecurrence}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {RECURRENCE_OPTIONS.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={createReminder.isPending}>
              {createReminder.isPending ? 'Salvando...' : 'Criar Lembrete'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
