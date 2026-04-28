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
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [repairDialogOpen, setRepairDialogOpen] = useState(false);
  const [repairStart, setRepairStart] = useState('');
  const [repairEnd, setRepairEnd] = useState('');

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

  function getTodayBRT(): string {
    const now = new Date();
    const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    return brt.toISOString().slice(0, 10);
  }

  async function syncDayRange(
    proxyUrl: string,
    anonKey: string,
    startDate: string,
    endDate: string,
    blockOffset: number,
    totalBlocks: number,
  ): Promise<{ days: number; sales: number }> {
    const blocks = splitIntoBlocks(startDate, endDate);
    let totalDays = 0;
    let totalSales = 0;

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const globalIdx = blockOffset + i + 1;
      const blockLabel = `Sincronizando ${block.start} a ${block.end} (bloco ${globalIdx}/${totalBlocks})`;
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

    return { days: totalDays, sales: totalSales };
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

      const todayBRT = getTodayBRT();
      const yesterday = addDays(todayBRT, -1); // D-1
      const dayBeforeYesterday = addDays(todayBRT, -2); // D-2
      const lastSyncDate = lastSync?.sync_date || null;

      // 2. Calculate backfill range: day after last sync → D-2
      const backfillStart = lastSyncDate ? addDays(lastSyncDate, 1) : BACKFILL_START;
      const { proxyUrl, anonKey } = await getProxyConfig();

      let totalDays = 0;
      let totalSales = 0;

      // 3. Sync backfill range (only missing days: backfillStart → D-2)
      if (backfillStart <= dayBeforeYesterday) {
        const backfillBlocks = splitIntoBlocks(backfillStart, dayBeforeYesterday);
        const yesterdayBlocks = splitIntoBlocks(yesterday, yesterday);
        const allBlockCount = backfillBlocks.length + yesterdayBlocks.length;

        const result = await syncDayRange(proxyUrl, anonKey, backfillStart, dayBeforeYesterday, 0, allBlockCount);
        totalDays += result.days;
        totalSales += result.sales;

        // 4. Always re-sync D-1 (yesterday)
        setProgress(`Re-sincronizando D-1 (${yesterday})...`);
        const d1Result = await syncDayRange(proxyUrl, anonKey, yesterday, yesterday, backfillBlocks.length, allBlockCount);
        totalDays += d1Result.days;
        totalSales += d1Result.sales;
      } else {
        // No backfill needed, just re-sync D-1
        setProgress(`Re-sincronizando D-1 (${yesterday})...`);
        const d1Result = await syncDayRange(proxyUrl, anonKey, yesterday, yesterday, 0, 1);
        totalDays += d1Result.days;
        totalSales += d1Result.sales;
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

  async function handleRepair() {
    if (!repairStart || !repairEnd) return;
    if (repairStart > repairEnd) {
      toast({ title: 'Datas inválidas', description: 'Início deve ser ≤ fim.', variant: 'destructive' });
      return;
    }
    setRepairDialogOpen(false);
    setSyncing(true);
    setProgress(`Reparando ${repairStart} a ${repairEnd}...`);
    try {
      const { proxyUrl, anonKey } = await getProxyConfig();
      const blocks = splitIntoBlocks(repairStart, repairEnd);
      const result = await syncDayRange(proxyUrl, anonKey, repairStart, repairEnd, 0, blocks.length);
      setProgress('');
      queryClient.invalidateQueries({ queryKey: ['daily_sales'] });
      toast({
        title: '✅ Reparado!',
        description: `${result.days} dia(s) re-sincronizado(s) | ${result.sales} vendas`,
      });
    } catch (err: any) {
      console.error('Saipos repair error:', err);
      setProgress('');
      toast({
        title: 'Erro ao reparar',
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

  async function handleSample() {
    setSyncing(true);
    setProgress('Buscando amostra de vendas...');
    try {
      const { proxyUrl, anonKey } = await getProxyConfig();
      const yesterday = getYesterdayBRT();
      const res = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
          'apikey': anonKey,
        },
        body: JSON.stringify({ mode: 'raw', start_date: yesterday, end_date: yesterday, p_limit: 1000 }),
      });
      if (!res.ok) throw new Error(`Proxy error ${res.status}`);
      const allSales = await res.json();
      const sales = (allSales.sales || allSales) as any[];

      console.log('=== SAIPOS SAMPLE COMPLETO ===');
      console.log('Data:', yesterday);
      console.log('Total vendas retornadas:', sales.length);

      // 1. Vendas canceladas (canceled != "N")
      const canceled = sales.filter((s: any) => s.canceled !== 'N');
      const canceledValues: Record<string, number> = {};
      canceled.forEach((s: any) => {
        const v = String(s.canceled ?? 'null');
        canceledValues[v] = (canceledValues[v] || 0) + 1;
      });
      console.log(`\n1. Vendas canceladas (canceled != "N"): ${canceled.length}`);
      console.log('   Valores de canceled encontrados:', canceledValues);

      // 2. Vendas com id_sale_type fora de 1,2,3,4
      const knownTypes = [1, 2, 3, 4];
      const unknownType = sales.filter((s: any) => s.id_sale_type != null && !knownTypes.includes(s.id_sale_type));
      const unknownTypeValues: Record<string, number> = {};
      unknownType.forEach((s: any) => {
        const v = String(s.id_sale_type);
        unknownTypeValues[v] = (unknownTypeValues[v] || 0) + 1;
      });
      console.log(`\n2. Vendas com id_sale_type fora de [1,2,3,4]: ${unknownType.length}`);
      console.log('   Tipos encontrados:', unknownTypeValues);

      // 3. Vendas com id_sale_type null
      const nullType = sales.filter((s: any) => s.id_sale_type == null);
      console.log(`\n3. Vendas com id_sale_type null: ${nullType.length}`);

      // 4. Soma total_amount: canceled="N" AND id_sale_type IN (1,2,3,4)
      const validSales = sales.filter((s: any) => s.canceled === 'N' && knownTypes.includes(s.id_sale_type));
      const totalAmount = validSales.reduce((sum: number, s: any) => sum + (Number(s.total_amount) || 0), 0);
      console.log(`\n4. Vendas válidas (canceled="N", tipo 1-4): ${validSales.length}`);
      console.log(`   Soma total_amount: R$ ${totalAmount.toFixed(2)}`);

      // Breakdown por tipo
      for (const t of knownTypes) {
        const ofType = validSales.filter((s: any) => s.id_sale_type === t);
        const typeSum = ofType.reduce((sum: number, s: any) => sum + (Number(s.total_amount) || 0), 0);
        console.log(`   Tipo ${t}: ${ofType.length} vendas, R$ ${typeSum.toFixed(2)}`);
      }

      // 3 exemplos tipo 3
      const type3 = validSales.filter((s: any) => s.id_sale_type === 3).slice(0, 3);
      console.log('\n--- Exemplos vendas tipo 3 (Salão) ---');
      type3.forEach((sale: any, i: number) => {
        console.log(`Venda ${i + 1}: total_amount=${sale.total_amount}, service_charge=${sale.table_order?.total_service_charge_amount}`);
      });

      setProgress('');
      toast({
        title: 'Sample concluído',
        description: `${sales.length} vendas analisadas — veja console (F12).`,
      });
    } catch (err: any) {
      setProgress('');
      toast({ title: 'Erro no sample', description: err.message, variant: 'destructive' });
    } finally {
      setSyncing(false);
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
