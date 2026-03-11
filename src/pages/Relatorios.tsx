import { useMemo, useState } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { formatarMoeda, FORMAS_PAGAMENTO_LABEL } from '@/types/finance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Download } from 'lucide-react';

function gerarCSV(headers: string[], rows: string[][]): string {
  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob(['\ufeff' + content], { type: `${type};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Relatorios() {
  const { transacoes, categorias } = useFinance();
  const hoje = new Date();

  const mesesDisponiveis = useMemo(() => {
    const set = new Set<string>();
    transacoes.forEach(t => {
      const d = new Date(t.data);
      set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    });
    return Array.from(set).sort().reverse();
  }, [transacoes]);

  const [mesSelecionado, setMesSelecionado] = useState(mesesDisponiveis[0] || '');

  const transacoesMes = useMemo(() => {
    if (!mesSelecionado) return [];
    const [ano, mes] = mesSelecionado.split('-').map(Number);
    return transacoes.filter(t => {
      const d = new Date(t.data);
      return d.getFullYear() === ano && d.getMonth() === mes - 1;
    });
  }, [transacoes, mesSelecionado]);

  const totalReceitas = transacoesMes.filter(t => t.tipo === 'receita').reduce((s, t) => s + t.valor, 0);
  const totalDespesas = transacoesMes.filter(t => t.tipo === 'despesa').reduce((s, t) => s + t.valor, 0);

  const despesasPorCategoria = useMemo(() => {
    const map = new Map<string, number>();
    transacoesMes.filter(t => t.tipo === 'despesa').forEach(t => {
      map.set(t.categoriaId, (map.get(t.categoriaId) || 0) + t.valor);
    });
    return Array.from(map.entries()).map(([id, valor]) => {
      const cat = categorias.find(c => c.id === id);
      return { name: cat?.nome || 'Outros', value: valor, color: cat?.cor || '#6b7280' };
    }).sort((a, b) => b.value - a.value);
  }, [transacoesMes, categorias]);

  const receitasPorOrigem = useMemo(() => {
    const map = new Map<string, number>();
    transacoesMes.filter(t => t.tipo === 'receita').forEach(t => {
      map.set(t.categoriaId, (map.get(t.categoriaId) || 0) + t.valor);
    });
    return Array.from(map.entries()).map(([id, valor]) => {
      const cat = categorias.find(c => c.id === id);
      return { name: cat?.nome || 'Outros', value: valor, color: cat?.cor || '#6b7280' };
    }).sort((a, b) => b.value - a.value);
  }, [transacoesMes, categorias]);

  const mesLabel = mesSelecionado
    ? new Date(Number(mesSelecionado.split('-')[0]), Number(mesSelecionado.split('-')[1]) - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    : '';

  const exportar = (formato: 'csv' | 'excel') => {
    const headers = ['Data', 'Descrição', 'Tipo', 'Categoria', 'Valor', 'Forma de Pagamento', 'Observações'];
    const rows = transacoesMes.map(t => {
      const cat = categorias.find(c => c.id === t.categoriaId);
      const d = new Date(t.data);
      return [
        d.toLocaleDateString('pt-BR'),
        t.descricao,
        t.tipo === 'receita' ? 'Receita' : 'Despesa',
        cat?.nome || '',
        t.valor.toFixed(2).replace('.', ','),
        FORMAS_PAGAMENTO_LABEL[t.formaPagamento],
        t.observacoes || '',
      ];
    });
    const csv = gerarCSV(headers, rows);
    const ext = formato === 'excel' ? 'xls' : 'csv';
    downloadFile(csv, `relatorio-${mesSelecionado}.${ext}`, formato === 'excel' ? 'application/vnd.ms-excel' : 'text/csv');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Relatórios</h1>
          <p className="text-muted-foreground text-sm">Análise detalhada das suas finanças</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={mesSelecionado} onValueChange={setMesSelecionado}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Selecione o mês" /></SelectTrigger>
            <SelectContent>
              {mesesDisponiveis.map(m => {
                const [a, me] = m.split('-').map(Number);
                const label = new Date(a, me - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                return <SelectItem key={m} value={m}>{label}</SelectItem>;
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 text-center">
            <p className="text-xs text-muted-foreground mb-1">Receitas</p>
            <p className="text-xl font-bold text-success">{formatarMoeda(totalReceitas)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-center">
            <p className="text-xs text-muted-foreground mb-1">Despesas</p>
            <p className="text-xl font-bold text-destructive">{formatarMoeda(totalDespesas)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-center">
            <p className="text-xs text-muted-foreground mb-1">Saldo</p>
            <p className={`text-xl font-bold ${totalReceitas - totalDespesas >= 0 ? 'text-success' : 'text-destructive'}`}>
              {formatarMoeda(totalReceitas - totalDespesas)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Despesas por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {despesasPorCategoria.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={despesasPorCategoria} layout="vertical">
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(1)}k`} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v: number) => formatarMoeda(v)} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} name="Valor">
                      {despesasPorCategoria.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Receitas por Origem</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {receitasPorOrigem.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={receitasPorOrigem} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {receitasPorOrigem.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatarMoeda(v)} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Export */}
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 items-center justify-between">
          <p className="text-sm text-muted-foreground">Exportar dados de <strong>{mesLabel}</strong></p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => exportar('csv')} className="gap-2">
              <Download className="w-4 h-4" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportar('excel')} className="gap-2">
              <Download className="w-4 h-4" /> Excel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
