import { useState, useMemo } from 'react';
import { useCollaboratorOccurrences, computeOccurrenceSummary, type OccurrenceType } from '@/hooks/useCollaboratorOccurrences';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, FileText, Calendar, Loader2 } from 'lucide-react';

const TYPE_LABELS: Record<OccurrenceType, string> = {
  FALTA: 'Falta',
  ATESTADO: 'Atestado',
  COMPENSACAO: 'Compensação',
};

const TYPE_COLORS: Record<OccurrenceType, string> = {
  FALTA: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  ATESTADO: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  COMPENSACAO: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

const TYPE_ICONS: Record<OccurrenceType, React.ReactNode> = {
  FALTA: <AlertTriangle className="w-3.5 h-3.5" />,
  ATESTADO: <FileText className="w-3.5 h-3.5" />,
  COMPENSACAO: <Calendar className="w-3.5 h-3.5" />,
};

function fmt(d: string | null | undefined): string {
  if (!d) return '-';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

interface Props {
  collaboratorId: string;
}

export default function OccurrenceHistory({ collaboratorId }: Props) {
  const { data: occurrences = [], isLoading } = useCollaboratorOccurrences(collaboratorId);
  const [filter, setFilter] = useState<'ALL' | OccurrenceType>('ALL');
  const [yearFilter, setYearFilter] = useState<string>('ALL');

  const years = useMemo(() => {
    const set = new Set(occurrences.map(o => o.date.slice(0, 4)));
    return Array.from(set).sort().reverse();
  }, [occurrences]);

  const filtered = useMemo(() => {
    return occurrences.filter(o => {
      if (filter !== 'ALL' && o.type !== filter) return false;
      if (yearFilter !== 'ALL' && !o.date.startsWith(yearFilter)) return false;
      return true;
    });
  }, [occurrences, filter, yearFilter]);

  const summary = useMemo(() => computeOccurrenceSummary(
    yearFilter !== 'ALL' ? occurrences.filter(o => o.date.startsWith(yearFilter)) : occurrences
  ), [occurrences, yearFilter]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary indicators */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="Faltas" value={summary.totalFaltas} color="text-red-600 dark:text-red-400" />
        <SummaryCard label="Dias de Atestado" value={summary.totalDiasAtestado} color="text-amber-600 dark:text-amber-400" />
        <SummaryCard label="Comp. Pendentes" value={summary.compPendentes} color="text-blue-600 dark:text-blue-400" />
        <SummaryCard label="Comp. Realizadas" value={summary.compRealizadas} color="text-emerald-600 dark:text-emerald-400" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select value={filter} onValueChange={v => setFilter(v as any)}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos os tipos</SelectItem>
            <SelectItem value="FALTA">Faltas</SelectItem>
            <SelectItem value="ATESTADO">Atestados</SelectItem>
            <SelectItem value="COMPENSACAO">Compensações</SelectItem>
          </SelectContent>
        </Select>
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-[120px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos os anos</SelectItem>
            {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Nenhuma ocorrência encontrada.
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[110px]">Tipo</TableHead>
                <TableHead>Período / Data</TableHead>
                <TableHead>Detalhe</TableHead>
                <TableHead className="hidden sm:table-cell">Observação</TableHead>
                <TableHead className="hidden sm:table-cell w-[100px]">Registrado por</TableHead>
                <TableHead className="hidden sm:table-cell w-[130px]">Registro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(o => (
                <TableRow key={o.id}>
                  <TableCell>
                    <Badge variant="secondary" className={`text-[10px] gap-1 ${TYPE_COLORS[o.type]}`}>
                      {TYPE_ICONS[o.type]}
                      {TYPE_LABELS[o.type]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {o.dateEnd && o.dateEnd !== o.date
                      ? `${fmt(o.date)} a ${fmt(o.dateEnd)}`
                      : fmt(o.date)}
                  </TableCell>
                  <TableCell className="text-sm">{o.detail}</TableCell>
                  <TableCell className="hidden sm:table-cell text-xs text-muted-foreground max-w-[200px] truncate">
                    {o.observation || '-'}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                    {o.createdBy || '-'}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                    {fmtDateTime(o.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border bg-card p-3 text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}
