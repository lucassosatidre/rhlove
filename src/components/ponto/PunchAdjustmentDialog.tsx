import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PunchAdjustmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collaboratorId: string;
  collaboratorName: string;
  date: string; // yyyy-MM-dd
  dateObj: Date;
  entrada?: string | null;
  saidaInt?: string | null;
  retornoInt?: string | null;
  saida?: string | null;
}

export function PunchAdjustmentDialog({
  open, onOpenChange,
  collaboratorId, collaboratorName, date, dateObj,
  entrada, saidaInt, retornoInt, saida,
}: PunchAdjustmentDialogProps) {
  const [entradaVal, setEntradaVal] = useState(entrada ?? '');
  const [saidaIntVal, setSaidaIntVal] = useState(saidaInt ?? '');
  const [retornoIntVal, setRetornoIntVal] = useState(retornoInt ?? '');
  const [saidaVal, setSaidaVal] = useState(saida ?? '');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();
  const { usuario } = useAuth();

  const handleSave = async () => {
    if (!reason.trim()) {
      toast.error('Justificativa é obrigatória.');
      return;
    }

    setSaving(true);
    try {
      const record = {
        collaborator_id: collaboratorId,
        collaborator_name: collaboratorName,
        date,
        entrada: entradaVal || null,
        saida_intervalo: saidaIntVal || null,
        retorno_intervalo: retornoIntVal || null,
        saida: saidaVal || null,
        adjusted_by: usuario?.id ?? null,
        adjusted_at: new Date().toISOString(),
        adjustment_reason: reason.trim(),
      };

      const { error } = await supabase
        .from('punch_records')
        .upsert(record as any, { onConflict: 'collaborator_id,date' });

      if (error) throw error;

      toast.success('Ajuste salvo com sucesso.');
      qc.invalidateQueries({ queryKey: ['punch_records'] });
      onOpenChange(false);
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + (err.message ?? 'desconhecido'));
    } finally {
      setSaving(false);
    }
  };

  // Reset fields when dialog opens
  const handleOpenChange = (v: boolean) => {
    if (v) {
      setEntradaVal(entrada ?? '');
      setSaidaIntVal(saidaInt ?? '');
      setRetornoIntVal(retornoInt ?? '');
      setSaidaVal(saida ?? '');
      setReason('');
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ajuste de Ponto</DialogTitle>
          <DialogDescription>Ajuste manual de batida de ponto</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Data</Label>
              <Input value={format(dateObj, "dd/MM/yyyy (EEEE)", { locale: ptBR })} disabled className="text-sm" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Colaborador</Label>
              <Input value={collaboratorName} disabled className="text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Entrada</Label>
              <Input type="time" value={entradaVal} onChange={e => setEntradaVal(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Saída Intervalo</Label>
              <Input type="time" value={saidaIntVal} onChange={e => setSaidaIntVal(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Retorno Intervalo</Label>
              <Input type="time" value={retornoIntVal} onChange={e => setRetornoIntVal(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Saída</Label>
              <Input type="time" value={saidaVal} onChange={e => setSaidaVal(e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="text-xs">Justificativa <span className="text-destructive">*</span></Label>
            <Textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Ex: Esqueceu de bater, Erro no relógio..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar ajuste'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
