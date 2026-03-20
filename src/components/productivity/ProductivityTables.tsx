import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ArrowUp, ArrowDown, Minus, Search, ChevronUp, ChevronDown, ChevronRight } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { ProductivityRow } from '@/lib/productivityEngine';
import { formatCurrency, formatDecimal, formatDateBR } from '@/lib/productivityEngine';

const SECTORS = ['COZINHA', 'SALÃO', 'TELE - ENTREGA', 'DIURNO'] as const;
const SECTOR_LABELS: Record<string, string> = {
  'COZINHA': 'Cozinha',
  'SALÃO': 'Salão',
  'TELE - ENTREGA': 'Tele',
  'DIURNO': 'Diurno',
};

type SortDir = 'asc' | 'desc' | null;

interface PeriodPreset {
  label: string;
  getDates: () => { start: string; end: string };
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getPreviousPeriod(start: string, end: string): { start: string; end: string } {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  const days = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
  const prevEnd = new Date(s);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - days + 1);
  return { start: toDateStr(prevStart), end: toDateStr(prevEnd) };
}

function TrendIcon({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0) return <Minus className="w-3.5 h-3.5 text-muted-foreground" />;
  if (current > previous) return <ArrowUp className="w-3.5 h-3.5 text-success" />;
  if (current < previous) return <ArrowDown className="w-3.5 h-3.5 text-destructive" />;
  return <Minus className="w-3.5 h-3.5 text-muted-foreground" />;
}

function DiffBadge({ current, previous, isCurrency }: { current: number; previous: number; isCurrency?: boolean }) {
  const diff = current - previous;
  const pct = previous > 0 ? ((diff / previous) * 100) : (current > 0 ? 100 : 0);
  const isPositive = diff > 0;
  const isNeutral = diff === 0;

  const colorClass = isNeutral
    ? 'text-muted-foreground'
    : isPositive
      ? 'text-success'
      : 'text-destructive';

  const formatted = isCurrency
    ? `${isPositive ? '+' : ''}${formatCurrency(diff)}`
    : `${isPositive ? '+' : ''}${formatDecimal(diff)}`;

  return (
    <div className={`flex items-center gap-1 text-xs tabular-nums ${colorClass}`}>
      <TrendIcon current={current} previous={previous} />
      <span>{formatted}</span>
      {!isNeutral && <span className="opacity-70">({isPositive ? '+' : ''}{pct.toFixed(1)}%)</span>}
    </div>
  );
}

function CollapsibleCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 cursor-pointer hover:bg-muted/30 transition-colors select-none">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-90' : ''}`} />
                <CardTitle className="text-sm font-semibold">{title}</CardTitle>
                {subtitle && <span className="text-xs text-muted-foreground hidden sm:inline">({subtitle})</span>}
              </div>
              <span className="text-[10px] text-muted-foreground">{open ? 'Recolher' : 'Expandir'}</span>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="p-0">
            {children}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

  currentRows: ProductivityRow[];
  previousRows: ProductivityRow[];
  startDate: string;
  endDate: string;
}

export default function ProductivityTables({ currentRows, previousRows, startDate, endDate }: Props) {
  const [search, setSearch] = useState('');

  // Build date-indexed maps
  const currentByDate = useMemo(() => {
    const map = new Map<string, Map<string, ProductivityRow>>();
    for (const r of currentRows) {
      if (!map.has(r.date)) map.set(r.date, new Map());
      map.get(r.date)!.set(r.sector, r);
    }
    return map;
  }, [currentRows]);

  const dates = useMemo(() =>
    [...currentByDate.keys()].sort(),
    [currentByDate]
  );

  // Averages for previous period by sector
  const prevAvg = useMemo(() => {
    const sums: Record<string, { pcs: number; tcs: number; pedidos: number; vendas: number; count: number }> = {};
    for (const r of previousRows) {
      if (!sums[r.sector]) sums[r.sector] = { pcs: 0, tcs: 0, pedidos: 0, vendas: 0, count: 0 };
      sums[r.sector].pcs += r.pcs;
      sums[r.sector].tcs += r.tcs;
      sums[r.sector].pedidos += r.pedidos;
      sums[r.sector].vendas += r.vendas;
      sums[r.sector].count++;
    }
    const result: Record<string, { pcs: number; tcs: number; pedidos: number; vendas: number }> = {};
    for (const [k, v] of Object.entries(sums)) {
      result[k] = {
        pcs: v.count > 0 ? v.pcs / v.count : 0,
        tcs: v.count > 0 ? v.tcs / v.count : 0,
        pedidos: v.count > 0 ? v.pedidos / v.count : 0,
        vendas: v.count > 0 ? v.vendas / v.count : 0,
      };
    }
    return result;
  }, [previousRows]);

  // Current period averages
  const currAvg = useMemo(() => {
    const sums: Record<string, { pcs: number; tcs: number; pedidos: number; vendas: number; count: number }> = {};
    for (const r of currentRows) {
      if (!sums[r.sector]) sums[r.sector] = { pcs: 0, tcs: 0, pedidos: 0, vendas: 0, count: 0 };
      sums[r.sector].pcs += r.pcs;
      sums[r.sector].tcs += r.tcs;
      sums[r.sector].pedidos += r.pedidos;
      sums[r.sector].vendas += r.vendas;
      sums[r.sector].count++;
    }
    const result: Record<string, { pcs: number; tcs: number; pedidos: number; vendas: number }> = {};
    for (const [k, v] of Object.entries(sums)) {
      result[k] = {
        pcs: v.count > 0 ? v.pcs / v.count : 0,
        tcs: v.count > 0 ? v.tcs / v.count : 0,
        pedidos: v.count > 0 ? v.pedidos / v.count : 0,
        vendas: v.count > 0 ? v.vendas / v.count : 0,
      };
    }
    return result;
  }, [currentRows]);

  const prevPeriod = useMemo(() => getPreviousPeriod(startDate, endDate), [startDate, endDate]);

  return (
    <div className="space-y-6">
      {/* Period comparison info */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Período atual: <strong className="text-foreground">{formatDateBR(startDate)} — {formatDateBR(endDate)}</strong></span>
        <span>•</span>
        <span>Comparando com: <strong className="text-foreground">{formatDateBR(prevPeriod.start)} — {formatDateBR(prevPeriod.end)}</strong></span>
      </div>

      {/* 1. Pedidos por Setor */}
      <CollapsibleCard title="Pedidos por Colaborador do Setor" subtitle="PCS por setor + PCT do time">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="font-bold text-xs sticky left-0 bg-muted/40 z-10">Data</TableHead>
                  {SECTORS.map(s => (
                    <TableHead key={s} className="text-center font-bold text-xs">
                      {SECTOR_LABELS[s]}
                    </TableHead>
                  ))}
                  <TableHead className="text-center font-bold text-xs">Time</TableHead>
                </TableRow>
                <TableRow className="bg-muted/20">
                  <TableHead className="text-xs sticky left-0 bg-muted/20 z-10"></TableHead>
                  {[...SECTORS, 'TIME' as const].map((s) => (
                    <TableHead key={`${s}-sub`} className="text-center text-[10px] text-muted-foreground">
                      {s === 'TIME' ? 'PCT' : 'PCS'}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {dates.map((date, i) => {
                  const dayData = currentByDate.get(date);
                  return (
                    <TableRow key={date} className={i % 2 === 0 ? '' : 'bg-muted/20'}>
                      <TableCell className="font-medium text-xs sticky left-0 bg-inherit z-10 whitespace-nowrap">
                        {formatDateBR(date)}
                      </TableCell>
                      {SECTORS.map(s => {
                        const row = dayData?.get(s);
                        const val = row ? Math.round(row.pcs * 100) / 100 : 0;
                        const prev = prevAvg[s]?.pcs || 0;
                        return (
                          <TableCell key={s} className="text-center p-1.5">
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-sm font-semibold tabular-nums">{val > 0 ? formatDecimal(val) : '-'}</span>
                              {prev > 0 && val > 0 && <DiffBadge current={val} previous={prev} />}
                            </div>
                          </TableCell>
                        );
                      })}
                      {/* TIME (PCT) */}
                      {(() => {
                        const pctRow = dayData?.get('PCT');
                        const val = pctRow ? Math.round(pctRow.pcs * 100) / 100 : 0;
                        const prev = prevAvg['PCT']?.pcs || 0;
                        return (
                          <TableCell className="text-center p-1.5 bg-muted/30">
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-sm font-bold tabular-nums">{val > 0 ? formatDecimal(val) : '-'}</span>
                              {prev > 0 && val > 0 && <DiffBadge current={val} previous={prev} />}
                            </div>
                          </TableCell>
                        );
                      })()}
                    </TableRow>
                  );
                })}
                {/* Averages row */}
                <TableRow className="border-t-2 border-border bg-muted/40 font-bold">
                  <TableCell className="text-xs sticky left-0 bg-muted/40 z-10">Média</TableCell>
                  {SECTORS.map(s => {
                    const val = currAvg[s]?.pcs || 0;
                    const prev = prevAvg[s]?.pcs || 0;
                    return (
                      <TableCell key={s} className="text-center p-1.5">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-sm font-bold tabular-nums">{val > 0 ? formatDecimal(val) : '-'}</span>
                          {prev > 0 && val > 0 && <DiffBadge current={val} previous={prev} />}
                        </div>
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-center p-1.5 bg-muted/50">
                    {(() => {
                      const val = currAvg['PCT']?.pcs || 0;
                      const prev = prevAvg['PCT']?.pcs || 0;
                      return (
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-sm font-bold tabular-nums">{val > 0 ? formatDecimal(val) : '-'}</span>
                          {prev > 0 && val > 0 && <DiffBadge current={val} previous={prev} />}
                        </div>
                      );
                    })()}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
      </CollapsibleCard>

      {/* 2. Ticket por Setor */}
      <CollapsibleCard title="Ticket por Colaborador do Setor" subtitle="TCS por setor + TCT do time">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="font-bold text-xs sticky left-0 bg-muted/40 z-10">Data</TableHead>
                  {SECTORS.map(s => (
                    <TableHead key={s} className="text-center font-bold text-xs">
                      {SECTOR_LABELS[s]}
                    </TableHead>
                  ))}
                  <TableHead className="text-center font-bold text-xs">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dates.map((date, i) => {
                  const dayData = currentByDate.get(date);
                  return (
                    <TableRow key={date} className={i % 2 === 0 ? '' : 'bg-muted/20'}>
                      <TableCell className="font-medium text-xs sticky left-0 bg-inherit z-10 whitespace-nowrap">
                        {formatDateBR(date)}
                      </TableCell>
                      {SECTORS.map(s => {
                        const row = dayData?.get(s);
                        const val = row ? Math.round(row.tcs * 100) / 100 : 0;
                        const prev = prevAvg[s]?.tcs || 0;
                        return (
                          <TableCell key={s} className="text-center p-1.5">
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-sm font-semibold tabular-nums">{val > 0 ? formatCurrency(val) : '-'}</span>
                              {prev > 0 && val > 0 && <DiffBadge current={val} previous={prev} isCurrency />}
                            </div>
                          </TableCell>
                        );
                      })}
                      {/* TCT */}
                      {(() => {
                        const tctRow = dayData?.get('TCT');
                        const val = tctRow ? Math.round(tctRow.tcs * 100) / 100 : 0;
                        const prev = prevAvg['TCT']?.tcs || 0;
                        return (
                          <TableCell className="text-center p-1.5 bg-muted/30">
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-sm font-bold tabular-nums">{val > 0 ? formatCurrency(val) : '-'}</span>
                              {prev > 0 && val > 0 && <DiffBadge current={val} previous={prev} isCurrency />}
                            </div>
                          </TableCell>
                        );
                      })()}
                    </TableRow>
                  );
                })}
                {/* Averages row */}
                <TableRow className="border-t-2 border-border bg-muted/40 font-bold">
                  <TableCell className="text-xs sticky left-0 bg-muted/40 z-10">Média</TableCell>
                  {SECTORS.map(s => {
                    const val = currAvg[s]?.tcs || 0;
                    const prev = prevAvg[s]?.tcs || 0;
                    return (
                      <TableCell key={s} className="text-center p-1.5">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-sm font-bold tabular-nums">{val > 0 ? formatCurrency(val) : '-'}</span>
                          {prev > 0 && val > 0 && <DiffBadge current={val} previous={prev} isCurrency />}
                        </div>
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-center p-1.5 bg-muted/50">
                    {(() => {
                      const val = currAvg['TCT']?.tcs || 0;
                      const prev = prevAvg['TCT']?.tcs || 0;
                      return (
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-sm font-bold tabular-nums">{val > 0 ? formatCurrency(val) : '-'}</span>
                          {prev > 0 && val > 0 && <DiffBadge current={val} previous={prev} isCurrency />}
                        </div>
                      );
                    })()}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
      </CollapsibleCard>

      {/* 3. Pedidos por Time (daily PCT) */}
      <CollapsibleCard title="Pedidos por Colaborador do Time" subtitle="PCT diário">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="font-bold text-xs sticky left-0 bg-muted/40 z-10">Data</TableHead>
                  <TableHead className="text-right font-bold text-xs">Pedidos Totais</TableHead>
                  <TableHead className="text-right font-bold text-xs">Nº Colaboradores</TableHead>
                  <TableHead className="text-right font-bold text-xs">Ped./Colaborador</TableHead>
                  <TableHead className="text-center font-bold text-xs">vs. Período Anterior</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dates.map((date, i) => {
                  const dayData = currentByDate.get(date);
                  const pctRow = dayData?.get('PCT');
                  const timeRow = dayData?.get('TIME');
                  const val = pctRow ? Math.round(pctRow.pcs * 100) / 100 : 0;
                  const pedidos = pctRow?.pedidos || 0;
                  const pessoas = timeRow?.numero_pessoas || 0;
                  const prev = prevAvg['PCT']?.pcs || 0;
                  return (
                    <TableRow key={date} className={i % 2 === 0 ? '' : 'bg-muted/20'}>
                      <TableCell className="font-medium text-xs sticky left-0 bg-inherit z-10 whitespace-nowrap">
                        {formatDateBR(date)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{pedidos || '-'}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{pessoas || '-'}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm font-semibold">{val > 0 ? formatDecimal(val) : '-'}</TableCell>
                      <TableCell className="text-center">
                        {prev > 0 && val > 0 && <DiffBadge current={val} previous={prev} />}
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="border-t-2 border-border bg-muted/40 font-bold">
                  <TableCell className="text-xs sticky left-0 bg-muted/40 z-10">Média</TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {(() => {
                      const avg = currAvg['PCT']?.pedidos || 0;
                      return avg > 0 ? Math.round(avg) : '-';
                    })()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">-</TableCell>
                  <TableCell className="text-right tabular-nums text-sm font-bold">
                    {currAvg['PCT']?.pcs ? formatDecimal(currAvg['PCT'].pcs) : '-'}
                  </TableCell>
                  <TableCell className="text-center">
                    {(() => {
                      const val = currAvg['PCT']?.pcs || 0;
                      const prev = prevAvg['PCT']?.pcs || 0;
                      return prev > 0 && val > 0 ? <DiffBadge current={val} previous={prev} /> : null;
                    })()}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
      </CollapsibleCard>

      {/* 4. Ticket por Time (daily TCT) */}
      <CollapsibleCard title="Ticket por Colaborador do Time" subtitle="TCT diário">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="font-bold text-xs sticky left-0 bg-muted/40 z-10">Data</TableHead>
                  <TableHead className="text-right font-bold text-xs">Faturamento</TableHead>
                  <TableHead className="text-right font-bold text-xs">Nº Colaboradores</TableHead>
                  <TableHead className="text-right font-bold text-xs">Ticket/Colaborador</TableHead>
                  <TableHead className="text-center font-bold text-xs">vs. Período Anterior</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dates.map((date, i) => {
                  const dayData = currentByDate.get(date);
                  const tctRow = dayData?.get('TCT');
                  const timeRow = dayData?.get('TIME');
                  const val = tctRow ? Math.round(tctRow.tcs * 100) / 100 : 0;
                  const vendas = tctRow?.vendas || 0;
                  const pessoas = timeRow?.numero_pessoas || 0;
                  const prev = prevAvg['TCT']?.tcs || 0;
                  return (
                    <TableRow key={date} className={i % 2 === 0 ? '' : 'bg-muted/20'}>
                      <TableCell className="font-medium text-xs sticky left-0 bg-inherit z-10 whitespace-nowrap">
                        {formatDateBR(date)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{vendas > 0 ? formatCurrency(vendas) : '-'}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{pessoas || '-'}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm font-semibold">{val > 0 ? formatCurrency(val) : '-'}</TableCell>
                      <TableCell className="text-center">
                        {prev > 0 && val > 0 && <DiffBadge current={val} previous={prev} isCurrency />}
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="border-t-2 border-border bg-muted/40 font-bold">
                  <TableCell className="text-xs sticky left-0 bg-muted/40 z-10">Média</TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {(() => {
                      const avg = currAvg['TCT']?.vendas || 0;
                      return avg > 0 ? formatCurrency(avg) : '-';
                    })()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">-</TableCell>
                  <TableCell className="text-right tabular-nums text-sm font-bold">
                    {currAvg['TCT']?.tcs ? formatCurrency(currAvg['TCT'].tcs) : '-'}
                  </TableCell>
                  <TableCell className="text-center">
                    {(() => {
                      const val = currAvg['TCT']?.tcs || 0;
                      const prev = prevAvg['TCT']?.tcs || 0;
                      return prev > 0 && val > 0 ? <DiffBadge current={val} previous={prev} isCurrency /> : null;
                    })()}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
      </CollapsibleCard>
    </div>
  );
}
