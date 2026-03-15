import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lightbulb, RefreshCw, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { OverviewMetrics, SectorMetric, HealthMetric } from '@/lib/dashboardEngine';

interface Props {
  overview: OverviewMetrics;
  sectorMetrics: SectorMetric[];
  healthMetrics: HealthMetric[];
}

export default function AdvisorInsights({ overview, sectorMetrics, healthMetrics }: Props) {
  const [insights, setInsights] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const context = {
        faturamento: overview.faturamento,
        pedidos: overview.pedidos,
        colaboradores: overview.colaboradores,
        pct: overview.pct,
        tct: overview.tct,
        variacaoFaturamento: overview.prevFaturamento > 0 ? ((overview.faturamento - overview.prevFaturamento) / overview.prevFaturamento * 100).toFixed(1) : 'N/A',
        setores: sectorMetrics.map(s => ({
          setor: s.sector,
          pcs: s.pcs.toFixed(2),
          tcs: s.tcs.toFixed(2),
          pessoas: s.pessoas,
        })),
        saude: healthMetrics.map(m => ({
          indicador: m.label,
          atual: m.current.toFixed(2),
          media: m.average.toFixed(2),
        })),
      };

      const { data, error: fnError } = await supabase.functions.invoke('dashboard-advisor', {
        body: { context },
      });

      if (fnError) throw fnError;
      if (data?.insights) {
        setInsights(data.insights);
      }
    } catch (err: any) {
      console.error('Advisor error:', err);
      setError('Não foi possível gerar recomendações.');
      // Fallback: generate local insights
      generateLocalInsights();
    } finally {
      setLoading(false);
    }
  }, [overview, sectorMetrics, healthMetrics]);

  const generateLocalInsights = () => {
    const local: string[] = [];
    
    // Faturamento trend
    if (overview.prevFaturamento > 0) {
      const change = ((overview.faturamento - overview.prevFaturamento) / overview.prevFaturamento * 100);
      if (change < -10) local.push(`Faturamento caiu ${Math.abs(change).toFixed(0)}% em relação ao período anterior.`);
      else if (change > 10) local.push(`Faturamento subiu ${change.toFixed(0)}% em relação ao período anterior.`);
    }

    // Sector analysis
    for (const s of sectorMetrics) {
      const h = healthMetrics.find(m => m.label.toLowerCase().includes(s.sector.toLowerCase().slice(0, 4)));
      if (h && h.current < h.average * 0.85) {
        local.push(`${s.sector} está com produtividade ${((1 - h.current / h.average) * 100).toFixed(0)}% abaixo da média.`);
      }
    }

    // PCT/TCT
    if (overview.prevPct > 0 && overview.pct < overview.prevPct * 0.9) {
      local.push(`Pedidos por colaborador caiu. Considere revisar o dimensionamento da equipe.`);
    }

    if (local.length === 0) {
      local.push('Operação dentro dos parâmetros normais para o período.');
    }

    setInsights(local);
  };

  useEffect(() => {
    if (overview.faturamento > 0 || overview.pedidos > 0) {
      fetchInsights();
    } else {
      generateLocalInsights();
    }
  }, [overview.faturamento, overview.pedidos]);

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            Conselheiro Operacional
          </CardTitle>
          <Button size="sm" variant="ghost" onClick={fetchInsights} disabled={loading} className="h-7 text-xs no-print">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading && <p className="text-xs text-muted-foreground">Analisando dados...</p>}
        {error && <p className="text-xs text-muted-foreground">{error}</p>}
        {insights.map((insight, i) => (
          <div key={i} className="flex items-start gap-2 text-xs">
            <span className="text-amber-500 mt-0.5">•</span>
            <span className="text-foreground/80">{insight}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
