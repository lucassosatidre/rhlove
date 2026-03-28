import { useState } from 'react';
import { useAfastamentos, useAddAfastamento, useUpdateAfastamento, useDeleteAfastamento, type Afastamento } from '@/hooks/useAfastamentos';
import { useCollaborators } from '@/hooks/useCollaborators';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, UserMinus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const MOTIVOS = [
  'Férias', 'Atestado', 'Ajuste de Escala', 'Abono', 'Licença Médica',
  'Licença Maternidade/Paternidade', 'Falta Justificada', 'Falta Injustificada', 'Outro',
] as const;

const MOTIVO_COLORS: Record<string, string> = {
  'Férias': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'Atestado': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  'Ajuste de Escala': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  'Abono': 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  'Licença Médica': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  'Licença Maternidade/Paternidade': 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  'Falta Justificada': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  'Falta Injustificada': 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  'Outro': 'bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400',
};

function formatDateBR(s: string) {
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

export default function Afastamentos() {
  const { data: afastamentos = [], isLoading } = useAfastamentos();
  const { data: collaborators = [] } = useCollaborators();
  const { usuario } = useAuth();
  const addMut = useAddAfastamento();
  const updateMut = useUpdateAfastamento();
  const deleteMut = useDeleteAfastamento();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Afastamento | null>(null);

  const [collabId, setCollabId] = useState('');
  const [motivo, setMotivo] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [observacao, setObservacao] = useState('');

  const activeCollabs = collaborators.filter(c => c.status !== 'DESLIGADO');

  function openNew() {
    setEditing(null);
    setCollabId('');
    setMotivo('');
    setDataInicio('');
    setDataFim('');
    setObservacao('');
    setDialogOpen(true);
  }

  function openEdit(a: Afastamento) {
    setEditing(a);
    setCollabId(a.collaborator_id);
    setMotivo(a.motivo || '');
    setDataInicio(a.data_inicio);
    setDataFim(a.data_fim);
    setObservacao(a.observacao || '');
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!collabId || !dataInicio || !dataFim) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }
    if (dataInicio > dataFim) {
      toast({ title: 'Data inicial não pode ser maior que data final', variant: 'destructive' });
      return;
    }
    const collab = collaborators.find(c => c.id === collabId);
    if (!collab) return;

    try {
      if (editing) {
        await updateMut.mutateAsync({
          id: editing.id,
          collaborator_id: collabId,
          collaborator_name: collab.collaborator_name,
          sector: collab.sector,
          data_inicio: dataInicio,
          data_fim: dataFim,
          observacao: observacao || null,
        });
        toast({ title: 'Afastamento atualizado' });
      } else {
        await addMut.mutateAsync({
          collaborator_id: collabId,
          collaborator_name: collab.collaborator_name,
          sector: collab.sector,
          data_inicio: dataInicio,
          data_fim: dataFim,
          observacao: observacao || null,
          created_by: usuario?.nome || null,
        });
        toast({ title: 'Afastamento cadastrado' });
      }
      setDialogOpen(false);
    } catch {
      toast({ title: 'Erro ao salvar afastamento', variant: 'destructive' });
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este afastamento?')) return;
    try {
      await deleteMut.mutateAsync(id);
      toast({ title: 'Afastamento excluído' });
    } catch {
      toast({ title: 'Erro ao excluir', variant: 'destructive' });
    }
  }

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <UserMinus className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Afastamentos</h1>
            <p className="text-sm text-muted-foreground">Gerencie períodos de afastamento dos colaboradores</p>
          </div>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="w-4 h-4" />
          Novo afastamento
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Afastamentos cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : afastamentos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum afastamento cadastrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Fim</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Observação</TableHead>
                  <TableHead>Registrado por</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {afastamentos.map(a => {
                  const isActive = todayStr >= a.data_inicio && todayStr <= a.data_fim;
                  const isPast = todayStr > a.data_fim;
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.collaborator_name}</TableCell>
                      <TableCell>{a.sector}</TableCell>
                      <TableCell>{formatDateBR(a.data_inicio)}</TableCell>
                      <TableCell>{formatDateBR(a.data_fim)}</TableCell>
                      <TableCell>
                        {isActive ? (
                          <Badge variant="destructive">Ativo</Badge>
                        ) : isPast ? (
                          <Badge variant="secondary">Encerrado</Badge>
                        ) : (
                          <Badge variant="outline">Futuro</Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground text-xs">{a.observacao || '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{a.created_by || '—'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(a)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(a.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar afastamento' : 'Novo afastamento'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Colaborador</Label>
              <Select value={collabId} onValueChange={setCollabId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o colaborador" />
                </SelectTrigger>
                <SelectContent>
                  {activeCollabs.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.collaborator_name} — {c.sector}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data inicial</Label>
                <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Data final</Label>
                <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observação (opcional)</Label>
              <Textarea value={observacao} onChange={e => setObservacao(e.target.value)} placeholder="Motivo do afastamento..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={addMut.isPending || updateMut.isPending}>
              {editing ? 'Salvar alterações' : 'Salvar afastamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
