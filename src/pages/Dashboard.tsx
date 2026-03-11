import { useMemo } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { formatarMoeda } from '@/types/finance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

export default function Dashboard() {
  const { transacoes, categorias } = useFinance();

  const hoje = new Date();
  const mesAtual = hoje.getMonth();
  const anoAtual = hoje.getFullYear();

  const transacoesMes = useMemo(() =>
    transacoes.filter(t => {
      const d = new Date(t.data);
      return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
    }), [transacoes, mesAtual, anoAtual]);

  const totalReceitas = useMemo(() =>
    transacoesMes.filter(t => t.tipo === 'receita').reduce((s, t) => s + t.valor, 0),
    [transacoesMes]);

  const totalDespesas = useMemo(() =>
    transacoesMes.filter(t => t.tipo === 'despesa').reduce((s, t) => s + t.valor, 0),
    [transacoesMes]);

  const saldo = totalReceitas - totalDespesas;

  // Monthly chart data (last 6 months)
  const dadosMensais = useMemo(() => {
    const meses: { mes: string; receitas: number; despesas: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(anoAtual, mesAtual - i, 1);
      const m = d.getMonth();
      const a = d.getFullYear();
      const label = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
      const rec = transacoes.filter(t => { const td = new Date(t.data); return td.getMonth() === m && td.getFullYear() === a && t.tipo === 'receita'; }).reduce((s, t) => s + t.valor, 0);
      const desp = transacoes.filter(t => { const td = new Date(t.data); return td.getMonth() === m && td.getFullYear() === a && t.tipo === 'despesa'; }).reduce((s, t) => s + t.valor, 0);
      meses.push({ mes: label, receitas: rec, despesas: desp });
    }
    return meses;
  }, [transacoes, mesAtual, anoAtual]);

  // Category pie chart
  const dadosCategorias = useMemo(() => {
    const map = new Map<string, number>();
    transacoesMes.filter(t => t.tipo === 'despesa').forEach(t => {
      map.set(t.categoriaId, (map.get(t.categoriaId) || 0) + t.valor);
    });
    return Array.from(map.entries()).map(([catId, valor]) => {
      const cat = categorias.find(c => c.id === catId);
      return { name: cat?.nome || 'Outros', value: valor, color: cat?.cor || '#6b7280' };
    }).sort((a, b) => b.value - a.value);
  }, [transacoesMes, categorias]);

  const cards = [
    { title: 'Saldo Atual', value: saldo, icon: Wallet, trend: saldo >= 0 },
    { title: 'Receitas do Mês', value: totalReceitas, icon: TrendingUp, trend: true },
    { title: 'Despesas do Mês', value: totalDespesas, icon: TrendingDown, trend: false },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Visão geral das suas finanças</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map(card => (
          <Card key={card.title}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-muted-foreground">{card.title}</span>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${card.trend ? 'bg-accent' : 'bg-destructive/10'}`}>
                  <card.icon className={`w-4 h-4 ${card.trend ? 'text-accent-foreground' : 'text-destructive'}`} />
                </div>
              </div>
              <p className={`text-2xl font-bold ${card.title === 'Saldo Atual' ? (saldo >= 0 ? 'text-success' : 'text-destructive') : ''}`}>
                {formatarMoeda(card.value)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Receitas vs Despesas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosMensais} barGap={4}>
                  <XAxis dataKey="mes" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => formatarMoeda(value)} />
                  <Bar dataKey="receitas" fill="hsl(142, 60%, 40%)" radius={[4, 4, 0, 0]} name="Receitas" />
                  <Bar dataKey="despesas" fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]} name="Despesas" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Despesas por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {dadosCategorias.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dadosCategorias}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {dadosCategorias.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatarMoeda(value)} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  Sem despesas neste mês
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent transactions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Últimos Lançamentos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {transacoesMes.slice(0, 5).map(t => {
              const cat = categorias.find(c => c.id === t.categoriaId);
              return (
                <div key={t.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${t.tipo === 'receita' ? 'bg-accent' : 'bg-destructive/10'}`}>
                      {t.tipo === 'receita' ? <ArrowUpRight className="w-4 h-4 text-success" /> : <ArrowDownRight className="w-4 h-4 text-destructive" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{t.descricao}</p>
                      <p className="text-xs text-muted-foreground">{cat?.nome}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-semibold ${t.tipo === 'receita' ? 'text-success' : 'text-destructive'}`}>
                    {t.tipo === 'receita' ? '+' : '-'}{formatarMoeda(t.valor)}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
