import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useAllFreelancerEntries, useCancelFreelancerEntry, useReactivateFreelancerEntry, type FreelancerEntry } from '@/hooks/useFreelancerEntries';
import { useToast } from '@/hooks/use-toast';
import { Users, XCircle, RotateCcw, Search } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatDateBR(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function formatDateTimeBR(dateStr: string): string {
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function FreelancerHistoryDialog({ open, onOpenChange }: Props) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [sectorFilter, setSectorFilter] = useState<string>('todos');
  const [originFilter, setOriginFilter] = useState<string>('todos');
  const [nameFilter, setNameFilter] = useState('');

  const { data: entries = [], isLoading } = useAllFreelancerEntries(
    startDate || undefined,
    endDate || undefined
  );

  const cancelMut = useCancelFreelancerEntry();
  const reactivateMut = useReactivateFreelancerEntry();
  const { toast } = useToast();

  const filtered = useMemo(() => {
    return entries.filter(e => {
      if (statusFilter !== 'todos' && e.status !== statusFilter) return false;
      if (sectorFilter !== 'todos' && e.sector !== sectorFilter) return false;
      if (originFilter !== 'todos' && e.origin !== originFilter) return false;
      if (nameFilter && !e.name.toLowerCase().includes(nameFilter.toLowerCase())) return false;
      return true;
    });
  }, [entries, statusFilter, sectorFilter, originFilter, nameFilter]);

  const stats = useMemo(() => {
    const ativos = entries.filter(e => e.status === 'ativo').length;
    const cancelados = entries.filter(e => e.status === 'cancelado').length;
    const sectors = new Set(entries.filter(e => e.status === 'ativo').map(e => e.sector));
    const dates = new Set(entries.filter(e => e.status === 'ativo').map(e => e.date));
    return { ativos, cancelados, sectors: sectors.size, dates: dates.size };
  }, [entries]);

  const origins = useMemo(() => [...new Set(entries.map(e => e.origin))], [entries]);

  const handleCancel = async (entry: FreelancerEntry) => {
    if (!confirm(`Cancelar lançamento de ${entry.name} em ${formatDateBR(entry.date)}?`)) return;
    try {
      await cancelMut.mutateAsync({ id: entry.id });
      toast({ title: 'Lançamento cancelado', description: `${entry.name} - ${formatDateBR(entry.date)}` });
    } catch {
      toast({ title: 'Erro ao cancelar', variant: 'destructive' });
    }
  };

  const handleReactivate = async (entry: FreelancerEntry) => {
    try {
      await reactivateMut.mutateAsync(entry.id);
      toast({ title: 'Lançamento reativado', description: `${entry.name} - ${formatDateBR(entry.date)}` });
    } catch {
      toast({ title: 'Erro ao reativar', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Histórico de Free-lancers
          </DialogTitle>
          <DialogDescription>
            Todos os lançamentos de free-lancers com rastreabilidade completa.
          </DialogDescription>
        </DialogHeader>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-primary">{stats.ativos}</p>
              <p className="text-xs text-muted-foreground">Ativos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-destructive">{stats.cancelados}</p>
              <p className="text-xs text-muted-foreground">Cancelados</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold">{stats.dates}</p>
              <p className="text-xs text-muted-foreground">Dias</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold">{entries.length}</p>
              <p className="text-xs text-muted-foreground">Total registros</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-end">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">De</span>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-8 text-xs w-36" />
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Até</span>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-8 text-xs w-36" />
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Status</span>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 text-xs w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos" className="text-xs">Todos</SelectItem>
                <SelectItem value="ativo" className="text-xs">Ativo</SelectItem>
                <SelectItem value="cancelado" className="text-xs">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Setor</span>
            <Select value={sectorFilter} onValueChange={setSectorFilter}>
              <SelectTrigger className="h-8 text-xs w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos" className="text-xs">Todos</SelectItem>
                <SelectItem value="COZINHA" className="text-xs">Cozinha</SelectItem>
                <SelectItem value="SALÃO" className="text-xs">Salão</SelectItem>
                <SelectItem value="TELE - ENTREGA" className="text-xs">Tele-Entrega</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Origem</span>
            <Select value={originFilter} onValueChange={setOriginFilter}>
              <SelectTrigger className="h-8 text-xs w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos" className="text-xs">Todas</SelectItem>
                {origins.map(o => (
                  <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 flex-1 min-w-[120px]">
            <span className="text-xs text-muted-foreground">Nome</span>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input
                value={nameFilter}
                onChange={e => setNameFilter(e.target.value)}
                placeholder="Buscar..."
                className="h-8 text-xs pl-7"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Data</TableHead>
                <TableHead className="text-xs">Nome</TableHead>
                <TableHead className="text-xs">Setor</TableHead>
                <TableHead className="text-xs">Origem</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Criado por</TableHead>
                <TableHead className="text-xs">Criado em</TableHead>
                <TableHead className="text-xs w-24">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-xs text-muted-foreground py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-xs text-muted-foreground py-8">
                    Nenhum registro encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(entry => (
                  <TableRow key={entry.id} className={entry.status === 'cancelado' ? 'opacity-60' : ''}>
                    <TableCell className="text-xs font-medium">{formatDateBR(entry.date)}</TableCell>
                    <TableCell className="text-xs font-medium">{entry.name}</TableCell>
                    <TableCell className="text-xs">{entry.sector}</TableCell>
                    <TableCell className="text-xs capitalize">{entry.origin}</TableCell>
                    <TableCell>
                      {entry.status === 'ativo' ? (
                        <Badge variant="default" className="text-[10px] px-1.5 py-0">Ativo</Badge>
                      ) : (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Cancelado</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{entry.created_by || '-'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDateTimeBR(entry.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {entry.status === 'ativo' ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[10px] px-2 text-destructive hover:text-destructive"
                            onClick={() => handleCancel(entry)}
                            disabled={cancelMut.isPending}
                          >
                            <XCircle className="w-3 h-3 mr-1" /> Cancelar
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[10px] px-2 text-primary"
                            onClick={() => handleReactivate(entry)}
                            disabled={reactivateMut.isPending}
                          >
                            <RotateCcw className="w-3 h-3 mr-1" /> Reativar
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">
            {filtered.length} de {entries.length} registro(s)
          </span>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
