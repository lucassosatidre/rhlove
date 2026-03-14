import { useState, useMemo, useRef } from 'react';
import { useCollaborators } from '@/hooks/useCollaborators';
import { useFreelancers } from '@/hooks/useFreelancers';
import { useDailySales } from '@/hooks/useDailySales';
import { useScheduledVacations } from '@/hooks/useScheduledVacations';
import { generateSchedule, getMonthLabel, type ScheduleWeek } from '@/lib/scheduleEngine';
import { countPeopleBySectorOnDate } from '@/lib/productivityEngine';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ChevronLeft, ChevronRight, Download, Printer, Users } from 'lucide-react';
import FreesDialog from '@/components/FreesDialog';
import * as XLSX from 'xlsx';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const DAY_NAMES = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

export default function Escala() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [compact, setCompact] = useState(false);
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg'>('sm');
  const [showSectorTitles, setShowSectorTitles] = useState(true);
  const [showPerformance, setShowPerformance] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(0);
  const [freesDialogOpen, setFreesDialogOpen] = useState(false);
  const [freesWeekIdx, setFreesWeekIdx] = useState(0);
  const printRef = useRef<HTMLDivElement>(null);

  const { data: collaborators = [] } = useCollaborators();
  const { data: scheduledVacations = [] } = useScheduledVacations();

  const weeks = useMemo(
    () => generateSchedule(collaborators, year, month, scheduledVacations),
    [collaborators, year, month, scheduledVacations]
  );

  // Compute date range for data queries
  const dateRange = useMemo(() => {
    if (weeks.length === 0) return { start: '', end: '' };
    const first = weeks[0].days[0].date;
    const last = weeks[weeks.length - 1].days[6].date;
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { start: fmt(first), end: fmt(last) };
  }, [weeks]);

  const { data: freelancers = [] } = useFreelancers(dateRange.start, dateRange.end);
  const { data: salesData = [] } = useDailySales(dateRange.start, dateRange.end);

  // Build lookup maps
  const freelancerMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const f of freelancers) {
      map[`${f.date}|${f.sector}`] = f.quantity;
    }
    return map;
  }, [freelancers]);

  const salesMap = useMemo(() => {
    const map: Record<string, typeof salesData[0]> = {};
    for (const s of salesData) {
      map[s.date] = s;
    }
    return map;
  }, [salesData]);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const textSize = fontSize === 'sm' ? 'text-xs' : fontSize === 'base' ? 'text-sm' : 'text-base';

  const handlePrint = () => window.print();

  const handleExport = () => {
    const wb = XLSX.utils.book_new();

    weeks.forEach((week, i) => {
      const rows: Record<string, string>[] = [];
      const allSectors = new Set<string>();
      week.days.forEach(d => Object.keys(d.collaboratorsBySector).forEach(s => allSectors.add(s)));

      for (const sector of ['COZINHA', 'SALÃO', 'TELE - ENTREGA', 'DIURNO'].filter(s => allSectors.has(s)).concat([...allSectors].filter(s => !['COZINHA', 'SALÃO', 'TELE - ENTREGA', 'DIURNO'].includes(s)).sort())) {
        rows.push({ '': `--- ${sector} ---` });
        const maxNames = Math.max(...week.days.map(d => (d.collaboratorsBySector[sector] || []).length), 0);
        for (let n = 0; n < maxNames; n++) {
          const row: Record<string, string> = {};
          week.days.forEach(d => {
            row[d.label] = (d.collaboratorsBySector[sector] || [])[n] || '';
          });
          rows.push(row);
        }
      }

      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, `Semana ${i + 1}`);
    });

    const allRows: Record<string, string>[] = [];
    weeks.forEach((week, i) => {
      allRows.push({ '': `=== SEMANA ${i + 1} ===` });
      const allSectors = new Set<string>();
      week.days.forEach(d => Object.keys(d.collaboratorsBySector).forEach(s => allSectors.add(s)));
      for (const sector of ['COZINHA', 'SALÃO', 'TELE - ENTREGA', 'DIURNO'].filter(s => allSectors.has(s)).concat([...allSectors].filter(s => !['COZINHA', 'SALÃO', 'TELE - ENTREGA', 'DIURNO'].includes(s)).sort())) {
        allRows.push({ '': `--- ${sector} ---` });
        const maxNames = Math.max(...week.days.map(d => (d.collaboratorsBySector[sector] || []).length), 0);
        for (let n = 0; n < maxNames; n++) {
          const row: Record<string, string> = {};
          week.days.forEach(d => {
            row[d.label] = (d.collaboratorsBySector[sector] || [])[n] || '';
          });
          allRows.push(row);
        }
      }
      allRows.push({ '': '' });
    });
    const wsAll = XLSX.utils.json_to_sheet(allRows);
    XLSX.utils.book_append_sheet(wb, wsAll, 'Consolidado');

    XLSX.writeFile(wb, `Escala_${MONTHS[month]}_${year}.xlsx`);
  };

  const isAlertName = (name: string) =>
    name.includes('(EXPERIÊNCIA VENCENDO)') || name.includes('(AVISO TERMINANDO)');

  const SECTOR_ORDER = ['COZINHA', 'SALÃO', 'TELE - ENTREGA', 'DIURNO'];

  const SECTOR_HEADER_CLASSES: Record<string, string> = {
    'COZINHA': 'bg-sector-cozinha text-white',
    'SALÃO': 'bg-sector-salao text-white',
    'TELE - ENTREGA': 'bg-sector-tele text-white',
    'DIURNO': 'bg-sector-diurno text-white',
  };

  const formatDateBR = (d: Date) =>
    `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

  const formatDateKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const getSectorSales = (sale: typeof salesData[0] | undefined, sector: string) => {
    if (!sale) return { vendas: 0, pedidos: 0 };
    const ft = Number(sale.faturamento_total) || 0;
    const pt = Number(sale.pedidos_totais) || 0;
    const fs = Number(sale.faturamento_salao) || 0;
    const ps = Number(sale.pedidos_salao) || 0;
    const fte = Number(sale.faturamento_tele) || 0;
    const pte = Number(sale.pedidos_tele) || 0;

    switch (sector) {
      case 'COZINHA': return { vendas: ft, pedidos: pt };
      case 'DIURNO': return { vendas: ft, pedidos: pt };
      case 'SALÃO': return { vendas: fs, pedidos: ps };
      case 'TELE - ENTREGA': return { vendas: fte, pedidos: pte };
      default: return { vendas: 0, pedidos: 0 };
    }
  };

  const formatNum = (v: number) =>
    v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const renderWeek = (week: ScheduleWeek) => {
    const allSectors = new Set<string>();
    week.days.forEach(d => Object.keys(d.collaboratorsBySector).forEach(s => allSectors.add(s)));
    const sortedSectors = SECTOR_ORDER.filter(s => allSectors.has(s));
    [...allSectors].sort().forEach(s => {
      if (!sortedSectors.includes(s)) sortedSectors.push(s);
    });

    const firstDate = week.days[0]?.date;
    const lastDate = week.days[week.days.length - 1]?.date;

    return (
      <div className="space-y-4">
        {sortedSectors.map(sector => {
          const maxNames = Math.max(
            ...week.days.map(d => (d.collaboratorsBySector[sector] || []).length),
            0
          );
          if (maxNames === 0) return null;

          const sectorPeriod = firstDate && lastDate
            ? `${sector} ${formatDateBR(firstDate)} à ${formatDateBR(lastDate)}`
            : sector;

          return (
            <div key={sector} className="overflow-x-auto">
              <table className={`w-full border-collapse ${textSize}`}>
                <thead>
                  <tr>
                    <th
                      colSpan={7}
                      className={`border border-border ${compact ? 'px-2 py-1' : 'px-3 py-2'} text-left font-bold uppercase tracking-wide ${SECTOR_HEADER_CLASSES[sector] || 'bg-secondary text-secondary-foreground'}`}
                    >
                      {sectorPeriod}
                    </th>
                  </tr>
                  <tr>
                    {week.days.map((d, i) => (
                      <th
                        key={i}
                        className={`border border-border px-2 ${compact ? 'py-1' : 'py-2'} text-center font-semibold bg-muted ${
                          i === 6 ? 'bg-accent text-accent-foreground' : ''
                        }`}
                        style={{ minWidth: '110px' }}
                      >
                        {DAY_NAMES[i]} {formatDateBR(d.date)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: maxNames }, (_, idx) => (
                    <tr key={idx}>
                      {week.days.map((d, di) => {
                        const names = d.collaboratorsBySector[sector] || [];
                        const name = names[idx] || '';
                        const hasAlert = name ? isAlertName(name) : false;
                        const numbered = name ? `${idx + 1} - ${name}` : '';
                        return (
                          <td
                            key={di}
                            className={`border border-border px-2 ${compact ? 'py-0.5' : 'py-1'} text-left ${
                              di === 6 ? 'bg-accent/30' : ''
                            } ${hasAlert ? 'bg-warning/20 font-semibold' : ''}`}
                          >
                            {hasAlert ? (
                              <span className="text-amber-700 dark:text-amber-400">{numbered}</span>
                            ) : numbered}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {/* Performance summary rows */}
                  {showPerformance && (
                    <>
                      <tr>
                        {week.days.map((d, di) => {
                          const dateKey = formatDateKey(d.date);
                          const frees = freelancerMap[`${dateKey}|${sector}`] || 0;
                          return (
                            <td key={di} className={`border border-border px-2 py-0.5 text-left text-[10px] text-muted-foreground ${di === 6 ? 'bg-accent/30' : ''}`}>
                              Frees: {frees}
                            </td>
                          );
                        })}
                      </tr>
                      <tr>
                        {week.days.map((d, di) => {
                          const dateKey = formatDateKey(d.date);
                          const scheduled = countPeopleBySectorOnDate(collaborators, sector, d.date, scheduledVacations);
                          const frees = freelancerMap[`${dateKey}|${sector}`] || 0;
                          const total = scheduled + frees;
                          return (
                            <td key={di} className={`border border-border px-2 py-0.5 text-left text-[10px] text-muted-foreground ${di === 6 ? 'bg-accent/30' : ''}`}>
                              Total: {total}
                            </td>
                          );
                        })}
                      </tr>
                      <tr>
                        {week.days.map((d, di) => {
                          const dateKey = formatDateKey(d.date);
                          const sale = salesMap[dateKey];
                          if (!sale) {
                            return <td key={di} className={`border border-border px-2 py-0.5 text-left text-[10px] text-muted-foreground ${di === 6 ? 'bg-accent/30' : ''}`}>TCS: -</td>;
                          }
                          const scheduled = countPeopleBySectorOnDate(collaborators, sector, d.date, scheduledVacations);
                          const frees = freelancerMap[`${dateKey}|${sector}`] || 0;
                          const total = scheduled + frees;
                          const { vendas } = getSectorSales(sale, sector);
                          const tmp = total > 0 ? vendas / total : 0;
                          return (
                            <td key={di} className={`border border-border px-2 py-0.5 text-left text-[10px] text-muted-foreground ${di === 6 ? 'bg-accent/30' : ''}`}>
                              TCS: {tmp > 0 ? formatNum(tmp) : '-'}
                            </td>
                          );
                        })}
                      </tr>
                      <tr>
                        {week.days.map((d, di) => {
                          const dateKey = formatDateKey(d.date);
                          const sale = salesMap[dateKey];
                          if (!sale) {
                            return <td key={di} className={`border border-border px-2 py-0.5 text-left text-[10px] text-muted-foreground ${di === 6 ? 'bg-accent/30' : ''}`}>PCS: -</td>;
                          }
                          const scheduled = countPeopleBySectorOnDate(collaborators, sector, d.date, scheduledVacations);
                          const frees = freelancerMap[`${dateKey}|${sector}`] || 0;
                          const total = scheduled + frees;
                          const { pedidos } = getSectorSales(sale, sector);
                          const ppp = total > 0 ? pedidos / total : 0;
                          return (
                            <td key={di} className={`border border-border px-2 py-0.5 text-left text-[10px] text-muted-foreground ${di === 6 ? 'bg-accent/30' : ''}`}>
                              PCS: {ppp > 0 ? formatNum(ppp) : '-'}
                            </td>
                          );
                        })}
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4 animate-fade-in" ref={printRef}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 no-print">
        <div>
          <h1 className="text-2xl font-bold">Escala de Trabalho</h1>
          <p className="text-sm text-muted-foreground capitalize">{getMonthLabel(year, month)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth}><ChevronLeft className="w-4 h-4" /></Button>
          <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
            <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[year - 1, year, year + 1].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={nextMonth}><ChevronRight className="w-4 h-4" /></Button>
        </div>
      </div>

      <Card className="no-print">
        <CardContent className="py-3 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Label className="text-xs">Compacto</Label>
            <Switch checked={compact} onCheckedChange={setCompact} />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs">Setores</Label>
            <Switch checked={showSectorTitles} onCheckedChange={setShowSectorTitles} />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs">Desempenho</Label>
            <Switch checked={showPerformance} onCheckedChange={setShowPerformance} />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs">Fonte</Label>
            <Select value={fontSize} onValueChange={v => setFontSize(v as any)}>
              <SelectTrigger className="w-20 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sm">P</SelectItem>
                <SelectItem value="base">M</SelectItem>
                <SelectItem value="lg">G</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="w-4 h-4 mr-1" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-1" /> Imprimir
            </Button>
          </div>
        </CardContent>
      </Card>

      {collaborators.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum colaborador cadastrado. Vá em <strong>Colaboradores</strong> para adicionar.
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="week" className="w-full">
          <TabsList className="no-print">
            <TabsTrigger value="week">Semana</TabsTrigger>
            <TabsTrigger value="4weeks">4 Semanas</TabsTrigger>
            <TabsTrigger value="grid">Grade 2×2</TabsTrigger>
          </TabsList>

          <TabsContent value="week">
            <div className="flex items-center gap-2 mb-3 no-print">
              {weeks.map((_, i) => (
                <Button
                  key={i}
                  variant={selectedWeek === i ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedWeek(i)}
                >
                  Semana {i + 1}
                </Button>
              ))}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => { setFreesWeekIdx(selectedWeek); setFreesDialogOpen(true); }}
              >
                <Users className="w-4 h-4 mr-1" /> FREES
              </Button>
            </div>
            {weeks[selectedWeek] && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">
                    Semana {selectedWeek + 1} — {weeks[selectedWeek].days[0].label}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-2">{renderWeek(weeks[selectedWeek])}</CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="4weeks" className="space-y-4">
            {weeks.map((week, i) => (
              <Card key={i}>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm">Semana {i + 1}</CardTitle>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="no-print"
                    onClick={() => { setFreesWeekIdx(i); setFreesDialogOpen(true); }}
                  >
                    <Users className="w-4 h-4 mr-1" /> FREES
                  </Button>
                </CardHeader>
                <CardContent className="p-2">{renderWeek(week)}</CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="grid">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {weeks.map((week, i) => (
                <Card key={i}>
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-xs">Semana {i + 1}</CardTitle>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="no-print h-7 text-xs"
                      onClick={() => { setFreesWeekIdx(i); setFreesDialogOpen(true); }}
                    >
                      <Users className="w-3 h-3 mr-1" /> FREES
                    </Button>
                  </CardHeader>
                  <CardContent className="p-1">{renderWeek(week)}</CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      )}

      {weeks[freesWeekIdx] && (
        <FreesDialog
          open={freesDialogOpen}
          onOpenChange={setFreesDialogOpen}
          weekStartDate={weeks[freesWeekIdx].days[0].date}
          weekEndDate={weeks[freesWeekIdx].days[weeks[freesWeekIdx].days.length - 1].date}
        />
      )}
    </div>
  );
}
