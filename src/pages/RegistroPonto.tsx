import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Upload, FileText, AlertTriangle, Download, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { useCollaborators } from '@/hooks/useCollaborators';

interface PunchRecord {
  pis: string;
  date: string;
  time: string;
}

interface DaySummary {
  pis: string;
  collaboratorName: string;
  date: string;
  totalPunches: number;
  punches: string[];
  isOdd: boolean;
}

interface ImportSession {
  id: string;
  fileName: string;
  importedAt: string;
  records: PunchRecord[];
}

const STORAGE_KEY = 'estrela-rh-punch-imports';

function loadSessions(): ImportSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveSessions(sessions: ImportSession[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

function parseAFDLine(line: string): PunchRecord | null {
  if (line.length < 34) return null;
  const type = line.charAt(9);
  if (type !== '3') return null;

  const dateStr = line.substring(10, 18);
  const timeStr = line.substring(18, 22);
  const pis = line.substring(22, 34).trim();

  const day = dateStr.substring(0, 2);
  const month = dateStr.substring(2, 4);
  const year = dateStr.substring(4, 8);
  const isoDate = `${year}-${month}-${day}`;

  const hour = timeStr.substring(0, 2);
  const min = timeStr.substring(2, 4);
  const formattedTime = `${hour}:${min}`;

  if (!pis || isNaN(parseInt(day)) || isNaN(parseInt(month))) return null;

  return { pis, date: isoDate, time: formattedTime };
}

function processRecords(records: PunchRecord[], pisToName: Record<string, string>): DaySummary[] {
  const grouped: Record<string, PunchRecord[]> = {};

  for (const r of records) {
    const key = `${r.pis}|${r.date}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  }

  const summaries: DaySummary[] = [];
  for (const [key, recs] of Object.entries(grouped)) {
    const [pis, date] = key.split('|');
    const punches = recs.map(r => r.time).sort();
    summaries.push({
      pis,
      collaboratorName: pisToName[pis] || '',
      date,
      totalPunches: punches.length,
      punches,
      isOdd: punches.length % 2 !== 0,
    });
  }

  summaries.sort((a, b) => {
    const dateCmp = b.date.localeCompare(a.date);
    if (dateCmp !== 0) return dateCmp;
    const nameA = a.collaboratorName || a.pis;
    const nameB = b.collaboratorName || b.pis;
    return nameA.localeCompare(nameB);
  });

  return summaries;
}

export default function RegistroPonto() {
  const [sessions, setSessions] = useState<ImportSession[]>(loadSessions);
  const [onlyOdd, setOnlyOdd] = useState(true);
  const [filterPis, setFilterPis] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const { data: collaborators = [] } = useCollaborators();

  // Build PIS -> Name map from collaborators (normalize to 12 digits with leading zeros)
  const pisToName = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of collaborators) {
      if (c.pis_matricula) {
        // Store both original and zero-padded versions for matching
        map[c.pis_matricula] = c.collaborator_name;
        map[c.pis_matricula.padStart(12, '0')] = c.collaborator_name;
      }
    }
    return map;
  }, [collaborators]);

  const allRecords = useMemo(() => sessions.flatMap(s => s.records), [sessions]);

  const summaries = useMemo(() => processRecords(allRecords, pisToName), [allRecords, pisToName]);

  const uniquePis = useMemo(() => {
    const set = new Set(summaries.map(s => s.pis));
    return Array.from(set).sort();
  }, [summaries]);

  const filtered = useMemo(() => {
    let result = summaries;
    if (onlyOdd) result = result.filter(s => s.isOdd);
    if (filterPis && filterPis !== 'all') result = result.filter(s => s.pis === filterPis);
    if (filterDateFrom) result = result.filter(s => s.date >= filterDateFrom);
    if (filterDateTo) result = result.filter(s => s.date <= filterDateTo);
    return result;
  }, [summaries, onlyOdd, filterPis, filterDateFrom, filterDateTo]);

  const handleFileImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const lines = text.split(/\r?\n/);
      const records: PunchRecord[] = [];

      for (const line of lines) {
        const record = parseAFDLine(line);
        if (record) records.push(record);
      }

      if (records.length === 0) {
        toast.error('Nenhum registro de batida encontrado no arquivo.');
        return;
      }

      const newSession: ImportSession = {
        id: crypto.randomUUID(),
        fileName: file.name,
        importedAt: new Date().toISOString(),
        records,
      };

      const updated = [newSession, ...sessions];
      setSessions(updated);
      saveSessions(updated);

      const oddCount = processRecords(records, pisToName).filter(s => s.isOdd).length;
      toast.success(`${records.length} batidas importadas. ${oddCount} inconsistência(s) encontrada(s).`);
    };
    reader.readAsText(file, 'latin1');
    e.target.value = '';
  }, [sessions, pisToName]);

  const clearAllSessions = useCallback(() => {
    setSessions([]);
    saveSessions([]);
    toast.info('Histórico de importações limpo.');
  }, []);

  const removeSession = useCallback((id: string) => {
    const updated = sessions.filter(s => s.id !== id);
    setSessions(updated);
    saveSessions(updated);
    toast.info('Importação removida.');
  }, [sessions]);

  const exportToExcel = useCallback(() => {
    if (filtered.length === 0) {
      toast.warning('Nenhum dado para exportar.');
      return;
    }
    const rows = filtered.map(s => ({
      'Colaborador': s.collaboratorName || '-',
      'PIS / Matrícula': s.pis,
      'Data': format(parse(s.date, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy'),
      'Total Batidas': s.totalPunches,
      'Horários': s.punches.join(', '),
      'Status': s.isOdd ? 'Batidas ímpares' : 'OK',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Registro Ponto');
    XLSX.writeFile(wb, `registro-ponto-${format(new Date(), 'yyyyMMdd-HHmm')}.xlsx`);
    toast.success('Arquivo exportado.');
  }, [filtered]);

  const formatDate = (iso: string) => {
    try {
      return format(parse(iso, 'yyyy-MM-dd', new Date()), "dd/MM/yyyy (EEEE)", { locale: ptBR });
    } catch { return iso; }
  };

  const oddTotal = summaries.filter(s => s.isOdd).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Registro de Ponto</h1>
          <p className="text-sm text-muted-foreground">Análise de inconsistências em batidas de ponto</p>
        </div>
        <div className="flex items-center gap-2">
          <DropZone
            inline
            accept=".txt,.csv,.afdt,.afd"
            onFiles={(files) => {
              const synth = { target: { files, value: '' } } as unknown as React.ChangeEvent<HTMLInputElement>;
              handleFileImport(synth);
            }}
          >
            <label className="cursor-pointer">
              <input type="file" accept=".txt,.csv,.afdt,.afd" className="hidden" onChange={handleFileImport} />
              <Button asChild variant="default">
                <span><Upload className="w-4 h-4 mr-2" /> Importar Arquivo</span>
              </Button>
            </label>
          </DropZone>
          <Button variant="outline" onClick={exportToExcel} disabled={filtered.length === 0}>
            <Download className="w-4 h-4 mr-2" /> Excel
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Importações</p>
            <p className="text-2xl font-bold">{sessions.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total de Batidas</p>
            <p className="text-2xl font-bold">{allRecords.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Colaboradores (PIS)</p>
            <p className="text-2xl font-bold">{uniquePis.length}</p>
          </CardContent>
        </Card>
        <Card className={oddTotal > 0 ? 'border-destructive/50 bg-destructive/5' : ''}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Inconsistências</p>
            <p className="text-2xl font-bold text-destructive">{oddTotal}</p>
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
              <Label className="text-xs">Colaborador (PIS)</Label>
              <Select value={filterPis} onValueChange={setFilterPis}>
                <SelectTrigger className="w-52">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {uniquePis.map(p => (
                    <SelectItem key={p} value={p}>{pisToName[p] ? `${pisToName[p]} (${p})` : p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pb-0.5">
              <Switch checked={onlyOdd} onCheckedChange={setOnlyOdd} id="only-odd" />
              <Label htmlFor="only-odd" className="text-xs cursor-pointer">Apenas inconsistências</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Import history */}
      {sessions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Histórico de Importações</CardTitle>
              <Button variant="ghost" size="sm" onClick={clearAllSessions} className="text-xs text-destructive hover:text-destructive">
                <Trash2 className="w-3 h-3 mr-1" /> Limpar tudo
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex flex-wrap gap-2">
              {sessions.map(s => (
                <Badge key={s.id} variant="secondary" className="gap-1.5 pr-1">
                  <FileText className="w-3 h-3" />
                  {s.fileName}
                  <span className="text-[10px] text-muted-foreground ml-1">
                    ({s.records.length} bat.)
                  </span>
                  <button onClick={() => removeSession(s.id)} className="ml-1 p-0.5 rounded hover:bg-destructive/20">
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            {onlyOdd ? 'Inconsistências Encontradas' : 'Todos os Registros'}
            <Badge variant="outline" className="ml-2">{filtered.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {allRecords.length === 0
                ? <div className="space-y-2"><Upload className="w-8 h-8 mx-auto opacity-40" /><p>Importe um arquivo de ponto para começar a análise.</p></div>
                : <p>Nenhuma inconsistência encontrada com os filtros atuais.</p>
              }
            </div>
          ) : (
            <div className="overflow-auto max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>PIS / Matrícula</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-center">Batidas</TableHead>
                    <TableHead>Horários</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s, i) => (
                    <TableRow key={`${s.pis}-${s.date}-${i}`}>
                      <TableCell className="text-sm font-medium">
                        {s.collaboratorName || <span className="text-muted-foreground italic">Não vinculado</span>}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{s.pis}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{formatDate(s.date)}</TableCell>
                      <TableCell className="text-center font-bold">{s.totalPunches}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{s.punches.join(', ')}</TableCell>
                      <TableCell>
                        {s.isOdd ? (
                          <Badge variant="destructive" className="text-[10px]">
                            <AlertTriangle className="w-3 h-3 mr-1" /> Batidas ímpares
                          </Badge>
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
