import type { Collaborator } from '@/types/collaborator';
import { STATUS_LABELS, DAY_LABELS } from '@/types/collaborator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import OccurrenceHistory from './OccurrenceHistory';
import { User, History } from 'lucide-react';

interface Props {
  collaborator: Collaborator | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function fmt(d: string | null | undefined): string {
  if (!d) return '-';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

export default function CollaboratorProfileDialog({ collaborator, open, onOpenChange }: Props) {
  if (!collaborator) return null;

  const c = collaborator;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            {c.collaborator_name}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="historico" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="dados" className="flex-1 gap-1.5">
              <User className="w-3.5 h-3.5" /> Dados
            </TabsTrigger>
            <TabsTrigger value="historico" className="flex-1 gap-1.5">
              <History className="w-3.5 h-3.5" /> Histórico de Ocorrências
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dados" className="mt-4">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <InfoRow label="Setor" value={c.sector} />
              <InfoRow label="Escala" value={c.tipo_escala} />
              <InfoRow label="Status">
                <Badge variant="secondary" className="text-xs">
                  {STATUS_LABELS[c.status]}
                </Badge>
              </InfoRow>
              <InfoRow label="Domingo de folga" value={`${c.sunday_n}º`} />
              <InfoRow
                label="Folgas semanais"
                value={c.folgas_semanais.map(d => DAY_LABELS[d]?.slice(0, 3)).join(', ')}
              />
              <InfoRow label="PIS / Matrícula" value={c.pis_matricula || 'Não informado'} />
              <InfoRow label="Início na empresa" value={fmt(c.inicio_na_empresa)} />
              {c.data_desligamento && (
                <InfoRow label="Data de desligamento" value={fmt(c.data_desligamento)} />
              )}
              {c.inicio_periodo && (
                <InfoRow label="Início do período" value={fmt(c.inicio_periodo)} />
              )}
              {c.fim_periodo && (
                <InfoRow label="Fim do período" value={fmt(c.fim_periodo)} />
              )}
            </div>
          </TabsContent>

          <TabsContent value="historico" className="mt-4">
            <OccurrenceHistory collaboratorId={c.id} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div>
      <span className="text-muted-foreground text-xs">{label}</span>
      <div className="font-medium mt-0.5">{children ?? value}</div>
    </div>
  );
}
