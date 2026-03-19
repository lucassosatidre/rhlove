import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useFreelancers, useUpsertFreelancer, useBulkUpsertFreelancers, useDeleteFreelancer, type FreelancerInput } from '@/hooks/useFreelancers';
import { useToast } from '@/hooks/use-toast';
import { Plus, Upload, Trash2 } from 'lucide-react';
import { DropZone } from '@/components/ui/drop-zone';
import * as XLSX from 'xlsx';

interface FreesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  weekStartDate: Date;
  weekEndDate: Date;
}

const SECTORS = ['COZINHA', 'SALÃO', 'TELE'] as const;
const SECTOR_DB_MAP: Record<string, string> = {
  'COZINHA': 'COZINHA',
  'SALÃO': 'SALÃO',
  'TELE': 'TELE - ENTREGA',
};

function formatDateISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateBR(d: Date | string): string {
  if (typeof d === 'string') {
    const [y, m, day] = d.split('-');
    return `${day}/${m}`;
  }
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getDaysInRange(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const current = new Date(start);
  while (current <= end) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
}

export default function FreesDialog({ open, onOpenChange, weekStartDate, weekEndDate }: FreesDialogProps) {
  const startStr = formatDateISO(weekStartDate);
  const endStr = formatDateISO(weekEndDate);
  const { data: freelancers = [], isLoading } = useFreelancers(startStr, endStr);
  const upsertMut = useUpsertFreelancer();
  const bulkMut = useBulkUpsertFreelancers();
  const deleteMut = useDeleteFreelancer();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [manualDate, setManualDate] = useState(startStr);
  const [manualCozinha, setManualCozinha] = useState(0);
  const [manualSalao, setManualSalao] = useState(0);
  const [manualTele, setManualTele] = useState(0);

  const days = getDaysInRange(weekStartDate, weekEndDate);

  const getQty = (date: string, sector: string): number => {
    const f = freelancers.find(fr => fr.date === date && fr.sector === sector);
    return f ? f.quantity : 0;
  };

  const handleManualSave = async () => {
    if (!manualDate) {
      toast({ title: 'Selecione uma data', variant: 'destructive' });
      return;
    }
    const entries: FreelancerInput[] = [];
    if (manualCozinha > 0) entries.push({ date: manualDate, sector: 'COZINHA', quantity: manualCozinha });
    if (manualSalao > 0) entries.push({ date: manualDate, sector: 'SALÃO', quantity: manualSalao });
    if (manualTele > 0) entries.push({ date: manualDate, sector: 'TELE - ENTREGA', quantity: manualTele });

    if (entries.length === 0) {
      toast({ title: 'Informe ao menos 1 free lancer', variant: 'destructive' });
      return;
    }

    try {
      await bulkMut.mutateAsync(entries);
      toast({ title: 'Free lancers salvos' });
      setManualCozinha(0);
      setManualSalao(0);
      setManualTele(0);
    } catch {
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      if (raw.length < 2) {
        toast({ title: 'Planilha vazia', variant: 'destructive' });
        return;
      }

      const entries: FreelancerInput[] = [];

      for (let i = 1; i < raw.length; i++) {
        const row = raw[i];
        if (!row || row.length === 0) continue;

        // Try to parse date from col A
        let dateStr = '';
        const colA = row[0];
        if (colA) {
          if (typeof colA === 'number' && colA > 30000) {
            const d = XLSX.SSF.parse_date_code(colA);
            dateStr = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
          } else if (typeof colA === 'string') {
            const parts = colA.trim().split('/');
            if (parts.length === 3 && parts[0].length <= 2) {
              dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            } else if (/^\d{4}-\d{2}-\d{2}$/.test(colA.trim())) {
              dateStr = colA.trim();
            }
          }
        }

        if (!dateStr) continue;

        const freeCozinha = Number(row[1]) || 0;
        const freeSalao = Number(row[2]) || 0;
        const freeTele = Number(row[3]) || 0;

        if (freeCozinha > 0) entries.push({ date: dateStr, sector: 'COZINHA', quantity: freeCozinha });
        if (freeSalao > 0) entries.push({ date: dateStr, sector: 'SALÃO', quantity: freeSalao });
        if (freeTele > 0) entries.push({ date: dateStr, sector: 'TELE - ENTREGA', quantity: freeTele });
      }

      if (entries.length === 0) {
        toast({ title: 'Nenhum dado válido encontrado', variant: 'destructive' });
        return;
      }

      await bulkMut.mutateAsync(entries);
      toast({ title: `${entries.length} registros de free lancers importados` });
    } catch {
      toast({ title: 'Erro ao importar planilha', variant: 'destructive' });
    }

    e.target.value = '';
  };

  const handleDeleteDay = async (date: string) => {
    const toDelete = freelancers.filter(f => f.date === date);
    try {
      for (const f of toDelete) {
        await deleteMut.mutateAsync(f.id);
      }
      toast({ title: 'Free lancers removidos' });
    } catch {
      toast({ title: 'Erro ao remover', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Free Lancers da Semana</DialogTitle>
          <DialogDescription>
            {formatDateBR(weekStartDate)} a {formatDateBR(weekEndDate)} — Cadastre a quantidade de free lancers por dia e setor
          </DialogDescription>
        </DialogHeader>

        {/* Manual entry */}
        <div className="space-y-3 border rounded-lg p-3">
          <h4 className="text-sm font-semibold">Preenchimento Manual</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Data</Label>
              <Input type="date" value={manualDate} onChange={e => setManualDate(e.target.value)} min={startStr} max={endStr} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Free Cozinha</Label>
              <Input type="number" min={0} value={manualCozinha} onChange={e => setManualCozinha(Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Free Salão</Label>
              <Input type="number" min={0} value={manualSalao} onChange={e => setManualSalao(Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Free Tele</Label>
              <Input type="number" min={0} value={manualTele} onChange={e => setManualTele(Number(e.target.value))} />
            </div>
          </div>
          <Button size="sm" onClick={handleManualSave} disabled={bulkMut.isPending}>
            <Plus className="w-4 h-4 mr-1" /> Salvar
          </Button>
        </div>

        {/* Import */}
        <div className="space-y-2 border rounded-lg p-3">
          <h4 className="text-sm font-semibold">Importar Planilha</h4>
          <p className="text-xs text-muted-foreground">
            Formato: Coluna A = Data, B = Free Cozinha, C = Free Salão, D = Free Tele
          </p>
          <DropZone
            inline
            accept=".xlsx,.xls"
            onFiles={(files) => {
              const synth = { target: { files, value: '' } } as unknown as React.ChangeEvent<HTMLInputElement>;
              handleImport(synth);
            }}
          >
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-4 h-4 mr-1" /> Importar Excel
            </Button>
          </DropZone>
        </div>

        {/* Table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead className="text-center">Cozinha</TableHead>
                <TableHead className="text-center">Salão</TableHead>
                <TableHead className="text-center">Tele</TableHead>
                <TableHead className="text-center">Total</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {days.map(day => {
                const dateStr = formatDateISO(day);
                const coz = getQty(dateStr, 'COZINHA');
                const sal = getQty(dateStr, 'SALÃO');
                const tel = getQty(dateStr, 'TELE - ENTREGA');
                const total = coz + sal + tel;
                const hasData = total > 0;

                return (
                  <TableRow key={dateStr} className={hasData ? '' : 'text-muted-foreground'}>
                    <TableCell className="font-medium">{formatDateBR(dateStr)}</TableCell>
                    <TableCell className="text-center">{coz || '-'}</TableCell>
                    <TableCell className="text-center">{sal || '-'}</TableCell>
                    <TableCell className="text-center">{tel || '-'}</TableCell>
                    <TableCell className="text-center font-semibold">{total || '-'}</TableCell>
                    <TableCell>
                      {hasData && (
                        <button onClick={() => handleDeleteDay(dateStr)} className="p-1 rounded hover:bg-muted transition-colors">
                          <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
