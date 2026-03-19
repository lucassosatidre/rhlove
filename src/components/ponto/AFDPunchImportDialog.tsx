import { useState, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, CheckCircle, AlertTriangle, FileText } from 'lucide-react';
import { toast } from 'sonner';
import type { Collaborator } from '@/types/collaborator';
import { useUpsertPunchRecords, type PunchRecordUpsert } from '@/hooks/usePunchRecords';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  collaborators: Collaborator[];
}

interface ParsedDay {
  pis: string;
  date: string;
  punches: string[];
  collaborator?: Collaborator;
  error?: string;
}

function parseAFDLines(text: string): { pis: string; date: string; time: string }[] {
  const lines = text.split(/\r?\n/);
  const records: { pis: string; date: string; time: string }[] = [];

  for (const line of lines) {
    if (line.length < 34) continue;
    const firstChar = line.charAt(0);
    if (firstChar === '1' || firstChar === '9') continue; // header/footer

    const type = line.charAt(9);
    if (type !== '3') continue;

    const dateStr = line.substring(10, 18);
    const timeStr = line.substring(18, 22);
    const pis = line.substring(23, 34).trim();

    const day = dateStr.substring(0, 2);
    const month = dateStr.substring(2, 4);
    const year = dateStr.substring(4, 8);

    if (!pis || isNaN(parseInt(day)) || isNaN(parseInt(month))) continue;

    records.push({
      pis,
      date: `${year}-${month}-${day}`,
      time: `${timeStr.substring(0, 2)}:${timeStr.substring(2, 4)}`,
    });
  }

  return records;
}

export function AFDPunchImportDialog({ open, onOpenChange, collaborators }: Props) {
  const [parsed, setParsed] = useState<ParsedDay[] | null>(null);
  const [fileName, setFileName] = useState('');
  const upsert = useUpsertPunchRecords();

  const pisMap = useMemo(() => {
    const map = new Map<string, Collaborator>();
    for (const c of collaborators) {
      if (c.pis_matricula) {
        map.set(c.pis_matricula, c);
        map.set(c.pis_matricula.padStart(12, '0'), c);
        // Also store without leading zeros
        map.set(c.pis_matricula.replace(/^0+/, ''), c);
      }
    }
    return map;
  }, [collaborators]);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const records = parseAFDLines(text);

        if (records.length === 0) {
          toast.error('Nenhum registro de batida encontrado no arquivo.');
          return;
        }

        // Group by PIS + date
        const grouped: Record<string, { pis: string; date: string; times: string[] }> = {};
        for (const r of records) {
          const key = `${r.pis}|${r.date}`;
          if (!grouped[key]) grouped[key] = { pis: r.pis, date: r.date, times: [] };
          grouped[key].times.push(r.time);
        }

        const days: ParsedDay[] = Object.values(grouped).map(g => {
          const sortedTimes = g.times.sort();
          const collab = pisMap.get(g.pis) || pisMap.get(g.pis.padStart(12, '0')) || pisMap.get(g.pis.replace(/^0+/, ''));

          return {
            pis: g.pis,
            date: g.date,
            punches: sortedTimes,
            collaborator: collab,
            error: collab ? undefined : 'PIS não encontrado no cadastro',
          };
        });

        // Sort by date desc, then name
        days.sort((a, b) => {
          const d = b.date.localeCompare(a.date);
          if (d !== 0) return d;
          const na = a.collaborator?.collaborator_name || a.pis;
          const nb = b.collaborator?.collaborator_name || b.pis;
          return na.localeCompare(nb);
        });

        setParsed(days);
        setFileName(file.name);
      } catch {
        toast.error('Erro ao ler o arquivo.');
      }
    };
    reader.readAsText(file, 'latin1');
  }, [pisMap]);

  const validRows = parsed?.filter(r => !r.error) ?? [];
  const errorRows = parsed?.filter(r => !!r.error) ?? [];

  const handleImport = useCallback(async () => {
    if (!validRows.length) return;

    const records: PunchRecordUpsert[] = validRows.map(r => ({
      collaborator_id: r.collaborator!.id,
      collaborator_name: r.collaborator!.collaborator_name,
      date: r.date,
      entrada: r.punches[0] || null,
      saida_intervalo: r.punches[1] || null,
      retorno_intervalo: r.punches[2] || null,
      saida: r.punches[3] || null,
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
            <FileText className="w-5 h-5" /> Importar AFD (.txt)
          </DialogTitle>
        </DialogHeader>

        {!parsed ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <p className="text-sm text-muted-foreground text-center">
              Selecione um arquivo AFD (.txt) do relógio ponto no padrão MTE
            </p>
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".txt,.afd,.afdt"
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
              <Badge className="bg-green-600 text-white">
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
                  {errorRows.map((r, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="text-muted-foreground">PIS {r.pis}</span>
                      <span>Data {r.date}</span>
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
                      <TableHead className="text-center">Bat.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {validRows.slice(0, 50).map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm">{r.collaborator?.collaborator_name}</TableCell>
                        <TableCell className="text-xs">{r.date}</TableCell>
                        <TableCell className="text-xs">{r.punches[0] || '-'}</TableCell>
                        <TableCell className="text-xs">{r.punches[1] || '-'}</TableCell>
                        <TableCell className="text-xs">{r.punches[2] || '-'}</TableCell>
                        <TableCell className="text-xs">{r.punches[3] || '-'}</TableCell>
                        <TableCell className="text-center text-xs font-bold">{r.punches.length}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setParsed(null)}>Cancelar</Button>
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
