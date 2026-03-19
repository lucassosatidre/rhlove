import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, CheckCircle, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import type { Collaborator } from '@/types/collaborator';
import { useUpsertPunchRecords, type PunchRecordUpsert } from '@/hooks/usePunchRecords';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  collaborators: Collaborator[];
}

interface ParsedRow {
  rowIndex: number;
  pis: string;
  date: string;
  entrada: string;
  saida: string;
  saidaIntervalo: string;
  retornoIntervalo: string;
  collaborator?: Collaborator;
  error?: string;
}

function normalizeTime(val: any): string {
  if (!val) return '';
  if (typeof val === 'number') {
    // Excel serial time fraction
    const totalMinutes = Math.round(val * 24 * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  const s = String(val).trim();
  const match = s.match(/(\d{1,2}):(\d{2})/);
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : s;
}

function normalizeDate(val: any): string {
  if (!val) return '';
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof val === 'number') {
    // Excel serial date
    const d = new Date((val - 25569) * 86400 * 1000);
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return `${y}-${mo}-${da}`;
  }
  const s = String(val).trim();
  // dd/mm/yyyy
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return s;
}

function findPisColumn(headers: string[]): number {
  const keywords = ['pis', 'matricula', 'matrícula', 'registro'];
  return headers.findIndex(h => keywords.some(k => h.toLowerCase().includes(k)));
}

function findDateColumn(headers: string[]): number {
  const keywords = ['data', 'date', 'dia'];
  return headers.findIndex(h => keywords.some(k => h.toLowerCase().includes(k)));
}

function findTimeColumn(headers: string[], keywords: string[]): number {
  return headers.findIndex(h => keywords.some(k => h.toLowerCase().includes(k)));
}

export function ExcelPunchImportDialog({ open, onOpenChange, collaborators }: Props) {
  const [parsed, setParsed] = useState<ParsedRow[] | null>(null);
  const [fileName, setFileName] = useState('');
  const upsert = useUpsertPunchRecords();

  const pisMap = new Map<string, Collaborator>();
  for (const c of collaborators) {
    if (c.pis_matricula) {
      pisMap.set(c.pis_matricula, c);
      pisMap.set(c.pis_matricula.padStart(12, '0'), c);
    }
  }

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'array', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        if (raw.length < 2) {
          toast.error('Arquivo vazio ou sem dados.');
          return;
        }

        const headers = raw[0].map((h: any) => String(h));
        const pisCol = findPisColumn(headers);
        const dateCol = findDateColumn(headers);
        const entradaCol = findTimeColumn(headers, ['entrada', 'entry', 'ent']);
        const saidaCol = findTimeColumn(headers, ['saída', 'saida', 'exit', 'sai']);
        const saidaIntCol = findTimeColumn(headers, ['saída int', 'saida int', 'saída interv', 'saida interv', 'início interv', 'inicio interv', 'ini. int']);
        const retornoIntCol = findTimeColumn(headers, ['retorno int', 'ret. int', 'retorno interv', 'fim interv', 'volta int']);

        if (pisCol === -1 || dateCol === -1) {
          toast.error('Não foi possível identificar as colunas PIS/Matrícula e Data no arquivo.');
          return;
        }

        const rows: ParsedRow[] = [];
        for (let i = 1; i < raw.length; i++) {
          const row = raw[i];
          const pisVal = String(row[pisCol] ?? '').trim();
          if (!pisVal) continue;

          const date = normalizeDate(row[dateCol]);
          if (!date) continue;

          const entrada = entradaCol >= 0 ? normalizeTime(row[entradaCol]) : '';
          const saida = saidaCol >= 0 ? normalizeTime(row[saidaCol]) : '';
          const saidaIntervalo = saidaIntCol >= 0 ? normalizeTime(row[saidaIntCol]) : '';
          const retornoIntervalo = retornoIntCol >= 0 ? normalizeTime(row[retornoIntCol]) : '';

          const collab = pisMap.get(pisVal) || pisMap.get(pisVal.padStart(12, '0'));

          rows.push({
            rowIndex: i + 1,
            pis: pisVal,
            date,
            entrada,
            saida,
            saidaIntervalo,
            retornoIntervalo,
            collaborator: collab,
            error: collab ? undefined : 'PIS/Matrícula não encontrado',
          });
        }

        setParsed(rows);
        setFileName(file.name);
      } catch {
        toast.error('Erro ao ler o arquivo.');
      }
    };
    reader.readAsArrayBuffer(file);
  }, [pisMap]);

  const validRows = parsed?.filter(r => !r.error) ?? [];
  const errorRows = parsed?.filter(r => !!r.error) ?? [];

  const handleImport = useCallback(async () => {
    if (!validRows.length) return;

    const records: PunchRecordUpsert[] = validRows.map(r => ({
      collaborator_id: r.collaborator!.id,
      collaborator_name: r.collaborator!.collaborator_name,
      date: r.date,
      entrada: r.entrada || null,
      saida: r.saida || null,
      saida_intervalo: r.saidaIntervalo || null,
      retorno_intervalo: r.retornoIntervalo || null,
    }));

    try {
      await upsert.mutateAsync(records);
      toast.success(`✅ ${validRows.length} registros importados` + (errorRows.length ? ` · ⚠️ ${errorRows.length} linhas ignoradas` : ''));
      onOpenChange(false);
      setParsed(null);
    } catch {
      toast.error('Erro ao salvar registros.');
    }
  }, [validRows, errorRows, upsert, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setParsed(null); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" /> Importar Ponto (.xlsx)
          </DialogTitle>
        </DialogHeader>

        {!parsed ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <p className="text-sm text-muted-foreground text-center">
              Selecione um arquivo Excel com colunas: PIS/Matrícula, Data, Entrada, Saída, Saída Intervalo, Retorno Intervalo
            </p>
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = '';
                }}
              />
              <Button asChild variant="default">
                <span><Upload className="w-4 h-4 mr-2" /> Selecionar Arquivo</span>
              </Button>
            </label>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="secondary">{fileName}</Badge>
              <Badge variant="default" className="bg-green-600">
                <CheckCircle className="w-3 h-3 mr-1" /> {validRows.length} válidos
              </Badge>
              {errorRows.length > 0 && (
                <Badge variant="destructive">
                  <AlertTriangle className="w-3 h-3 mr-1" /> {errorRows.length} ignorados
                </Badge>
              )}
            </div>

            {errorRows.length > 0 && (
              <div className="border border-destructive/30 rounded-md p-3 bg-destructive/5">
                <p className="text-xs font-medium text-destructive mb-2">Linhas ignoradas:</p>
                <div className="max-h-32 overflow-auto text-xs space-y-1">
                  {errorRows.map(r => (
                    <div key={r.rowIndex} className="flex gap-2">
                      <span className="text-muted-foreground">Linha {r.rowIndex}:</span>
                      <span>PIS {r.pis}</span>
                      <span className="text-destructive">— {r.error}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {validRows.length > 0 && (
              <div className="overflow-auto max-h-[300px] border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Colaborador</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Entrada</TableHead>
                      <TableHead>Saída Int.</TableHead>
                      <TableHead>Retorno Int.</TableHead>
                      <TableHead>Saída</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {validRows.slice(0, 50).map(r => (
                      <TableRow key={`${r.pis}-${r.date}`}>
                        <TableCell className="text-sm">{r.collaborator?.collaborator_name}</TableCell>
                        <TableCell className="text-xs">{r.date}</TableCell>
                        <TableCell className="text-xs">{r.entrada}</TableCell>
                        <TableCell className="text-xs">{r.saidaIntervalo}</TableCell>
                        <TableCell className="text-xs">{r.retornoIntervalo}</TableCell>
                        <TableCell className="text-xs">{r.saida}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setParsed(null); }}>Cancelar</Button>
              <Button onClick={handleImport} disabled={validRows.length === 0 || upsert.isPending}>
                {upsert.isPending ? 'Importando...' : `Importar ${validRows.length} registros`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
