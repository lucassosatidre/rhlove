import { useState, useMemo, useRef } from 'react';
import { useCollaborators } from '@/hooks/useCollaborators';
import { generateSchedule, getMonthLabel, type ScheduleWeek } from '@/lib/scheduleEngine';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ChevronLeft, ChevronRight, Download, Printer } from 'lucide-react';
import * as XLSX from 'xlsx';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export default function Escala() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [compact, setCompact] = useState(false);
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg'>('sm');
  const [showSectorTitles, setShowSectorTitles] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState(0);
  const printRef = useRef<HTMLDivElement>(null);

  const { data: collaborators = [] } = useCollaborators();

  const weeks = useMemo(
    () => generateSchedule(collaborators, year, month),
    [collaborators, year, month]
  );

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

      for (const sector of [...allSectors].sort()) {
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
      for (const sector of [...allSectors].sort()) {
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

  const SECTOR_ORDER = ['COZINHA', 'DIURNO', 'SALÃO', 'TELE - ENTREGA'];

  const DAY_HEADERS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

  const formatDateBR = (d: Date) =>
    `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

  const renderWeek = (week: ScheduleWeek) => {
    const allSectors = new Set<string>();
    week.days.forEach(d => Object.keys(d.collaboratorsBySector).forEach(s => allSectors.add(s)));
    const sortedSectors = SECTOR_ORDER.filter(s => allSectors.has(s));
    // Add any sectors not in the predefined order
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
                      className={`border border-border ${compact ? 'px-2 py-1' : 'px-3 py-2'} text-left font-bold bg-secondary text-secondary-foreground uppercase tracking-wide`}
                    >
                      {sectorPeriod}
                    </th>
                  </tr>
                  <tr>
                    {DAY_HEADERS.map((day, i) => (
                      <th
                        key={day}
                        className={`border border-border px-2 ${compact ? 'py-1' : 'py-2'} text-center font-semibold bg-muted ${
                          i === 6 ? 'bg-accent text-accent-foreground' : ''
                        }`}
                        style={{ minWidth: '110px' }}
                      >
                        {day}
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
                            key={d.label}
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
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Semana {i + 1}</CardTitle>
                </CardHeader>
                <CardContent className="p-2">{renderWeek(week)}</CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="grid">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {weeks.map((week, i) => (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs">Semana {i + 1}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-1">{renderWeek(week)}</CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
