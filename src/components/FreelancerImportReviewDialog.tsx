import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle, Check, Plus, Trash2, Users } from 'lucide-react';
import { formatDateBR } from '@/lib/productivityEngine';

export interface FreeReviewEntry {
  id: string;
  date: string;
  name: string;
  sector: string | null; // null = setor pendente
  origin: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: FreeReviewEntry[];
  onConfirm: (entries: FreeReviewEntry[]) => void;
  isPending?: boolean;
}

const SECTORS = ['COZINHA', 'SALÃO', 'TELE - ENTREGA'] as const;

let _idCounter = 0;
export function generateEntryId(): string {
  return `entry-${Date.now()}-${++_idCounter}`;
}

export default function FreelancerImportReviewDialog({ open, onOpenChange, entries: initialEntries, onConfirm, isPending }: Props) {
  const [entries, setEntries] = useState<FreeReviewEntry[]>(initialEntries);
  const [addDate, setAddDate] = useState('');
  const [addName, setAddName] = useState('');
  const [addSector, setAddSector] = useState<string>('SALÃO');

  // Sync when dialog opens with new data
  const [lastInitial, setLastInitial] = useState(initialEntries);
  if (initialEntries !== lastInitial) {
    setEntries(initialEntries);
    setLastInitial(initialEntries);
  }

  const hasPendingSectors = entries.some(e => !e.sector);

  const updateEntry = (id: string, field: 'name' | 'sector', value: string) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, [field]: value || (field === 'sector' ? null : '') } : e));
  };

  const deleteEntry = (id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  const addEntry = () => {
    if (!addDate || !addName.trim()) return;
    setEntries(prev => [...prev, {
      id: generateEntryId(),
      date: addDate,
      name: addName.trim().toUpperCase(),
      sector: addSector,
      origin: 'manual',
    }]);
    setAddName('');
  };

  // Consolidation summary
  const consolidated = entries.reduce<Record<string, { cozinha: number; salao: number; tele: number }>>((acc, e) => {
    if (!e.sector) return acc;
    if (!acc[e.date]) acc[e.date] = { cozinha: 0, salao: 0, tele: 0 };
    if (e.sector === 'COZINHA') acc[e.date].cozinha++;
    else if (e.sector === 'SALÃO') acc[e.date].salao++;
    else if (e.sector === 'TELE - ENTREGA') acc[e.date].tele++;
    return acc;
  }, {});

  const sortedDates = Object.keys(consolidated).sort();
  const totalFrees = entries.filter(e => e.sector).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Revisão de Free-lancers
          </DialogTitle>
          <DialogDescription>
            Revise, edite e corrija os nomes e setores antes de confirmar a importação.
          </DialogDescription>
        </DialogHeader>

        {hasPendingSectors && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
            <p className="text-sm text-destructive">
              Existem free-lancers com <strong>setor pendente</strong>. Corrija antes de confirmar.
            </p>
          </div>
        )}

        {/* Editable entries table */}
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs w-24">Data</TableHead>
                <TableHead className="text-xs">Nome</TableHead>
                <TableHead className="text-xs w-44">Setor</TableHead>
                <TableHead className="text-xs w-32">Origem</TableHead>
                <TableHead className="text-xs w-20">Status</TableHead>
                <TableHead className="text-xs w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map(entry => (
                <TableRow key={entry.id} className={!entry.sector ? 'bg-destructive/5' : ''}>
                  <TableCell>
                    <Input
                      type="date"
                      value={entry.date}
                      onChange={e => updateEntry(entry.id, 'date', e.target.value)}
                      className="h-7 text-xs w-32"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={entry.name}
                      onChange={e => updateEntry(entry.id, 'name', e.target.value.toUpperCase())}
                      className="h-7 text-xs"
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={entry.sector || ''}
                      onValueChange={v => updateEntry(entry.id, 'sector', v)}
                    >
                      <SelectTrigger className={`h-7 text-xs ${!entry.sector ? 'border-destructive text-destructive' : ''}`}>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {SECTORS.map(s => (
                          <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{entry.origin}</TableCell>
                  <TableCell>
                    {entry.sector ? (
                      <Check className="w-3.5 h-3.5 text-green-600" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-destructive" />
                    )}
                  </TableCell>
                  <TableCell>
                    <button onClick={() => deleteEntry(entry.id)} className="p-1 rounded hover:bg-destructive/10 transition-colors">
                      <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Add manual entry */}
        <div className="rounded-lg border border-dashed border-border p-3 space-y-2">
          <p className="text-xs font-medium">+ Adicionar free-lancer manualmente</p>
          <div className="flex flex-wrap gap-2 items-end">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Data</span>
              <Input type="date" value={addDate} onChange={e => setAddDate(e.target.value)} className="h-7 text-xs w-36" />
            </div>
            <div className="space-y-1 flex-1 min-w-[120px]">
              <span className="text-xs text-muted-foreground">Nome</span>
              <Input
                value={addName}
                onChange={e => setAddName(e.target.value)}
                placeholder="Nome do free-lancer"
                className="h-7 text-xs"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addEntry(); } }}
              />
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Setor</span>
              <Select value={addSector} onValueChange={setAddSector}>
                <SelectTrigger className="h-7 text-xs w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SECTORS.map(s => (
                    <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={addEntry} disabled={!addDate || !addName.trim()}>
              <Plus className="w-3 h-3 mr-1" /> Adicionar
            </Button>
          </div>
        </div>

        {/* Consolidated summary */}
        {sortedDates.length > 0 && (
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
            <p className="text-xs font-medium">Resumo consolidado após revisão:</p>
            <div className="grid gap-1">
              {sortedDates.map(date => {
                const c = consolidated[date];
                const total = c.cozinha + c.salao + c.tele;
                return (
                  <div key={date} className="text-xs flex gap-4">
                    <span className="font-medium w-16">{formatDateBR(date)}</span>
                    <span>Cozinha: <strong>{c.cozinha}</strong></span>
                    <span>Salão: <strong>{c.salao}</strong></span>
                    <span>Tele: <strong>{c.tele}</strong></span>
                    <span className="text-muted-foreground">Total: {total}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between items-center pt-2">
          <span className="text-xs text-muted-foreground">
            {entries.length} free(s) · {totalFrees} válido(s)
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => onConfirm(entries)}
              disabled={hasPendingSectors || entries.length === 0 || isPending}
            >
              <Check className="w-4 h-4 mr-1" /> Confirmar Importação
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
