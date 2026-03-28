import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropZone } from '@/components/ui/drop-zone';
import { Camera, X, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCreateDemand, useUsuarios } from '@/hooks/useDemands';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const TYPES = [
  { value: 'manutencao', label: '🔧 Manutenção', icon: '🔧' },
  { value: 'compra', label: '🛒 Compra', icon: '🛒' },
  { value: 'tarefa', label: '✅ Tarefa', icon: '✅' },
];

const SECTORS = ['COZINHA', 'SALÃO', 'TELE - ENTREGA', 'BANHEIRO', 'ÁREA EXTERNA', 'ELÉTRICA', 'HIDRÁULICA', 'OUTRO'];

const PRIORITIES = [
  { value: 'imp_urg', label: '🔴 Importante e Urgente' },
  { value: 'imp_nao_urg', label: '🟠 Importante mas não Urgente' },
  { value: 'urg_nao_imp', label: '🟡 Urgente mas não Importante' },
  { value: 'nao_urg_nao_imp', label: '⚪ Não Urgente e Não Importante' },
];

interface NewDemandDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function NewDemandDialog({ open, onOpenChange }: NewDemandDialogProps) {
  const { usuario } = useAuth();
  const createDemand = useCreateDemand();
  const { data: usuarios = [] } = useUsuarios();

  const [type, setType] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [sector, setSector] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('urg_nao_imp');
  const [itemName, setItemName] = useState('');
  const [stockQty, setStockQty] = useState('');
  const [observation, setObservation] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const needsSector = type === 'manutencao';
  const needsItem = type === 'compra';
  const needsPhotos = type === 'manutencao';
  const assigneeRequired = type === 'tarefa';

  const reset = () => {
    setType(''); setTitle(''); setDescription(''); setAssignedTo('');
    setSector(''); setDueDate(''); setPriority('urg_nao_imp'); setItemName('');
    setStockQty(''); setObservation(''); setSelectedFiles([]);
  };

  const handleSubmit = async () => {
    if (!usuario || !type || !title.trim()) {
      toast.error('Preencha os campos obrigatórios (Tipo e Título).');
      return;
    }
    if (needsAssignee && !assignedTo) {
      toast.error('Selecione o destinatário.');
      return;
    }
    if (needsPhotos && selectedFiles.length === 0) {
      toast.error('Anexe pelo menos 1 foto para manutenção.');
      return;
    }

    setSubmitting(true);
    try {
      let photoPaths: string[] = [];
      if (selectedFiles.length > 0) {
        for (const file of selectedFiles) {
          const ext = file.name.split('.').pop() || 'jpg';
          const path = `${usuario.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
          const { error } = await supabase.storage.from('manutencao-fotos').upload(path, file, { contentType: file.type });
          if (error) throw error;
          photoPaths.push(path);
        }
      }

      await createDemand.mutateAsync({
        title: title.trim(),
        description: description.trim() || null,
        type,
        priority,
        sector: sector || null,
        assigned_to: assignedTo || null,
        created_by: usuario.id,
        due_date: dueDate || null,
        photos: photoPaths,
        item_name: itemName.trim() || null,
        stock_quantity: stockQty.trim() || null,
        observation: observation.trim() || null,
      });

      toast.success('Demanda criada com sucesso!');
      reset();
      onOpenChange(false);
    } catch (err: any) {
      toast.error('Erro ao criar: ' + (err.message ?? 'desconhecido'));
    } finally {
      setSubmitting(false);
    }
  };

  const assigneeOptions = usuarios.map(u => ({ value: u.id, label: u.nome }));

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Demanda</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Type */}
          <div>
            <Label>Tipo <span className="text-destructive">*</span></Label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {TYPES.map(t => (
                <button key={t.value} onClick={() => setType(t.value)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${type === t.value ? 'bg-primary text-primary-foreground border-primary' : 'bg-card hover:bg-muted border-border'}`}>
                  <span>{t.icon}</span> {t.label.split(' ').slice(1).join(' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <Label>Título <span className="text-destructive">*</span></Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Resumo da demanda" />
          </div>

          {/* Description */}
          <div>
            <Label>Descrição</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Detalhes..." rows={3} />
          </div>

          {/* Conditional: Assignee */}
          {needsAssignee && (
            <div>
              <Label>Direcionado para <span className="text-destructive">*</span></Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger><SelectValue placeholder="Selecione o responsável" /></SelectTrigger>
                <SelectContent>
                  {assigneeOptions.map(u => (
                    <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Conditional: Sector */}
          {needsSector && (
            <div>
              <Label>Setor/Local <span className="text-destructive">*</span></Label>
              <Select value={sector} onValueChange={setSector}>
                <SelectTrigger><SelectValue placeholder="Selecione o setor" /></SelectTrigger>
                <SelectContent>
                  {SECTORS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Conditional: Item */}
          {needsItem && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Item</Label>
                <Input value={itemName} onChange={e => setItemName(e.target.value)} placeholder="Nome do item" />
              </div>
              <div>
                <Label>Qtd em estoque</Label>
                <Input value={stockQty} onChange={e => setStockQty(e.target.value)} placeholder="Ex: 2 unidades" />
              </div>
            </div>
          )}

          {/* Due date + Priority */}
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

          {/* Photos */}
          <div>
            <Label>Fotos {needsPhotos && <span className="text-destructive">* (mínimo 1)</span>}</Label>
            <DropZone accept="image/*" multiple onFiles={files => setSelectedFiles(prev => [...prev, ...Array.from(files)])}
              label="Arraste fotos ou clique para selecionar" className="py-3 mt-1">
              <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
                <Camera className="w-6 h-6 opacity-50" />
                <p className="text-xs">Arraste fotos ou clique</p>
              </div>
            </DropZone>
            {selectedFiles.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mt-2">
                {selectedFiles.map((file, i) => (
                  <div key={i} className="relative group">
                    <img src={URL.createObjectURL(file)} alt="" className="w-full h-16 object-cover rounded border border-border" />
                    <button onClick={() => setSelectedFiles(prev => prev.filter((_, j) => j !== i))}
                      className="absolute top-0.5 right-0.5 bg-background/80 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Observation */}
          <div>
            <Label>Observação</Label>
            <Textarea value={observation} onChange={e => setObservation(e.target.value)} placeholder="Informações extras..." rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            Criar demanda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
