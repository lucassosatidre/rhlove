import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { todayLocalISO } from '@/lib/folgasUtils';
import { DAY_LABELS, type DayOfWeek } from '@/types/collaborator';

interface FolgasVigenciaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collaboratorName: string;
  fromFolgas: DayOfWeek[];
  fromSundayN: number;
  toFolgas: DayOfWeek[];
  toSundayN: number;
  onConfirm: (vigenteDesde: string, motivo: string | null) => Promise<void> | void;
}

function formatFolgas(folgas: DayOfWeek[], sundayN: number): string {
  const dias = folgas.map(d => DAY_LABELS[d] ?? d).join(', ') || '—';
  return `${dias} · Domingo ${sundayN}`;
}

export default function FolgasVigenciaDialog({
  open,
  onOpenChange,
  collaboratorName,
  fromFolgas,
  fromSundayN,
  toFolgas,
  toSundayN,
  onConfirm,
}: FolgasVigenciaDialogProps) {
  const [date, setDate] = useState<string>(todayLocalISO());
  const [motivo, setMotivo] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDate(todayLocalISO());
      setMotivo('');
      setSaving(false);
    }
  }, [open]);

  const today = todayLocalISO();
  const isPast = date < today;
  const dateObj = date ? parseISO(date) : undefined;

  const handleConfirm = async () => {
    if (!date) return;
    setSaving(true);
    try {
      await onConfirm(date, motivo.trim() || null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Vigência da nova folga</DialogTitle>
          <DialogDescription>
            A partir de quando a nova folga de <strong>{collaboratorName}</strong> passa a valer?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border bg-muted/40 p-3 space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">De:</span>{' '}
              <span className="font-medium">{formatFolgas(fromFolgas, fromSundayN)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Para:</span>{' '}
              <span className="font-medium text-primary">{formatFolgas(toFolgas, toSundayN)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Vigente a partir de</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn('w-full justify-start text-left font-normal', !date && 'text-muted-foreground')}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateObj ? format(dateObj, "PPP", { locale: ptBR }) : 'Escolher data'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateObj}
                  onSelect={(d) => {
                    if (!d) return;
                    const y = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    setDate(`${y}-${m}-${day}`);
                  }}
                  initialFocus
                  className={cn('p-3 pointer-events-auto')}
                />
              </PopoverContent>
            </Popover>
          </div>

          {isPast && (
            <div className="flex gap-2 rounded-lg border border-orange-300 bg-orange-50 p-3 text-sm text-orange-900">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Atenção: data no passado</p>
                <p className="text-xs mt-1">
                  Isso vai recalcular escalas, produtividade e compensações desde {format(parseISO(date), "PPP", { locale: ptBR })}.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo (opcional)</Label>
            <Textarea
              id="motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex: solicitação do colaborador, mudança de setor..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={saving || !date}>
            {saving ? 'Salvando...' : 'Confirmar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
