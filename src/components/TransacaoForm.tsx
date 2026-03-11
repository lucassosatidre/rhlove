import { useState } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { TipoTransacao, FormaPagamento, FORMAS_PAGAMENTO_LABEL } from '@/types/finance';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function TransacaoForm({ open, onClose }: Props) {
  const { categorias, adicionarTransacao } = useFinance();
  const [tipo, setTipo] = useState<TipoTransacao>('despesa');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [data, setData] = useState(new Date().toISOString().split('T')[0]);
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>('pix');
  const [observacoes, setObservacoes] = useState('');

  const categoriasFiltradas = categorias.filter(c => c.tipo === tipo);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!descricao || !valor || !categoriaId || !data) return;
    adicionarTransacao({
      descricao,
      valor: parseFloat(valor),
      categoriaId,
      data: new Date(data).toISOString(),
      tipo,
      formaPagamento,
      observacoes: observacoes || undefined,
    });
    onClose();
    resetForm();
  };

  const resetForm = () => {
    setDescricao('');
    setValor('');
    setCategoriaId('');
    setData(new Date().toISOString().split('T')[0]);
    setObservacoes('');
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Lançamento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={tipo === 'receita' ? 'default' : 'outline'}
              onClick={() => { setTipo('receita'); setCategoriaId(''); }}
              className={tipo === 'receita' ? 'bg-success hover:bg-success/90' : ''}
            >
              Receita
            </Button>
            <Button
              type="button"
              variant={tipo === 'despesa' ? 'default' : 'outline'}
              onClick={() => { setTipo('despesa'); setCategoriaId(''); }}
              className={tipo === 'despesa' ? 'bg-destructive hover:bg-destructive/90' : ''}
            >
              Despesa
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex: Supermercado" required />
          </div>

          <div className="space-y-2">
            <Label>Valor (R$)</Label>
            <Input type="number" step="0.01" min="0.01" value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00" required />
          </div>

          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={categoriaId} onValueChange={setCategoriaId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {categoriasFiltradas.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Data</Label>
            <Input type="date" value={data} onChange={e => setData(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label>Forma de Pagamento</Label>
            <Select value={formaPagamento} onValueChange={v => setFormaPagamento(v as FormaPagamento)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(FORMAS_PAGAMENTO_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Opcional" rows={2} />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button type="submit" className="flex-1">Salvar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
