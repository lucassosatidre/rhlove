import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Upload, AlertTriangle, Download, RefreshCw, Clock, LogOut, Coffee, Timer, TimerOff } from 'lucide-react';
import { toast } from 'sonner';
import { format, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { useCollaborators } from '@/hooks/useCollaborators';
import { usePunchRecords } from '@/hooks/usePunchRecords';
import { UpdatePunchesDialog } from '@/components/ponto/UpdatePunchesDialog';

type InconsistencyType = 'incomplete' | 'saida_pendente' | 'sem_intervalo' | 'jornada_longa' | 'jornada_curta';

interface Inconsistency {
  collaboratorId: string;
  collaboratorName: string;
  pis: string;
  date: string;
  entrada: string | null;
  saidaIntervalo: string | null;
  retornoIntervalo: string | null;
  saida: string | null;
  filledCount: number;
  types: InconsistencyType[];
  workedMinutes: number | null;
}

const TYPE_LABELS: Record<InconsistencyType, string> = {
  incomplete: 'Batidas incompletas',
  saida_pendente: 'Saída pendente',
  sem_intervalo: 'Sem intervalo',
  jornada_longa: 'Jornada > 14h',
  jornada_curta: 'Jornada < 2h',
};

const TYPE_ICONS: Record<InconsistencyType, typeof AlertTriangle> = {
  incomplete: AlertTriangle,
  saida_pendente: LogOut,
  sem_intervalo: Coffee,
  jornada_longa: Timer,
  jornada_curta: TimerOff,
};

function toMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function calcWorkedMinutes(entrada: string | null, saida: string | null, saidaInt: string | null, retornoInt: string | null): number | null {
  if (!entrada || !saida) return null;
  let entMin = toMin(entrada);
  let saiMin = toMin(saida);
  if (saiMin < 180 && entMin > saiMin) saiMin += 1440; // overnight
  let total = saiMin - entMin;
  if (saidaInt && retornoInt) {
    let siMin = toMin(saidaInt);
    let riMin = toMin(retornoInt);
    if (riMin < siMin) riMin += 1440;
    total -= (riMin - siMin);
  }
  return total > 0 ? total : 0;
}

function detectInconsistencies(record: { collaborator_id: string; collaborator_name: string; date: string; entrada: string | null; saida: string | null; saida_intervalo: string | null; retorno_intervalo: string | null; }, pis: string): Inconsistency | null {
  const { entrada, saida, saida_intervalo, retorno_intervalo } = record;
  const fields = [entrada, saida_intervalo, retorno_intervalo, saida];
  const filled = fields.filter(f => f && f !== '').length;

  if (filled === 0) return null; // no punches, not an inconsistency from import

  const types: InconsistencyType[] = [];

  // Incomplete: some fields filled, others missing (but not all 4 filled)
  if (filled > 0 && filled < 4) {
    if (entrada && !saida) {
      types.push('saida_pendente');
    } else if (entrada && saida && !saida_intervalo && !retorno_intervalo) {
      types.push('sem_intervalo');
    } else {
      types.push('incomplete');
    }
  }

  // Worked hours checks
  const worked = calcWorkedMinutes(entrada, saida, saida_intervalo, retorno_intervalo);
  if (worked !== null) {
    if (worked > 14 * 60) types.push('jornada_longa');
    if (worked < 2 * 60 && worked > 0) types.push('jornada_curta');
  }

  if (types.length === 0) return null;

  return {
    collaboratorId: record.collaborator_id,
    collaboratorName: record.collaborator_name,
    pis,
    date: record.date,
    entrada,
    saidaIntervalo: saida_intervalo,
    retornoIntervalo: retorno_intervalo,
    saida,
    filledCount: filled,
    types,
    workedMinutes: worked,
  };
}

function formatMinutesHHMM(min: number | null): string {
  if (min === null) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export default function RegistroPonto() {
  const [onlyInconsistent, setOnlyInconsistent] = useState(true);
  const [filterCollab, setFilterCollab] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const { data: collaborators = [] } = useCollaborators();
  const { data: punchRecords = [] } = usePunchRecords();

  // Build collaborator_id -> PIS map
  const collabPisMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of collaborators) {
      map[c.id] = c.pis_matricula || '';
    }
    return map;
  }, [collaborators]);

  // Analyze all punch records for inconsistencies
  const allAnalysis = useMemo(() => {
    return punchRecords.map(r => {
      const pis = collabPisMap[r.collaborator_id] || '';
      const inconsistency = detectInconsistencies(r, pis);
      return {
        record: r,
        pis,
        inconsistency,
      };
    });
  }, [punchRecords, collabPisMap]);

  const inconsistencies = useMemo(() => allAnalysis.filter(a => a.inconsistency).map(a => a.inconsistency!), [allAnalysis]);

  // Unique collaborators with records
  const uniqueCollabs = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of punchRecords) {
      if (!map.has(r.collaborator_id)) map.set(r.collaborator_id, r.collaborator_name);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [punchRecords]);

  // Items to display
  const displayItems = useMemo(() => {
    let items: Inconsistency[];
    if (onlyInconsistent) {
      items = inconsistencies;
    } else {
      // Show all records as items
      items = allAnalysis.map(a => a.inconsistency || {
        collaboratorId: a.record.collaborator_id,
        collaboratorName: a.record.collaborator_name,
        pis: a.pis,
        date: a.record.date,
        entrada: a.record.entrada,
        saidaIntervalo: a.record.saida_intervalo,
        retornoIntervalo: a.record.retorno_intervalo,
        saida: a.record.saida,
        filledCount: [a.record.entrada, a.record.saida_intervalo, a.record.retorno_intervalo, a.record.saida].filter(f => f && f !== '').length,
        types: [] as InconsistencyType[],
        workedMinutes: calcWorkedMinutes(a.record.entrada, a.record.saida, a.record.saida_intervalo, a.record.retorno_intervalo),
      });
    }

    if (filterCollab && filterCollab !== 'all') items = items.filter(i => i.collaboratorId === filterCollab);
    if (filterDateFrom) items = items.filter(i => i.date >= filterDateFrom);
    if (filterDateTo) items = items.filter(i => i.date <= filterDateTo);

    items.sort((a, b) => {
      const d = b.date.localeCompare(a.date);
      return d !== 0 ? d : a.collaboratorName.localeCompare(b.collaboratorName);
    });

    return items;
  }, [onlyInconsistent, inconsistencies, allAnalysis, filterCollab, filterDateFrom, filterDateTo]);

  const exportToExcel = useCallback(() => {
    if (displayItems.length === 0) {
      toast.warning('Nenhum dado para exportar.');
      return;
    }
    const rows = displayItems.map(s => ({
      'Colaborador': s.collaboratorName || '-',
      'PIS / Matrícula': s.pis || '-',
      'Data': format(parse(s.date, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy'),
      'Entrada': s.entrada || '—',
      'Saída Int.': s.saidaIntervalo || '—',
      'Retorno Int.': s.retornoIntervalo || '—',
      'Saída': s.saida || '—',
      'Horas Trab.': formatMinutesHHMM(s.workedMinutes),
      'Status': s.types.length > 0 ? s.types.map(t => TYPE_LABELS[t]).join(', ') : 'OK',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Registro Ponto');
    XLSX.writeFile(wb, `registro-ponto-${format(new Date(), 'yyyyMMdd-HHmm')}.xlsx`);
    toast.success('Arquivo exportado.');
  }, [displayItems]);

  const formatDate = (iso: string) => {
    try {
      return format(parse(iso, 'yyyy-MM-dd', new Date()), "dd/MM/yyyy (EEE)", { locale: ptBR });
    } catch { return iso; }
  };

  const totalRecords = punchRecords.length;
  const totalCollabs = uniqueCollabs.length;
  const totalInconsistencies = inconsistencies.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Registro de Ponto</h1>
          <p className="text-sm text-muted-foreground">Análise de inconsistências em batidas de ponto</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="default" onClick={() => setUpdateDialogOpen(true)}>
            <RefreshCw className="w-4 h-4 mr-2" /> Atualizar Batidas
          </Button>
          <Button variant="outline" onClick={exportToExcel} disabled={displayItems.length === 0}>
            <Download className="w-4 h-4 mr-2" /> Excel
          </Button>
        </div>
      </div>

      <UpdatePunchesDialog
        open={updateDialogOpen}
        onOpenChange={setUpdateDialogOpen}
        collaborators={collaborators}
      />

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total de Registros</p>
            <p className="text-2xl font-bold">{totalRecords}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Colaboradores</p>
            <p className="text-2xl font-bold">{totalCollabs}</p>
          </CardContent>
        </Card>
        <Card className={totalInconsistencies > 0 ? 'border-destructive/50 bg-destructive/5' : ''}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Inconsistências</p>
            <p className="text-2xl font-bold text-destructive">{totalInconsistencies}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Registros OK</p>
            <p className="text-2xl font-bold text-green-600">{totalRecords - totalInconsistencies}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label className="text-xs">De</Label>
              <Input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Até</Label>
              <Input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Colaborador</Label>
              <Select value={filterCollab} onValueChange={setFilterCollab}>
                <SelectTrigger className="w-52">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {uniqueCollabs.map(([id, name]) => (
                    <SelectItem key={id} value={id}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pb-0.5">
              <Switch checked={onlyInconsistent} onCheckedChange={setOnlyInconsistent} id="only-inconsistent" />
              <Label htmlFor="only-inconsistent" className="text-xs cursor-pointer">Apenas inconsistências</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            {onlyInconsistent ? 'Inconsistências Encontradas' : 'Todos os Registros'}
            <Badge variant="outline" className="ml-2">{displayItems.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {displayItems.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {totalRecords === 0
                ? <div className="space-y-2"><Upload className="w-8 h-8 mx-auto opacity-40" /><p>Importe um arquivo de ponto para começar a análise.</p></div>
                : <p>{onlyInconsistent ? 'Nenhuma inconsistência encontrada!' : 'Nenhum registro encontrado com os filtros atuais.'}</p>
              }
            </div>
          ) : (
            <div className="overflow-auto max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Entrada</TableHead>
                    <TableHead>Saída Int.</TableHead>
                    <TableHead>Ret. Int.</TableHead>
                    <TableHead>Saída</TableHead>
                    <TableHead>Horas</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayItems.map((s, i) => (
                    <TableRow key={`${s.collaboratorId}-${s.date}-${i}`}>
                      <TableCell className="text-sm font-medium">{s.collaboratorName}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{formatDate(s.date)}</TableCell>
                      <TableCell className="text-xs font-mono">{s.entrada || '—'}</TableCell>
                      <TableCell className="text-xs font-mono">{s.saidaIntervalo || '—'}</TableCell>
                      <TableCell className="text-xs font-mono">{s.retornoIntervalo || '—'}</TableCell>
                      <TableCell className="text-xs font-mono">{s.saida || '—'}</TableCell>
                      <TableCell className="text-xs font-mono">{formatMinutesHHMM(s.workedMinutes)}</TableCell>
                      <TableCell>
                        {s.types.length > 0 ? (
                          <div className="flex flex-col gap-0.5">
                            {s.types.map(t => {
                              const Icon = TYPE_ICONS[t];
                              return (
                                <Badge key={t} variant="destructive" className="text-[10px] w-fit">
                                  <Icon className="w-3 h-3 mr-1" /> {TYPE_LABELS[t]}
                                </Badge>
                              );
                            })}
                          </div>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">OK</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
