import { useMemo, useState } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { formatarMoeda } from '@/types/finance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Target } from 'lucide-react';

export default function Metas() {
  const { transacoes, metas, atualizarMeta } = useFinance();

  const hoje = new Date();
  const mesAtualKey = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

  const metaAtual = metas.find(m => m.mes === mesAtualKey);

  const economiaDoMes = useMemo(() => {
    const rec = transacoes.filter(t => {
      const d = new Date(t.data);
      return d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear() && t.tipo === 'receita';
    }).reduce((s, t) => s + t.valor, 0);
    const desp = transacoes.filter(t => {
      const d = new Date(t.data);
      return d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear() && t.tipo === 'despesa';
    }).reduce((s, t) => s + t.valor, 0);
    return rec - desp;
  }, [transacoes]);

  const [novoValorMeta, setNovoValorMeta] = useState(metaAtual?.valorMeta?.toString() || '3000');

  const handleSalvarMeta = () => {
    const valor = parseFloat(novoValorMeta);
    if (isNaN(valor) || valor <= 0) return;
    atualizarMeta({
      id: metaAtual?.id || `m${Date.now()}`,
      mes: mesAtualKey,
      valorMeta: valor,
      valorAtual: economiaDoMes,
    });
  };

  const progresso = metaAtual ? Math.min(100, Math.max(0, (economiaDoMes / metaAtual.valorMeta) * 100)) : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Metas Financeiras</h1>
        <p className="text-muted-foreground text-sm">Acompanhe seu progresso de economia</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Meta de Economia — {hoje.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="text-center p-4 rounded-lg bg-muted">
              <p className="text-xs text-muted-foreground mb-1">Meta</p>
              <p className="text-xl font-bold">{formatarMoeda(metaAtual?.valorMeta || 0)}</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted">
              <p className="text-xs text-muted-foreground mb-1">Economia Atual</p>
              <p className={`text-xl font-bold ${economiaDoMes >= 0 ? 'text-success' : 'text-destructive'}`}>
                {formatarMoeda(economiaDoMes)}
              </p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted">
              <p className="text-xs text-muted-foreground mb-1">Progresso</p>
              <p className="text-xl font-bold">{progresso.toFixed(0)}%</p>
            </div>
          </div>

          <div>
            <Progress value={progresso} className="h-3" />
            <p className="text-xs text-muted-foreground mt-2 text-center">
              {progresso >= 100
                ? '🎉 Parabéns! Meta atingida!'
                : `Faltam ${formatarMoeda(Math.max(0, (metaAtual?.valorMeta || 0) - economiaDoMes))} para atingir a meta`}
            </p>
          </div>

          <div className="flex items-end gap-3 pt-4 border-t border-border">
            <div className="space-y-2 flex-1">
              <Label>Alterar meta mensal (R$)</Label>
              <Input
                type="number"
                min="0"
                step="100"
                value={novoValorMeta}
                onChange={e => setNovoValorMeta(e.target.value)}
              />
            </div>
            <Button onClick={handleSalvarMeta}>Salvar</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
