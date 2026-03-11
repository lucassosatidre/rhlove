import { useState } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { TipoTransacao } from '@/types/finance';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2 } from 'lucide-react';

export default function Categorias() {
  const { categorias, adicionarCategoria, editarCategoria, removerCategoria } = useFinance();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<TipoTransacao>('despesa');
  const [cor, setCor] = useState('#6b7280');

  const openNew = () => {
    setEditId(null);
    setNome('');
    setTipo('despesa');
    setCor('#6b7280');
    setDialogOpen(true);
  };

  const openEdit = (id: string) => {
    const c = categorias.find(x => x.id === id);
    if (!c) return;
    setEditId(id);
    setNome(c.nome);
    setTipo(c.tipo);
    setCor(c.cor);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!nome) return;
    if (editId) {
      editarCategoria({ id: editId, nome, tipo, cor });
    } else {
      adicionarCategoria({ nome, tipo, cor });
    }
    setDialogOpen(false);
  };

  const receitas = categorias.filter(c => c.tipo === 'receita');
  const despesas = categorias.filter(c => c.tipo === 'despesa');

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Categorias</h1>
          <p className="text-muted-foreground text-sm">Organize seus lançamentos</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" /> Nova</Button>
      </div>

      {[{ title: 'Receitas', items: receitas }, { title: 'Despesas', items: despesas }].map(group => (
        <Card key={group.title}>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">{group.title}</h3>
            <div className="space-y-2">
              {group.items.map(c => (
                <div key={c.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.cor }} />
                    <span className="text-sm font-medium">{c.nome}</span>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(c.id)} className="text-muted-foreground hover:text-foreground p-1"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => removerCategoria(c.id)} className="text-muted-foreground hover:text-destructive p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editId ? 'Editar' : 'Nova'} Categoria</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={nome} onChange={e => setNome(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={v => setTipo(v as TipoTransacao)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="receita">Receita</SelectItem>
                  <SelectItem value="despesa">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <Input type="color" value={cor} onChange={e => setCor(e.target.value)} className="h-10 w-20 p-1" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">Cancelar</Button>
              <Button onClick={handleSave} className="flex-1">Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
