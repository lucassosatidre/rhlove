import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { RefreshCw, ChevronDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const MAX_DAYS_PER_BLOCK = 14;
const BACKFILL_START = '2026-03-23';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3000;

interface SaiposSale {
  id_sale_type: number;
  total_amount: number;
  canceled: string;
  shift_date: string;
}

interface DayTotals {
  faturamento_salao: number;
  pedidos_salao: number;
  faturamento_tele: number;
  pedidos_tele: number;
  faturamento_total: number;
  pedidos_totais: number;
  total_sales: number;
}

function getYesterdayBRT(): string {
  const now = new Date();
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  brt.setDate(brt.getDate() - 1);
  return brt.toISOString().slice(0, 10);
}

function splitIntoBlocks(start: string, end: string) {
  const blocks: Array<{ start: string; end: string }> = [];
  let current = new Date(start + 'T00:00:00Z');
  const endDate = new Date(end + 'T00:00:00Z');
  while (current <= endDate) {
    const blockEnd = new Date(current);
    blockEnd.setDate(blockEnd.getDate() + MAX_DAYS_PER_BLOCK - 1);
    if (blockEnd > endDate) blockEnd.setTime(endDate.getTime());
    blocks.push({
      start: current.toISOString().slice(0, 10),
      end: blockEnd.toISOString().slice(0, 10),
    });
    current = new Date(blockEnd);
    current.setDate(current.getDate() + 1);
  }
  return blocks;
}

function aggregateByDay(sales: SaiposSale[]): Map<string, DayTotals> {
  const map = new Map<string, DayTotals>();
  for (const sale of sales) {
    if (sale.canceled !== 'N') continue;
    const day = sale.shift_date?.slice(0, 10);
    if (!day) continue;
    let t = map.get(day);
    if (!t) {
      t = { faturamento_salao: 0, pedidos_salao: 0, faturamento_tele: 0, pedidos_tele: 0, faturamento_total: 0, pedidos_totais: 0, total_sales: 0 };
      map.set(day, t);
    }
    t.total_sales++;
    const amount = Number(sale.total_amount) || 0;
    if (sale.id_sale_type === 3) {
      t.faturamento_salao += amount;
      t.pedidos_salao++;
    } else if ([1, 2, 4].includes(sale.id_sale_type)) {
      t.faturamento_tele += amount;
      t.pedidos_tele++;
    }
  }
  for (const t of map.values()) {
    t.faturamento_total = t.faturamento_salao + t.faturamento_tele;
    t.pedidos_totais = t.pedidos_salao + t.pedidos_tele;
  }
  return map;
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  setProgress: (msg: string) => void,
  blockLabel: string,
): Promise<Response> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      if (attempt < MAX_RETRIES && [403, 500, 502, 503].includes(res.status)) {
        setProgress(`${blockLabel} — Erro ${res.status}, tentativa ${attempt + 1}/${MAX_RETRIES}...`);
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
        continue;
      }
      const body = await res.text();
      throw new Error(`Proxy ${res.status}: ${body.slice(0, 200)}`);
    } catch (err: any) {
      if (err.message?.startsWith('Proxy ')) throw err;
      if (attempt < MAX_RETRIES) {
        setProgress(`${blockLabel} — Erro de rede, tentativa ${attempt + 1}/${MAX_RETRIES}...`);
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
        continue;
      }
      throw new Error(`Falha após ${MAX_RETRIES} tentativas: ${err.message}`);
    }
  }
  throw new Error('Falha após todas as tentativas');
}

export default function SaiposSyncButton() {
  const { usuario } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState('');
  const [rangeDialogOpen, setRangeDialogOpen] = useState(false);
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [manualToken, setManualToken] = useState('');

  if (!usuario || usuario.perfil !== 'admin') return null;

  async function getProxyConfig(): Promise<{ proxyUrl: string; anonKey: string }> {
    const { data, error } = await supabase
      .from('app_settings' as any)
      .select('key, value')
      .in('key', ['SAIPOS_PROXY_FUNCTION_URL', 'CXLOVE_ANON_KEY']);
    if (error) throw new Error('Erro ao buscar configuração do proxy: ' + error.message);
    const settings = (data as any[]) || [];
    const proxyUrl = settings.find((s: any) => s.key === 'SAIPOS_PROXY_FUNCTION_URL')?.value;
    const anonKey = settings.find((s: any) => s.key === 'CXLOVE_ANON_KEY')?.value;
    if (!proxyUrl || !anonKey) {
      throw new Error('Configuração do proxy não encontrada em app_settings. Configure SAIPOS_PROXY_FUNCTION_URL e CXLOVE_ANON_KEY.');
    }
    return { proxyUrl, anonKey };
  }

  async function syncRange(start: string, end: string) {
    setSyncing(true);
    setProgress('Buscando configuração...');
    try {
      const { proxyUrl, anonKey } = await getProxyConfig();
      const blocks = splitIntoBlocks(start, end);
      let totalDays = 0;
      let totalSales = 0;
      let totalFat = 0;

      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        const blockLabel = `${block.start} a ${block.end} (bloco ${i + 1}/${blocks.length})`;
        setProgress(`Sincronizando ${blockLabel}...`);

        const res = await fetchWithRetry(
          proxyUrl,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${anonKey}`,
              'apikey': anonKey,
            },
            body: JSON.stringify({
              mode: 'raw',
              start_date: block.start,
              end_date: block.end,
            }),
          },
          setProgress,
          blockLabel,
        );

        const responseData = await res.json();
        const sales: SaiposSale[] = responseData.sales || responseData || [];
        const byDay = aggregateByDay(sales);

        const startD = new Date(block.start + 'T00:00:00Z');
        const endD = new Date(block.end + 'T00:00:00Z');

        for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
          const dayStr = d.toISOString().slice(0, 10);
          const t = byDay.get(dayStr) || {
            faturamento_salao: 0, pedidos_salao: 0,
            faturamento_tele: 0, pedidos_tele: 0,
            faturamento_total: 0, pedidos_totais: 0, total_sales: 0,
          };

          const { data: existing } = await supabase
            .from('daily_sales')
            .select('id')
            .eq('date', dayStr)
            .maybeSingle();

          if (existing) {
            await supabase.from('daily_sales').update({
              faturamento_total: t.faturamento_total,
              pedidos_totais: t.pedidos_totais,
              faturamento_salao: t.faturamento_salao,
              pedidos_salao: t.pedidos_salao,
              faturamento_tele: t.faturamento_tele,
              pedidos_tele: t.pedidos_tele,
            }).eq('id', existing.id);
          } else {
            await supabase.from('daily_sales').insert({
              date: dayStr,
              faturamento_total: t.faturamento_total,
              pedidos_totais: t.pedidos_totais,
              faturamento_salao: t.faturamento_salao,
              pedidos_salao: t.pedidos_salao,
              faturamento_tele: t.faturamento_tele,
              pedidos_tele: t.pedidos_tele,
            });
          }

          await supabase.from('saipos_sync_log').insert({
            sync_date: dayStr,
            mode: start === end ? 'yesterday' : 'backfill',
            total_sales: t.total_sales,
            faturamento_total: t.faturamento_total,
            pedidos_totais: t.pedidos_totais,
            status: 'success',
          } as any);

          totalDays++;
          totalSales += t.total_sales;
          totalFat += t.faturamento_total;
        }
      }

      setProgress('');
      queryClient.invalidateQueries({ queryKey: ['daily_sales'] });
      toast({
        title: 'Sincronização concluída!',
        description: `${totalDays} dias | ${totalSales} vendas | R$ ${totalFat.toFixed(2)}`,
      });
    } catch (err: any) {
      console.error('Saipos sync error:', err);
      setProgress('');
      toast({
        title: 'Erro na sincronização',
        description: err.message?.slice(0, 200),
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  }

  async function handleSaveManualToken() {
    if (!manualToken.trim()) return;
    try {
      const { data: existing } = await supabase
        .from('app_settings' as any)
        .select('key')
        .eq('key', 'SAIPOS_API_TOKEN')
        .maybeSingle();

      if (existing) {
        await supabase
          .from('app_settings' as any)
          .update({ value: manualToken.trim(), updated_at: new Date().toISOString() } as any)
          .eq('key', 'SAIPOS_API_TOKEN');
      } else {
        await supabase
          .from('app_settings' as any)
          .insert({ key: 'SAIPOS_API_TOKEN', value: manualToken.trim() } as any);
      }

      setTokenDialogOpen(false);
      setManualToken('');
      toast({ title: 'Token salvo', description: 'Token Saipos salvo com sucesso.' });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={syncing}>
            <RefreshCw className={`w-4 h-4 mr-1 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? progress || 'Sincronizando...' : 'Sync Saipos'}
            <ChevronDown className="w-3 h-3 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => syncRange(getYesterdayBRT(), getYesterdayBRT())}>
            Sync ontem
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setRangeDialogOpen(true)}>
            Sync período...
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => syncRange(BACKFILL_START, getYesterdayBRT())}>
            Backfill (23/03 → ontem)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTokenDialogOpen(true)}>
            Configurar token
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={rangeDialogOpen} onOpenChange={setRangeDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Sincronizar período</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Data Inicial</Label>
              <Input type="date" value={rangeStart} onChange={e => setRangeStart(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data Final</Label>
              <Input type="date" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={!rangeStart || !rangeEnd}
              onClick={() => {
                setRangeDialogOpen(false);
                syncRange(rangeStart, rangeEnd);
              }}
            >
              Sincronizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={tokenDialogOpen} onOpenChange={setTokenDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Configurar token Saipos</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Token JWT da API Saipos</Label>
            <Input
              type="password"
              placeholder="Cole o token aqui..."
              value={manualToken}
              onChange={e => setManualToken(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">O token já foi importado automaticamente. Use este campo apenas se precisar atualizar.</p>
          </div>
          <DialogFooter>
            <Button disabled={!manualToken.trim()} onClick={handleSaveManualToken}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
