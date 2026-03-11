import { useState, useMemo } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { formatarMoeda, formatarData, FORMAS_PAGAMENTO_LABEL, FormaPagamento, TipoTransacao } from '@/types/finance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import TransacaoForm from '@/components/TransacaoForm';

export default function Lancamentos() {
  const { transacoes, categorias, removerTransacao } = useFinance();
  const [formOpen, setFormOpen] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todos');
  const [filtroPagamento, setFiltroPagamento] = useState<string>('todos');
  const [filtroInicio, setFiltroInicio] = useState('');
  const [filtroFim, setFiltroFim] = useState('');

  const transacoesFiltradas = useMemo(() => {
    return transacoes
      .filter(t => {
        if (filtroTipo !== 'todos' && t.tipo !== filtroTipo) return false;
        if (filtroCategoria !== 'todos' && t.categoriaId !== filtroCategoria) return false;
        if (filtroPagamento !== 'todos' && t.formaPagamento !== filtroPagamento) return false;
        if (filtroInicio) {
          const d = new Date(t.data);
          if (d < new Date(filtroInicio)) return false;
        }
        if (filtroFim) {
          const d = new Date(t.data);
          if (d > new Date(filtroFim + 'T23:59:59')) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  }, [transacoes, filtroTipo, filtroCategoria, filtroPagamento, filtroInicio, filtroFim]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Lançamentos</h1>
          <p className="text-muted-foreground text-sm">Gerencie suas receitas e despesas</p>
        </div>
        <Button onClick={() => setFormOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Novo
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Tipo</label>
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="receita">Receitas</SelectItem>
                  <SelectItem value="despesa">Despesas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Categoria</label>
              <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  {categorias.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Pagamento</label>
              <Select value={filtroPagamento} onValueChange={setFiltroPagamento}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {Object.entries(FORMAS_PAGAMENTO_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">De</label>
              <Input type="date" value={filtroInicio} onChange={e => setFiltroInicio(e.target.value)} className="h-9" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Até</label>
              <Input type="date" value={filtroFim} onChange={e => setFiltroFim(e.target.value)} className="h-9" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardContent className="p-0">
          {transacoesFiltradas.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Nenhum lançamento encontrado</div>
          ) : (
            <div className="divide-y divide-border">
              {transacoesFiltradas.map(t => {
                const cat = categorias.find(c => c.id === t.categoriaId);
                return (
                  <div key={t.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${t.tipo === 'receita' ? 'bg-accent' : 'bg-destructive/10'}`}>
                        {t.tipo === 'receita' ? <ArrowUpRight className="w-4 h-4 text-success" /> : <ArrowDownRight className="w-4 h-4 text-destructive" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{t.descricao}</p>
                        <p className="text-xs text-muted-foreground">
                          {cat?.nome} · {FORMAS_PAGAMENTO_LABEL[t.formaPagamento]} · {formatarData(t.data)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-semibold whitespace-nowrap ${t.tipo === 'receita' ? 'text-success' : 'text-destructive'}`}>
                        {t.tipo === 'receita' ? '+' : '-'}{formatarMoeda(t.valor)}
                      </span>
                      <button
                        onClick={() => removerTransacao(t.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <TransacaoForm open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  );
}
