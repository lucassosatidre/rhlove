import { useState } from 'react';
import { useCollaborators, useCreateCollaborator, useUpdateCollaborator, useDeleteCollaborator, useBulkInsertCollaborators } from '@/hooks/useCollaborators';
import type { CollaboratorInput } from '@/hooks/useCollaborators';
import { DAYS_OF_WEEK, DAY_LABELS, SECTORS, STATUS_OPTIONS, STATUS_LABELS, TIPO_ESCALA, type Collaborator, type DayOfWeek, type TipoEscala, type CollaboratorStatus } from '@/types/collaborator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Upload, Download, Eye, CreditCard } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { DropZone } from '@/components/ui/drop-zone';
import * as XLSX from 'xlsx';
import CollaboratorProfileDialog from '@/components/collaborator/CollaboratorProfileDialog';
import PisImportDialog from '@/components/collaborator/PisImportDialog';

interface FormData {
  collaborator_name: string;
  sector: string;
  tipo_escala: TipoEscala;
  folgas_semanais: DayOfWeek[];
  sunday_n: number;
  status: CollaboratorStatus;
  inicio_na_empresa: string;
  data_desligamento: string;
  inicio_periodo: string;
  fim_periodo: string;
  pis_matricula: string;
  intervalo_automatico: boolean;
  intervalo_inicio: string;
  intervalo_duracao: number | null;
  carga_horaria_diaria: string;
}

const emptyForm: FormData = {
  collaborator_name: '',
  sector: SECTORS[0],
  tipo_escala: '6x1',
  folgas_semanais: ['SEGUNDA'],
  sunday_n: 1,
  status: 'ATIVO',
  inicio_na_empresa: new Date().toISOString().slice(0, 10),
  data_desligamento: '',
  inicio_periodo: '',
  fim_periodo: '',
  pis_matricula: '',
  intervalo_automatico: false,
  intervalo_inicio: '',
  intervalo_duracao: null,
  carga_horaria_diaria: '',
};

export default function Colaboradores() {
  const { data: collaborators = [], isLoading } = useCollaborators();
  const createMut = useCreateCollaborator();
  const updateMut = useUpdateCollaborator();
  const deleteMut = useDeleteCollaborator();
  const bulkMut = useBulkInsertCollaborators();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [profileCollaborator, setProfileCollaborator] = useState<Collaborator | null>(null);
  const [pisImportOpen, setPisImportOpen] = useState(false);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (c: Collaborator) => {
    setEditingId(c.id);
    setForm({
      collaborator_name: c.collaborator_name,
      sector: c.sector,
      tipo_escala: c.tipo_escala,
      folgas_semanais: c.folgas_semanais,
      sunday_n: c.sunday_n,
      status: c.status,
      inicio_na_empresa: c.inicio_na_empresa ?? '',
      data_desligamento: c.data_desligamento ?? '',
      inicio_periodo: c.inicio_periodo ?? '',
      fim_periodo: c.fim_periodo ?? '',
      pis_matricula: c.pis_matricula ?? '',
      intervalo_automatico: c.intervalo_automatico ?? false,
      intervalo_inicio: c.intervalo_inicio ?? '',
      intervalo_duracao: c.intervalo_duracao ?? null,
      carga_horaria_diaria: c.carga_horaria_diaria ?? '',
    });
    setDialogOpen(true);
  };

  const toInput = (f: FormData): CollaboratorInput => ({
    collaborator_name: f.collaborator_name,
    sector: f.sector,
    tipo_escala: f.tipo_escala,
    folgas_semanais: f.folgas_semanais,
    sunday_n: f.sunday_n,
    status: f.status,
    inicio_na_empresa: f.inicio_na_empresa || null,
    data_desligamento: f.data_desligamento || null,
    inicio_periodo: f.inicio_periodo || null,
    fim_periodo: f.fim_periodo || null,
    pis_matricula: f.pis_matricula || null,
    intervalo_automatico: f.intervalo_automatico,
    intervalo_inicio: f.intervalo_inicio || null,
    intervalo_duracao: f.intervalo_duracao,
    carga_horaria_diaria: f.carga_horaria_diaria || null,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.collaborator_name.trim()) {
      toast({ title: 'Nome obrigatório', variant: 'destructive' });
      return;
    }
    try {
      if (editingId) {
        await updateMut.mutateAsync({ id: editingId, ...toInput(form) });
        toast({ title: 'Colaborador atualizado' });
      } else {
        await createMut.mutateAsync(toInput(form));
        toast({ title: 'Colaborador cadastrado' });
      }
      setDialogOpen(false);
    } catch {
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este colaborador?')) return;
    try {
      await deleteMut.mutateAsync(id);
      toast({ title: 'Colaborador excluído' });
    } catch {
      toast({ title: 'Erro ao excluir', variant: 'destructive' });
    }
  };

  const toggleFolga = (day: DayOfWeek) => {
    setForm(f => {
      const has = f.folgas_semanais.includes(day);
      return {
        ...f,
        folgas_semanais: has
          ? f.folgas_semanais.filter(d => d !== day)
          : [...f.folgas_semanais, day],
      };
    });
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws);

      const dayMap: Record<string, DayOfWeek> = {
        'segunda': 'SEGUNDA', 'terça': 'TERCA', 'terca': 'TERCA',
        'quarta': 'QUARTA', 'quinta': 'QUINTA', 'sexta': 'SEXTA',
        'sábado': 'SABADO', 'sabado': 'SABADO', 'domingo': 'DOMINGO',
      };

      const mapped: CollaboratorInput[] = rows.map(row => {
        const name = String(row['collaborator_name'] || row['nome'] || row['Nome'] || '').trim();
        const sector = String(row['sector'] || row['setor'] || row['Setor'] || 'COZINHA').trim().toUpperCase();

        let folgas: DayOfWeek[] = [];
        const folgasRaw = row['folgas_semanais'] || row['folga_semanal'] || row['folga'] || row['Folga'] || row['weekly_day_off'] || '';
        if (typeof folgasRaw === 'string') {
          folgas = folgasRaw.split(',').map(s => dayMap[s.trim().toLowerCase()] || s.trim().toUpperCase() as DayOfWeek).filter(Boolean);
        }
        if (folgas.length === 0) folgas = ['SEGUNDA'];

        return {
          collaborator_name: name,
          sector,
          tipo_escala: (row['tipo_escala'] || '6x1') as TipoEscala,
          folgas_semanais: folgas,
          sunday_n: Number(row['sunday_n'] || row['domingo_n'] || 1),
          status: (row['status'] || 'ATIVO') as CollaboratorStatus,
          inicio_na_empresa: row['inicio_na_empresa'] || null,
          data_desligamento: row['data_desligamento'] || null,
          inicio_periodo: row['inicio_periodo'] || null,
          fim_periodo: row['fim_periodo'] || null,
        };
      }).filter(r => r.collaborator_name);

      if (mapped.length === 0) {
        toast({ title: 'Nenhum dado encontrado no arquivo', variant: 'destructive' });
        return;
      }

      await bulkMut.mutateAsync(mapped);
      toast({ title: `${mapped.length} colaboradores importados` });
    } catch {
      toast({ title: 'Erro ao importar', variant: 'destructive' });
    }
    e.target.value = '';
  };

  const handleExport = () => {
    const DAY_EXPORT: Record<string, string> = {
      SEGUNDA: 'Segunda', TERCA: 'Terça', QUARTA: 'Quarta',
      QUINTA: 'Quinta', SEXTA: 'Sexta', SABADO: 'Sábado', DOMINGO: 'Domingo',
    };
    const rows = collaborators.map(c => ({
      nome: c.collaborator_name,
      setor: c.sector,
      tipo_escala: c.tipo_escala,
      folga_semanal: c.folgas_semanais.map(d => DAY_EXPORT[d] || d).join(', '),
      domingo_n: c.sunday_n,
      status: c.status,
      inicio_na_empresa: c.inicio_na_empresa ?? '',
      data_desligamento: c.data_desligamento ?? '',
      inicio_periodo: c.inicio_periodo ?? '',
      fim_periodo: c.fim_periodo ?? '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r: 0, c });
      if (ws[addr]) ws[addr].s = { font: { bold: true } };
    }
    const cols = Object.keys(rows[0] || {});
    ws['!cols'] = cols.map((key) => {
      const maxLen = Math.max(key.length, ...rows.map(r => String((r as any)[key]).length));
      return { wch: maxLen + 2 };
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Colaboradores');
    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `colaboradores_estrela_rh_${today}.xlsx`);
  };

  const grouped = collaborators.reduce<Record<string, Collaborator[]>>((acc, c) => {
    (acc[c.sector] ??= []).push(c);
    return acc;
  }, {});

  const statusColor = (s: CollaboratorStatus) => {
    switch (s) {
      case 'ATIVO': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'FERIAS': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'AFASTADO': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      case 'EXPERIENCIA': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
      case 'AVISO_PREVIO': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'DESLIGADO': return 'bg-gray-100 text-gray-500 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const needsPeriod = (s: CollaboratorStatus) =>
    s === 'FERIAS' || s === 'AFASTADO' || s === 'EXPERIENCIA' || s === 'AVISO_PREVIO';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Colaboradores</h1>
          <p className="text-sm text-muted-foreground">{collaborators.length} cadastrados</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={collaborators.length === 0}>
            <Download className="w-4 h-4 mr-1" /> Exportar
          </Button>
          <DropZone
            inline
            accept=".xlsx,.xls,.csv"
            onFiles={(files) => {
              const synth = { target: { files, value: '' } } as unknown as React.ChangeEvent<HTMLInputElement>;
              handleImport(synth);
            }}
          >
            <label className="cursor-pointer">
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
              <Button variant="outline" size="sm" asChild>
                <span><Upload className="w-4 h-4 mr-1" /> Importar</span>
              </Button>
            </label>
          </DropZone>
          <Button variant="outline" size="sm" onClick={() => setPisImportOpen(true)}>
            <CreditCard className="w-4 h-4 mr-1" /> Importar PIS
          </Button>
          <Button size="sm" onClick={openNew}>
            <Plus className="w-4 h-4 mr-1" /> Novo
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : Object.keys(grouped).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum colaborador cadastrado. Clique em "Novo" ou importe um arquivo Excel.
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([sector, members]) => (
          <Card key={sector}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{sector} ({members.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead className="hidden sm:table-cell">Escala</TableHead>
                    <TableHead className="hidden sm:table-cell">Folgas</TableHead>
                    <TableHead className="hidden sm:table-cell">Dom</TableHead>
                    <TableHead className="hidden sm:table-cell">Status</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        <button onClick={() => setProfileCollaborator(c)} className="hover:text-primary hover:underline transition-colors text-left">
                          {c.collaborator_name}
                        </button>
                        <span className="sm:hidden block text-xs text-muted-foreground">
                          {c.tipo_escala} · {c.folgas_semanais.map(d => DAY_LABELS[d]?.slice(0, 3)).join(', ')}{c.sunday_n > 0 ? ` · Dom ${c.sunday_n}º` : ''}
                        </span>
                        <span className="sm:hidden block">
                          <Badge variant="secondary" className={`text-[10px] ${statusColor(c.status)}`}>
                            {STATUS_LABELS[c.status]}
                          </Badge>
                        </span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{c.tipo_escala}</TableCell>
                      <TableCell className="hidden sm:table-cell text-xs">
                        {c.folgas_semanais.map(d => DAY_LABELS[d]?.slice(0, 3)).join(', ')}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{c.sunday_n > 0 ? `${c.sunday_n}º` : '—'}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="secondary" className={`text-xs ${statusColor(c.status)}`}>
                          {STATUS_LABELS[c.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <button onClick={() => setProfileCollaborator(c)} className="p-1.5 rounded hover:bg-muted transition-colors" title="Ver perfil">
                            <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                          <button onClick={() => openEdit(c)} className="p-1.5 rounded hover:bg-muted transition-colors">
                            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                          <button onClick={() => handleDelete(c.id)} className="p-1.5 rounded hover:bg-destructive/10 transition-colors">
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Colaborador' : 'Novo Colaborador'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={form.collaborator_name}
                onChange={e => setForm(f => ({ ...f, collaborator_name: e.target.value }))}
                placeholder="Nome completo"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Setor</Label>
                <Select value={form.sector} onValueChange={v => setForm(f => ({ ...f, sector: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SECTORS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo Escala</Label>
                <Select value={form.tipo_escala} onValueChange={v => setForm(f => ({ ...f, tipo_escala: v as TipoEscala }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPO_ESCALA.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Folgas Semanais</Label>
              <div className="flex flex-wrap gap-3">
                {DAYS_OF_WEEK.map(day => (
                  <label key={day} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Checkbox
                      checked={form.folgas_semanais.includes(day)}
                      onCheckedChange={() => toggleFolga(day)}
                    />
                    {DAY_LABELS[day]?.slice(0, 3)}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={form.sunday_n > 0}
                  onCheckedChange={(checked) => setForm(f => ({ ...f, sunday_n: checked ? 1 : 0 }))}
                />
                <span className="font-medium">Domingo fixo de folga no mês</span>
              </label>
              {form.sunday_n > 0 && (
                <Select value={String(form.sunday_n)} onValueChange={v => setForm(f => ({ ...f, sunday_n: Number(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map(n => <SelectItem key={n} value={String(n)}>{n}º domingo</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as CollaboratorStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>PIS / Matrícula do ponto</Label>
              <Input
                value={form.pis_matricula}
                onChange={e => setForm(f => ({ ...f, pis_matricula: e.target.value }))}
                placeholder="Número do PIS ou matrícula (opcional)"
              />
            </div>

            <div className="space-y-2">
              <Label>Início na Empresa</Label>
              <Input
                type="date"
                value={form.inicio_na_empresa}
                onChange={e => setForm(f => ({ ...f, inicio_na_empresa: e.target.value }))}
              />
            </div>

            {form.status === 'DESLIGADO' && (
              <div className="space-y-2">
                <Label>Data de Desligamento</Label>
                <Input
                  type="date"
                  value={form.data_desligamento}
                  onChange={e => setForm(f => ({ ...f, data_desligamento: e.target.value }))}
                />
              </div>
            )}

            {needsPeriod(form.status) && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Início do Período</Label>
                  <Input
                    type="date"
                    value={form.inicio_periodo}
                    onChange={e => setForm(f => ({ ...f, inicio_periodo: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fim do Período</Label>
                  <Input
                    type="date"
                    value={form.fim_periodo}
                    onChange={e => setForm(f => ({ ...f, fim_periodo: e.target.value }))}
                  />
                </div>
              </div>
            )}

            {/* Carga horária diária */}
            <div className="space-y-1">
              <Label>Carga Horária Diária (HH:MM)</Label>
              <Input
                type="time"
                value={form.carga_horaria_diaria}
                onChange={e => setForm(f => ({ ...f, carga_horaria_diaria: e.target.value }))}
                placeholder="07:03"
              />
              <p className="text-[11px] text-muted-foreground">Usado como CH Prevista no espelho de ponto. Padrão: 07:03</p>
            </div>

            {/* Intervalo automático */}
            <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Intervalo Automático</p>
                  <p className="text-[11px] text-muted-foreground">Para colaboradores que não batem ponto no intervalo</p>
                </div>
                <Switch
                  checked={form.intervalo_automatico}
                  onCheckedChange={v => setForm(f => ({ ...f, intervalo_automatico: v }))}
                />
              </div>
              {form.intervalo_automatico && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Horário de saída p/ intervalo</Label>
                    <Input
                      type="time"
                      value={form.intervalo_inicio}
                      onChange={e => setForm(f => ({ ...f, intervalo_inicio: e.target.value }))}
                      placeholder="19:00"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Duração (minutos)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={120}
                      value={form.intervalo_duracao ?? ''}
                      onChange={e => setForm(f => ({ ...f, intervalo_duracao: e.target.value ? Number(e.target.value) : null }))}
                      placeholder="minutos"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit">{editingId ? 'Salvar' : 'Cadastrar'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <CollaboratorProfileDialog
        collaborator={profileCollaborator}
        open={!!profileCollaborator}
        onOpenChange={open => { if (!open) setProfileCollaborator(null); }}
      />

      <PisImportDialog
        open={pisImportOpen}
        onOpenChange={setPisImportOpen}
        collaborators={collaborators}
      />
    </div>
  );
}
