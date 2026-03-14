import { useState } from 'react';
import { useCollaborators, useCreateCollaborator, useUpdateCollaborator, useDeleteCollaborator, useBulkInsertCollaborators } from '@/hooks/useCollaborators';
import { DAYS_OF_WEEK, DAY_LABELS, SECTORS, type Collaborator, type DayOfWeek } from '@/types/collaborator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';

interface FormData {
  collaborator_name: string;
  sector: string;
  weekly_day_off: DayOfWeek;
  sunday_n: number;
}

const emptyForm: FormData = {
  collaborator_name: '',
  sector: SECTORS[0],
  weekly_day_off: 'segunda',
  sunday_n: 1,
};

export default function Colaboradores() {
  const { data: collaborators = [], isLoading } = useCollaborators();
  const createMut = useCreateCollaborator();
  const updateMut = useUpdateCollaborator();
  const deleteMut = useDeleteCollaborator();
  const bulkMut = useBulkInsertCollaborators();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (c: Collaborator) => {
    setEditingId(c.id);
    setForm({
      collaborator_name: c.collaborator_name,
      sector: c.sector,
      weekly_day_off: c.weekly_day_off,
      sunday_n: c.sunday_n,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.collaborator_name.trim()) {
      toast({ title: 'Nome obrigatório', variant: 'destructive' });
      return;
    }
    try {
      if (editingId) {
        await updateMut.mutateAsync({ id: editingId, ...form });
        toast({ title: 'Colaborador atualizado' });
      } else {
        await createMut.mutateAsync(form);
        toast({ title: 'Colaborador cadastrado' });
      }
      setDialogOpen(false);
    } catch {
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este colaborador?')) return;
    try {
      await deleteMut.mutateAsync(id);
      toast({ title: 'Colaborador excluído' });
    } catch {
      toast({ title: 'Erro ao excluir', variant: 'destructive' });
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws);

      const dayMap: Record<string, DayOfWeek> = {
        'segunda': 'segunda', 'terça': 'terca', 'terca': 'terca',
        'quarta': 'quarta', 'quinta': 'quinta', 'sexta': 'sexta',
        'sábado': 'sabado', 'sabado': 'sabado', 'domingo': 'domingo',
      };

      const mapped = rows.map(row => ({
        collaborator_name: String(row['collaborator_name'] || row['nome'] || row['Nome'] || '').trim(),
        sector: String(row['sector'] || row['setor'] || row['Setor'] || 'Salão').trim(),
        weekly_day_off: dayMap[(String(row['weekly_day_off'] || row['folga'] || row['Folga'] || 'segunda')).toLowerCase().trim()] || 'segunda',
        sunday_n: Number(row['sunday_n'] || row['domingo_n'] || 1),
      })).filter(r => r.collaborator_name);

      if (mapped.length === 0) {
        toast({ title: 'Nenhum dado encontrado no arquivo', variant: 'destructive' });
        return;
      }

      await bulkMut.mutateAsync(mapped);
      toast({ title: `${mapped.length} colaboradores importados` });
    } catch {
      toast({ title: 'Erro ao importar', variant: 'destructive' });
    }
    e.target.value = '';
  };

  const grouped = collaborators.reduce<Record<string, Collaborator[]>>((acc, c) => {
    (acc[c.sector] ??= []).push(c);
    return acc;
  }, {});

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Colaboradores</h1>
          <p className="text-sm text-muted-foreground">{collaborators.length} cadastrados</p>
        </div>
        <div className="flex gap-2">
          <label className="cursor-pointer">
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
            <Button variant="outline" size="sm" asChild>
              <span><Upload className="w-4 h-4 mr-1" /> Importar</span>
            </Button>
          </label>
          <Button size="sm" onClick={openNew}>
            <Plus className="w-4 h-4 mr-1" /> Novo
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : Object.keys(grouped).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum colaborador cadastrado. Clique em "Novo" ou importe um arquivo Excel.
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([sector, members]) => (
          <Card key={sector}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{sector} ({members.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead className="hidden sm:table-cell">Folga Semanal</TableHead>
                    <TableHead className="hidden sm:table-cell">Domingo Off</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        {c.collaborator_name}
                        <span className="sm:hidden block text-xs text-muted-foreground">
                          Folga: {DAY_LABELS[c.weekly_day_off]} · Dom {c.sunday_n}º
                        </span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{DAY_LABELS[c.weekly_day_off]}</TableCell>
                      <TableCell className="hidden sm:table-cell">{c.sunday_n}º domingo</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(c)} className="p-1.5 rounded hover:bg-muted transition-colors">
                            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                          <button onClick={() => handleDelete(c.id)} className="p-1.5 rounded hover:bg-destructive/10 transition-colors">
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Colaborador' : 'Novo Colaborador'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={form.collaborator_name}
                onChange={e => setForm(f => ({ ...f, collaborator_name: e.target.value }))}
                placeholder="Nome completo"
              />
            </div>
            <div className="space-y-2">
              <Label>Setor</Label>
              <Select value={form.sector} onValueChange={v => setForm(f => ({ ...f, sector: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SECTORS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Folga Semanal</Label>
              <Select value={form.weekly_day_off} onValueChange={v => setForm(f => ({ ...f, weekly_day_off: v as DayOfWeek }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DAYS_OF_WEEK.map(d => <SelectItem key={d} value={d}>{DAY_LABELS[d]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Domingo de folga (nº do mês)</Label>
              <Select value={String(form.sunday_n)} onValueChange={v => setForm(f => ({ ...f, sunday_n: Number(v) }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map(n => <SelectItem key={n} value={String(n)}>{n}º domingo</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit">{editingId ? 'Salvar' : 'Cadastrar'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
