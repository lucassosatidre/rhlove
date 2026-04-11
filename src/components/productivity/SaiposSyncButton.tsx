import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { RefreshCw, Settings } from 'lucide-react';
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
  table_order?: { total_service_charge_amount?: number };
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

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
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
    const baseAmount = Number(sale.total_amount) || 0;
    const serviceCharge = sale.id_sale_type === 3
      ? Number(sale.table_order?.total_service_charge_amount || 0)
      : 0;
    const amount = baseAmount + serviceCharge;
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
      throw new Error('Configuração do proxy não encontrada em app_settings.');
    }
    return { proxyUrl, anonKey };
  }

  async function handleSync() {
    setSyncing(true);
    setProgress('Verificando última sincronização...');
    try {
      // 1. Find last successful sync
      const { data: lastSync } = await supabase
        .from('saipos_sync_log')
        .select('sync_date')
        .eq('status', 'success')
        .order('sync_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      const yesterday = getYesterdayBRT();
      const lastSyncDate = lastSync?.sync_date || null;

      // 2. Calculate start date
      const startDate = lastSyncDate ? addDays(lastSyncDate, 1) : BACKFILL_START;

      // 3. Check if already up to date
      if (startDate > yesterday) {
        setProgress('');
        setSyncing(false);
        toast({ title: '✅ Já está atualizado até ontem' });
        return;
      }

      // 4. Sync the range
      const { proxyUrl, anonKey } = await getProxyConfig();
      const blocks = splitIntoBlocks(startDate, yesterday);
      let totalDays = 0;
      let totalSales = 0;

      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        const blockLabel = `Sincronizando ${block.start} a ${block.end} (bloco ${i + 1}/${blocks.length})`;
        setProgress(blockLabel);

        const res = await fetchWithRetry(
          proxyUrl,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${anonKey}`,
              'apikey': anonKey,
            },
            body: JSON.stringify({ mode: 'raw', start_date: block.start, end_date: block.end }),
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
            mode: 'auto',
            total_sales: t.total_sales,
            faturamento_total: t.faturamento_total,
            pedidos_totais: t.pedidos_totais,
            status: 'success',
          } as any);

          totalDays++;
          totalSales += t.total_sales;
        }
      }

      setProgress('');
      queryClient.invalidateQueries({ queryKey: ['daily_sales'] });
      toast({
        title: '✅ Sincronizado!',
        description: `${totalDays} dias atualizados | ${totalSales} vendas`,
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
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" disabled={syncing} onClick={handleSync}>
          <RefreshCw className={`w-4 h-4 mr-1 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? progress || 'Sincronizando...' : 'Sincronizar Saipos'}
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={syncing}>
              <Settings className="w-3.5 h-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-48 p-1">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-xs"
              onClick={() => setTokenDialogOpen(true)}
            >
              Configurar token
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-xs"
              disabled={syncing}
              onClick={handleSample}
            >
              Inspecionar vendas (sample)
            </Button>
              Configurar token
            </Button>
          </PopoverContent>
        </Popover>
      </div>

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
            <p className="text-xs text-muted-foreground">Use apenas se precisar atualizar o token.</p>
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
