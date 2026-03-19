import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, AlertTriangle, XCircle, Upload } from 'lucide-react';
import { toast } from 'sonner';
import type { Collaborator } from '@/types/collaborator';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

interface CsvRow {
  nome: string;
  pis: string;
  matricula: string;
}

type MatchStatus = 'matched' | 'ambiguous' | 'not_found' | 'already_set';

interface MatchResult {
  csvRow: CsvRow;
  status: MatchStatus;
  matchedCollaborator: Collaborator | null;
  candidates: Collaborator[];
  selectedCollaboratorId: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collaborators: Collaborator[];
}

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
}

function matchCollaborator(name: string, collaborators: Collaborator[]): { exact: Collaborator | null; candidates: Collaborator[] } {
  const norm = normalize(name);
  
  // Exact match
  const exact = collaborators.find(c => normalize(c.collaborator_name) === norm);
  if (exact) return { exact, candidates: [exact] };

  // Partial match: check if normalized name contains or is contained
  const candidates = collaborators.filter(c => {
    const cNorm = normalize(c.collaborator_name);
    return cNorm.includes(norm) || norm.includes(cNorm) || 
      // Match by first + last name parts
      norm.split(' ').every(part => part.length > 2 && cNorm.includes(part));
  });

  return { exact: null, candidates };
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  // Detect separator
  const sep = lines[0].includes(';') ? ';' : ',';
  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(sep).map(s => s.trim().replace(/^"|"$/g, ''));
    if (parts.length >= 2) {
      rows.push({
        nome: parts[0] || '',
        pis: parts[1] || '',
        matricula: parts[2] || '',
      });
    }
  }
  return rows.filter(r => r.nome && r.pis);
}

export default function PisImportDialog({ open, onOpenChange, collaborators }: Props) {
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [step, setStep] = useState<'upload' | 'review'>('upload');
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const rows = parseCsv(text);
      if (rows.length === 0) {
        toast.error('Nenhum dado encontrado no arquivo.');
        return;
      }
      setCsvRows(rows);

      // Process matches
      const results: MatchResult[] = rows.map(row => {
        const { exact, candidates } = matchCollaborator(row.nome, collaborators);

        if (exact) {
          if (exact.pis_matricula && exact.pis_matricula !== row.pis) {
            return {
              csvRow: row,
              status: 'already_set' as MatchStatus,
              matchedCollaborator: exact,
              candidates: [exact],
              selectedCollaboratorId: null, // Don't auto-overwrite
            };
          }
          return {
            csvRow: row,
            status: 'matched' as MatchStatus,
            matchedCollaborator: exact,
            candidates: [exact],
            selectedCollaboratorId: exact.id,
          };
        }

        if (candidates.length === 1) {
          const c = candidates[0];
          if (c.pis_matricula && c.pis_matricula !== row.pis) {
            return {
              csvRow: row,
              status: 'already_set' as MatchStatus,
              matchedCollaborator: c,
              candidates,
              selectedCollaboratorId: null,
            };
          }
          return {
            csvRow: row,
            status: 'matched' as MatchStatus,
            matchedCollaborator: c,
            candidates,
            selectedCollaboratorId: c.id,
          };
        }

        if (candidates.length > 1) {
          return {
            csvRow: row,
            status: 'ambiguous' as MatchStatus,
            matchedCollaborator: null,
            candidates,
            selectedCollaboratorId: null,
          };
        }

        return {
          csvRow: row,
          status: 'not_found' as MatchStatus,
          matchedCollaborator: null,
          candidates: [],
          selectedCollaboratorId: null,
        };
      });

      setMatches(results);
      setStep('review');
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  };

  const updateSelection = (index: number, collaboratorId: string | null) => {
    setMatches(prev => prev.map((m, i) => i === index ? { ...m, selectedCollaboratorId: collaboratorId } : m));
  };

  const stats = useMemo(() => {
    const matched = matches.filter(m => m.selectedCollaboratorId).length;
    const notFound = matches.filter(m => m.status === 'not_found').length;
    const ambiguous = matches.filter(m => m.status === 'ambiguous' && !m.selectedCollaboratorId).length;
    const alreadySet = matches.filter(m => m.status === 'already_set').length;
    return { matched, notFound, ambiguous, alreadySet, total: matches.length };
  }, [matches]);

  const handleSave = async () => {
    const toUpdate = matches.filter(m => m.selectedCollaboratorId);
    if (toUpdate.length === 0) {
      toast.warning('Nenhum vínculo selecionado para salvar.');
      return;
    }

    setSaving(true);
    try {
      for (const m of toUpdate) {
        const { error } = await supabase
          .from('collaborators')
          .update({ pis_matricula: m.csvRow.pis } as any)
          .eq('id', m.selectedCollaboratorId!);
        if (error) throw error;
      }
      await qc.invalidateQueries({ queryKey: ['collaborators'] });
      toast.success(`${toUpdate.length} colaborador(es) atualizado(s) com PIS/Matrícula.`);
      onOpenChange(false);
      setStep('upload');
      setMatches([]);
      setCsvRows([]);
    } catch {
      toast.error('Erro ao salvar vínculos.');
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setStep('upload');
    setMatches([]);
    setCsvRows([]);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar PIS / Matrícula em Massa</DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <DropZone
            accept=".csv,.txt"
            onFiles={(files) => {
              const synth = { target: { files, value: '' } } as unknown as React.ChangeEvent<HTMLInputElement>;
              handleFile(synth);
            }}
            label="Arraste um arquivo CSV aqui ou clique para selecionar"
            className="py-8"
          >
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Upload className="w-12 h-12 opacity-50" />
              <p className="text-sm">
                Arraste um arquivo CSV aqui ou clique para selecionar
              </p>
              <p className="text-xs">
                Colunas: <strong>Nome;PIS;Matrícula</strong>
              </p>
            </div>
          </DropZone>
        )}

        {step === 'review' && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-lg font-bold">{stats.total}</p>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20 p-3 text-center">
                <p className="text-xs text-muted-foreground">Vinculados</p>
                <p className="text-lg font-bold text-emerald-600">{stats.matched}</p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 p-3 text-center">
                <p className="text-xs text-muted-foreground">Divergências</p>
                <p className="text-lg font-bold text-amber-600">{stats.ambiguous + stats.alreadySet}</p>
              </div>
              <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 p-3 text-center">
                <p className="text-xs text-muted-foreground">Não encontrados</p>
                <p className="text-lg font-bold text-red-600">{stats.notFound}</p>
              </div>
            </div>

            <div className="overflow-auto max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome (arquivo)</TableHead>
                    <TableHead>PIS</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Vincular a</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matches.map((m, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm font-medium">{m.csvRow.nome}</TableCell>
                      <TableCell className="font-mono text-xs">{m.csvRow.pis}</TableCell>
                      <TableCell>
                        {m.status === 'matched' && (
                          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px]">
                            <CheckCircle className="w-3 h-3 mr-1" /> Encontrado
                          </Badge>
                        )}
                        {m.status === 'ambiguous' && (
                          <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px]">
                            <AlertTriangle className="w-3 h-3 mr-1" /> Múltiplos
                          </Badge>
                        )}
                        {m.status === 'not_found' && (
                          <Badge variant="destructive" className="text-[10px]">
                            <XCircle className="w-3 h-3 mr-1" /> Não encontrado
                          </Badge>
                        )}
                        {m.status === 'already_set' && (
                          <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px]">
                            <AlertTriangle className="w-3 h-3 mr-1" /> PIS já definido
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {m.status === 'matched' && m.matchedCollaborator && (
                          <span className="text-sm text-emerald-600">{m.matchedCollaborator.collaborator_name}</span>
                        )}
                        {(m.status === 'ambiguous' || m.status === 'already_set') && (
                          <Select
                            value={m.selectedCollaboratorId || 'none'}
                            onValueChange={v => updateSelection(i, v === 'none' ? null : v)}
                          >
                            <SelectTrigger className="h-8 text-xs w-52">
                              <SelectValue placeholder="Selecionar..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Ignorar</SelectItem>
                              {(m.candidates.length > 0 ? m.candidates : collaborators).map(c => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.collaborator_name}
                                  {c.pis_matricula ? ` (PIS: ${c.pis_matricula})` : ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        {m.status === 'not_found' && (
                          <Select
                            value={m.selectedCollaboratorId || 'none'}
                            onValueChange={v => updateSelection(i, v === 'none' ? null : v)}
                          >
                            <SelectTrigger className="h-8 text-xs w-52">
                              <SelectValue placeholder="Vincular manualmente..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Ignorar</SelectItem>
                              {collaborators.map(c => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.collaborator_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={reset}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving || stats.matched === 0}>
                {saving ? 'Salvando...' : `Salvar ${matches.filter(m => m.selectedCollaboratorId).length} vínculo(s)`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
