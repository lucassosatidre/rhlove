import { useState, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, CheckCircle, AlertTriangle, Info, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import type { Collaborator } from '@/types/collaborator';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  collaborators: Collaborator[];
}

interface SheetData {
  sheetName: string;
  matchedCollaborator: Collaborator | null;
  manualSelection: string | null;
  days: DayData[];
  isEmpty: boolean;
}

interface DayData {
  date: string; // yyyy-MM-dd
  entrada: string | null;
  saidaIntervalo: string | null;
  retornoIntervalo: string | null;
  saida: string | null;
}

function removeAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function matchCollaborator(sheetName: string, collaborators: Collaborator[]): Collaborator | null {
  const norm = removeAccents(sheetName.trim()).toLowerCase();
  // Exact match
  const exact = collaborators.find(c => removeAccents(c.collaborator_name).toLowerCase() === norm);
  if (exact) return exact;
  // Partial: sheet name contains collaborator name or vice-versa
  const partial = collaborators.filter(c => {
    const cn = removeAccents(c.collaborator_name).toLowerCase();
    return norm.includes(cn) || cn.includes(norm);
  });
  if (partial.length === 1) return partial[0];
  // First name match if unique
  const firstName = norm.split(/\s+/)[0];
  if (firstName.length >= 3) {
    const firstNameMatches = collaborators.filter(c =>
      removeAccents(c.collaborator_name).toLowerCase().split(/\s+/)[0] === firstName
    );
    if (firstNameMatches.length === 1) return firstNameMatches[0];
  }
  return null;
}

function normalizeTime(val: any): string | null {
  if (!val || val === '' || val === '-') return null;
  if (typeof val === 'number') {
    const totalMinutes = Math.round(val * 24 * 60);
    const h = Math.floor(totalMinutes / 60) % 24;
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  const s = String(val).trim();
  if (s.toLowerCase() === 'folga') return null;
  const match = s.match(/(\d{1,2}):(\d{2})/);
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : null;
}

function parseDate(val: any): string | null {
  if (!val) return null;
  const s = String(val).trim();
  // "DD/MM/AAAA Dia" format
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  // Date object from xlsx
  if (val instanceof Date) {
    const y = val.getFullYear();
    const mo = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${mo}-${d}`;
  }
  if (typeof val === 'number') {
    const d = new Date((val - 25569) * 86400 * 1000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return null;
}

function isFolgaRow(row: any[]): boolean {
  // Check if any cell from B onwards contains "Folga"
  for (let i = 1; i < Math.min(row.length, 6); i++) {
    if (String(row[i] ?? '').trim().toLowerCase() === 'folga') return true;
  }
  return false;
}

export function UpdatePunchesDialog({ open, onOpenChange, collaborators }: Props) {
  const [sheets, setSheets] = useState<SheetData[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const qc = useQueryClient();

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'array', cellDates: true });
        const result: SheetData[] = [];

        for (const name of wb.SheetNames) {
          const ws = wb.Sheets[name];
          const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

          // Skip header rows (row 0 = headers, row 1 = "Totais"), data starts at row 2+
          const dataStartRow = raw.length > 2 ? 2 : raw.length;
          const days: DayData[] = [];

          for (let i = dataStartRow; i < raw.length; i++) {
            const row = raw[i];
            const dateVal = parseDate(row[0]);
            if (!dateVal) continue;
            if (isFolgaRow(row)) continue;

            const entrada = normalizeTime(row[1]);
            const saidaIntervalo = normalizeTime(row[2]);
            const retornoIntervalo = normalizeTime(row[3]);
            const saida = normalizeTime(row[4]);

            if (!entrada && !saidaIntervalo && !retornoIntervalo && !saida) continue;

            days.push({ date: dateVal, entrada, saidaIntervalo, retornoIntervalo, saida });
          }

          const matched = matchCollaborator(name, collaborators);
          result.push({
            sheetName: name,
            matchedCollaborator: matched,
            manualSelection: null,
            days,
            isEmpty: days.length === 0,
          });
        }

        setSheets(result);
        setFileName(file.name);
      } catch {
        toast.error('Erro ao ler o arquivo.');
      }
    };
    reader.readAsArrayBuffer(file);
  }, [collaborators]);

  const sheetsWithData = useMemo(() => sheets?.filter(s => !s.isEmpty) ?? [], [sheets]);
  const emptySheets = useMemo(() => sheets?.filter(s => s.isEmpty) ?? [], [sheets]);
  const matchedSheets = useMemo(() => sheetsWithData.filter(s => s.matchedCollaborator || s.manualSelection), [sheetsWithData]);
  const unmatchedSheets = useMemo(() => sheetsWithData.filter(s => !s.matchedCollaborator && !s.manualSelection), [sheetsWithData]);

  const canImport = unmatchedSheets.length === 0 && matchedSheets.length > 0;

  const getCollaborator = (s: SheetData): Collaborator | null => {
    if (s.manualSelection) return collaborators.find(c => c.id === s.manualSelection) ?? null;
    return s.matchedCollaborator;
  };

  const handleManualSelect = (sheetName: string, collabId: string) => {
    setSheets(prev => prev?.map(s =>
      s.sheetName === sheetName ? { ...s, manualSelection: collabId } : s
    ) ?? null);
  };

  const handleImport = useCallback(async () => {
    if (!canImport) return;
    setImporting(true);

    try {
      // First, get existing adjusted records to preserve them
      const allCollabIds = matchedSheets.map(s => getCollaborator(s)!.id);
      const allDates = matchedSheets.flatMap(s => s.days.map(d => d.date));
      const minDate = allDates.sort()[0];
      const maxDate = allDates.sort().reverse()[0];

      const { data: existingRecords } = await supabase
        .from('punch_records')
        .select('collaborator_id, date, adjusted_by')
        .in('collaborator_id', allCollabIds)
        .gte('date', minDate)
        .lte('date', maxDate);

      const adjustedSet = new Set(
        (existingRecords ?? [])
          .filter(r => r.adjusted_by)
          .map(r => `${r.collaborator_id}|${r.date}`)
      );

      let importedDays = 0;
      let preservedDays = 0;
      let autoIntervalDays = 0;
      const records: any[] = [];

      for (const sheet of matchedSheets) {
        const collab = getCollaborator(sheet)!;
        for (const day of sheet.days) {
          const key = `${collab.id}|${day.date}`;
          if (adjustedSet.has(key)) {
            preservedDays++;
            continue;
          }

          let saidaInt = day.saidaIntervalo;
          let retornoInt = day.retornoIntervalo;

          // Auto-fill interval for collaborators with intervalo_automatico
          if (collab.intervalo_automatico && collab.intervalo_inicio && collab.intervalo_duracao) {
            if (day.entrada && day.saida && !saidaInt && !retornoInt) {
              saidaInt = collab.intervalo_inicio;
              const [ih, im] = collab.intervalo_inicio.split(':').map(Number);
              const totalMin = ih * 60 + im + collab.intervalo_duracao;
              retornoInt = `${String(Math.floor(totalMin / 60) % 24).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
              autoIntervalDays++;
            }
          }

          records.push({
            collaborator_id: collab.id,
            collaborator_name: collab.collaborator_name,
            date: day.date,
            entrada: day.entrada,
            saida_intervalo: saidaInt,
            retorno_intervalo: retornoInt,
            saida: day.saida,
          });
          importedDays++;
        }
      }

      if (records.length > 0) {
        // Batch upsert in chunks of 500
        for (let i = 0; i < records.length; i += 500) {
          const chunk = records.slice(i, i + 500);
          const { error } = await supabase
            .from('punch_records')
            .upsert(chunk, { onConflict: 'collaborator_id,date' });
          if (error) throw error;
        }
      }

      await qc.invalidateQueries({ queryKey: ['punch_records'] });

      const parts = [
        `✅ ${matchedSheets.length} colaboradores atualizados`,
        `📊 ${importedDays} dias importados`,
      ];
      if (emptySheets.length > 0) parts.push(`⚠️ ${emptySheets.length} abas ignoradas`);
      if (preservedDays > 0) parts.push(`🔧 ${preservedDays} dias preservados (ajuste manual)`);

      toast.success(parts.join(' · '));
      onOpenChange(false);
      setSheets(null);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao importar registros.');
    } finally {
      setImporting(false);
    }
  }, [canImport, matchedSheets, emptySheets, qc, onOpenChange, collaborators]);

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setSheets(null); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5" /> Atualizar Batidas
          </DialogTitle>
        </DialogHeader>

        {!sheets ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <p className="text-sm text-muted-foreground text-center">
              Selecione o arquivo Excel do relógio de ponto.<br />
              Cada aba deve ser um colaborador com os horários de entrada e saída.
            </p>
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".xlsx,.xls"
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
              {matchedSheets.length > 0 && (
                <Badge variant="default" className="bg-green-600">
                  <CheckCircle className="w-3 h-3 mr-1" /> {matchedSheets.length} encontrados
                </Badge>
              )}
              {unmatchedSheets.length > 0 && (
                <Badge variant="destructive">
                  <AlertTriangle className="w-3 h-3 mr-1" /> {unmatchedSheets.length} sem match
                </Badge>
              )}
              {emptySheets.length > 0 && (
                <Badge variant="outline">
                  <Info className="w-3 h-3 mr-1" /> {emptySheets.length} vazias
                </Badge>
              )}
            </div>

            {/* Matched sheets */}
            {matchedSheets.length > 0 && (
              <div className="border rounded-md overflow-auto max-h-48">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Aba</TableHead>
                      <TableHead>Colaborador</TableHead>
                      <TableHead className="text-center">Dias</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matchedSheets.map(s => {
                      const c = getCollaborator(s);
                      return (
                        <TableRow key={s.sheetName}>
                          <TableCell className="text-xs">{s.sheetName}</TableCell>
                          <TableCell className="text-sm">
                            ✅ {c?.collaborator_name} <span className="text-muted-foreground text-xs">({c?.sector})</span>
                          </TableCell>
                          <TableCell className="text-center text-xs">{s.days.length}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Unmatched sheets */}
            {unmatchedSheets.length > 0 && (
              <div className="border border-destructive/30 rounded-md p-3 bg-destructive/5 space-y-2">
                <p className="text-xs font-medium text-destructive">Abas sem correspondência — selecione o colaborador:</p>
                {unmatchedSheets.map(s => (
                  <div key={s.sheetName} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground min-w-32 truncate">⚠️ {s.sheetName}</span>
                    <Select onValueChange={(v) => handleManualSelect(s.sheetName, v)}>
                      <SelectTrigger className="h-8 text-xs flex-1">
                        <SelectValue placeholder="Selecionar colaborador..." />
                      </SelectTrigger>
                      <SelectContent>
                        {collaborators
                          .filter(c => c.status !== 'DESLIGADO')
                          .map(c => (
                            <SelectItem key={c.id} value={c.id} className="text-xs">
                              {c.collaborator_name} ({c.sector})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            )}

            {/* Empty sheets */}
            {emptySheets.length > 0 && (
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">ℹ️ Abas sem dados:</span>{' '}
                {emptySheets.map(s => s.sheetName).join(', ')}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSheets(null)}>Cancelar</Button>
              <Button onClick={handleImport} disabled={!canImport || importing}>
                {importing ? 'Importando...' : `Confirmar importação (${matchedSheets.length} colaboradores)`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
