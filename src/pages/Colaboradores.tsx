import { useState } from 'react';
import { useCollaborators, useCreateCollaborator, useUpdateCollaborator, useDeleteCollaborator, useBulkInsertCollaborators } from '@/hooks/useCollaborators';
import type { CollaboratorInput } from '@/hooks/useCollaborators';
import { DAYS_OF_WEEK, DAY_LABELS, SECTORS, STATUS_OPTIONS, STATUS_LABELS, TIPO_ESCALA, type Collaborator, type DayOfWeek, type TipoEscala, type CollaboratorStatus, type JornadaEspecial } from '@/types/collaborator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  display_name: string;
  sector: string;
  tipo_escala: TipoEscala;
  folgas_semanais: DayOfWeek[];
  sunday_n: number;
  status: CollaboratorStatus;
  genero: string;
  inicio_na_empresa: string;
  data_desligamento: string;
  inicio_periodo: string;
  fim_periodo: string;
  pis_matricula: string;
  intervalo_automatico: boolean;
  intervalo_inicio: string;
  intervalo_duracao: number | null;
  carga_horaria_diaria: string;
  horario_entrada: string;
  horario_saida: string;
  jornadas_especiais: JornadaEspecial[];
  aviso_previo_reducao: number | null;
  controla_ponto: boolean;
  salario_base: string;
  vt_ativo: boolean;
  vt_passagens_dia: number;
  vt_dias_mes: string;
  funcao: string;
  carga_horaria_mensal: string;
  ponto_online: boolean;
}

const firstToken = (s: string) => (s || '').trim().split(/\s+/)[0] || '';

const emptyForm: FormData = {
  collaborator_name: '',
  display_name: '',
  sector: SECTORS[0],
  tipo_escala: '6x1',
  folgas_semanais: ['SEGUNDA'],
  sunday_n: 1,
  status: 'ATIVO',
  genero: 'M',
  inicio_na_empresa: new Date().toISOString().slice(0, 10),
  data_desligamento: '',
  inicio_periodo: '',
  fim_periodo: '',
  pis_matricula: '',
  intervalo_automatico: false,
  intervalo_inicio: '',
  intervalo_duracao: null,
  carga_horaria_diaria: '',
  horario_entrada: '',
  horario_saida: '',
  jornadas_especiais: [],
  aviso_previo_reducao: null,
  controla_ponto: true,
  salario_base: '',
  vt_ativo: false,
  vt_passagens_dia: 2,
  vt_dias_mes: '',
  funcao: '',
  carga_horaria_mensal: '',
  ponto_online: false,
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
  const [displayNameTouched, setDisplayNameTouched] = useState(false);
  const [profileCollaborator, setProfileCollaborator] = useState<Collaborator | null>(null);
  const [pisImportOpen, setPisImportOpen] = useState(false);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDisplayNameTouched(false);
    setDialogOpen(true);
  };

  const openEdit = (c: Collaborator) => {
    setEditingId(c.id);
    const currentDisplay = (c.display_name && c.display_name.trim()) || firstToken(c.collaborator_name);
    setForm({
      collaborator_name: c.collaborator_name,
      display_name: currentDisplay,
      sector: c.sector,
      tipo_escala: c.tipo_escala,
      folgas_semanais: c.folgas_semanais,
      sunday_n: c.sunday_n,
      status: c.status,
      genero: c.genero ?? 'M',
      inicio_na_empresa: c.inicio_na_empresa ?? '',
      data_desligamento: c.data_desligamento ?? '',
      inicio_periodo: c.inicio_periodo ?? '',
      fim_periodo: c.fim_periodo ?? '',
      pis_matricula: c.pis_matricula ?? '',
      intervalo_automatico: c.intervalo_automatico ?? false,
      intervalo_inicio: c.intervalo_inicio ?? '',
      intervalo_duracao: c.intervalo_duracao ?? null,
      carga_horaria_diaria: c.carga_horaria_diaria ?? '',
      horario_entrada: c.horario_entrada ?? '',
      horario_saida: c.horario_saida ?? '',
      jornadas_especiais: c.jornadas_especiais ?? [],
      aviso_previo_reducao: c.aviso_previo_reducao ?? null,
      controla_ponto: c.controla_ponto ?? true,
      salario_base: c.salario_base != null ? String(c.salario_base) : '',
      vt_ativo: c.vt_ativo ?? false,
      vt_passagens_dia: c.vt_passagens_dia ?? 2,
      vt_dias_mes: c.vt_dias_mes != null ? String(c.vt_dias_mes) : '',
      funcao: c.funcao ?? '',
      carga_horaria_mensal: c.carga_horaria_mensal != null ? String(c.carga_horaria_mensal) : '',
      ponto_online: c.ponto_online ?? false,
    });
    // Editing: only auto-sync if the current display matches the first-token (i.e. wasn't customized)
    setDisplayNameTouched(currentDisplay !== firstToken(c.collaborator_name));
    setDialogOpen(true);
  };

  const handleFullNameChange = (newFullName: string) => {
    setForm(f => ({
      ...f,
      collaborator_name: newFullName,
      display_name: displayNameTouched ? f.display_name : firstToken(newFullName),
    }));
  };

  const handleDisplayNameChange = (newShort: string) => {
    setDisplayNameTouched(true);
    setForm(f => ({ ...f, display_name: newShort }));
  };

  const toInput = (f: FormData): CollaboratorInput => ({
    collaborator_name: f.collaborator_name,
    display_name: (f.display_name || '').trim() || firstToken(f.collaborator_name) || null,
    sector: f.sector,
    tipo_escala: f.tipo_escala,
    folgas_semanais: f.folgas_semanais,
    sunday_n: f.sunday_n,
    status: f.status,
    genero: f.genero,
    inicio_na_empresa: f.inicio_na_empresa || null,
    data_desligamento: f.data_desligamento || null,
    inicio_periodo: f.inicio_periodo || null,
    fim_periodo: f.fim_periodo || null,
    pis_matricula: f.pis_matricula || null,
    intervalo_automatico: f.intervalo_automatico,
    intervalo_inicio: f.intervalo_inicio || null,
    intervalo_duracao: f.intervalo_duracao,
    carga_horaria_diaria: f.carga_horaria_diaria || null,
    horario_entrada: f.horario_entrada || null,
    horario_saida: f.horario_saida || null,
    jornadas_especiais: f.jornadas_especiais.length > 0 ? f.jornadas_especiais : null,
    aviso_previo_reducao: f.aviso_previo_reducao,
    controla_ponto: f.controla_ponto,
    salario_base: f.salario_base ? parseFloat(f.salario_base.replace(',', '.')) : null,
    vt_ativo: f.vt_ativo,
    vt_passagens_dia: f.vt_passagens_dia,
    vt_dias_mes: f.vt_dias_mes ? parseInt(f.vt_dias_mes) : null,
    funcao: f.funcao || null,
    carga_horaria_mensal: f.carga_horaria_mensal ? parseInt(f.carga_horaria_mensal) : null,
    ponto_online: f.ponto_online,
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

  // Sort each sector alphabetically (pt-BR, ignore accents/case)
  for (const sector of Object.keys(grouped)) {
    grouped[sector].sort((a, b) =>
      a.collaborator_name.localeCompare(b.collaborator_name, 'pt-BR', { sensitivity: 'base' })
    );
  }

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
                          {c.controla_ponto !== false && <span className="ml-1 text-muted-foreground" title="Controle de ponto ativo">🕐</span>}
                        </button>
                        {c.display_name && c.display_name !== firstToken(c.collaborator_name) && (
                          <span className="block text-[11px] text-muted-foreground mt-0.5">
                            Escala: {c.display_name}
                          </span>
                        )}
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
              <Label>Nome Completo</Label>
              <Input
                value={form.collaborator_name}
                onChange={e => handleFullNameChange(e.target.value)}
                placeholder="ex: ALINE DE SA ANTUNES"
              />
            </div>

            <div className="space-y-2">
              <Label>Nome na Escala</Label>
              <Input
                value={form.display_name}
                onChange={e => handleDisplayNameChange(e.target.value)}
                placeholder="ex: ALINE"
              />
              <p className="text-[11px] text-muted-foreground">
                Aparece na grade da escala. Auto-preenche com o primeiro nome até você editar manualmente.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
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
              <div className="space-y-2">
                <Label>Gênero</Label>
                <Select value={form.genero} onValueChange={v => setForm(f => ({ ...f, genero: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Masculino</SelectItem>
                    <SelectItem value="F">Feminino</SelectItem>
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

            {/* Função e CH Mensal */}
            <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
              <p className="text-sm font-medium">Função / Carga Horária</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Função/Cargo</Label>
                  <Input
                    list="funcoes-list"
                    value={form.funcao}
                    onChange={e => setForm(f => ({ ...f, funcao: e.target.value }))}
                    placeholder="Ex: Pizzaiolo Pleno, Garçonete Junior..."
                  />
                  <datalist id="funcoes-list">
                    {Array.from(new Set(collaborators.map(c => c.funcao).filter(Boolean))).sort().map(fn => (
                      <option key={fn} value={fn!} />
                    ))}
                  </datalist>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Carga Horária Mensal (horas)</Label>
                  <Input
                    type="number"
                    value={form.carga_horaria_mensal}
                    onChange={e => setForm(f => ({ ...f, carga_horaria_mensal: e.target.value }))}
                    placeholder="Ex: 220"
                    min={1}
                  />
                </div>
              </div>
            </div>

            {/* Jornada de trabalho */}
            <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
              <p className="text-sm font-medium">Jornada de Trabalho</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Horário de Entrada</Label>
                  <Input type="time" value={form.horario_entrada} onChange={e => setForm(f => ({ ...f, horario_entrada: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Horário de Saída</Label>
                  <Input type="time" value={form.horario_saida} onChange={e => setForm(f => ({ ...f, horario_saida: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">CH Diária (HH:MM)</Label>
                  <Input type="time" value={form.carga_horaria_diaria} onChange={e => setForm(f => ({ ...f, carga_horaria_diaria: e.target.value }))} />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">CH Diária usada como CH Prevista no espelho. Padrão: 07:00</p>

              {/* Jornadas especiais */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Jornadas Especiais por Dia</Label>
                  <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setForm(f => ({ ...f, jornadas_especiais: [...f.jornadas_especiais, { dias: [], entrada: '', saida: '', ch: '' }] }))}>
                    <Plus className="w-3 h-3 mr-1" /> Adicionar
                  </Button>
                </div>
                {form.jornadas_especiais.map((je, idx) => (
                  <div key={idx} className="border rounded p-2 space-y-2 bg-background">
                    <div className="flex flex-wrap gap-2">
                      {(['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'] as const).map(dia => (
                        <label key={dia} className="flex items-center gap-1 text-[11px] cursor-pointer">
                          <Checkbox
                            checked={je.dias.includes(dia)}
                            onCheckedChange={(checked) => {
                              const newJE = [...form.jornadas_especiais];
                              newJE[idx] = { ...newJE[idx], dias: checked ? [...newJE[idx].dias, dia] : newJE[idx].dias.filter(d => d !== dia) };
                              setForm(f => ({ ...f, jornadas_especiais: newJE }));
                            }}
                          />
                          {dia.charAt(0).toUpperCase() + dia.slice(1, 3)}
                        </label>
                      ))}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Input type="time" className="h-7 text-xs" value={je.entrada} onChange={e => { const n = [...form.jornadas_especiais]; n[idx] = { ...n[idx], entrada: e.target.value }; setForm(f => ({ ...f, jornadas_especiais: n })); }} placeholder="Entrada" />
                      <Input type="time" className="h-7 text-xs" value={je.saida} onChange={e => { const n = [...form.jornadas_especiais]; n[idx] = { ...n[idx], saida: e.target.value }; setForm(f => ({ ...f, jornadas_especiais: n })); }} placeholder="Saída" />
                      <Input type="time" className="h-7 text-xs" value={je.ch} onChange={e => { const n = [...form.jornadas_especiais]; n[idx] = { ...n[idx], ch: e.target.value }; setForm(f => ({ ...f, jornadas_especiais: n })); }} placeholder="CH" />
                    </div>
                    <Button type="button" variant="ghost" size="sm" className="h-5 text-[10px] text-destructive" onClick={() => setForm(f => ({ ...f, jornadas_especiais: f.jornadas_especiais.filter((_, i) => i !== idx) }))}>
                      Remover
                    </Button>
                  </div>
                ))}
              </div>

              {/* Aviso prévio redução */}
              {form.status === 'AVISO_PREVIO' && (
                <div className="space-y-1">
                  <Label className="text-xs">Redução diária (Aviso Prévio - Art. 488 CLT)</Label>
                  <Select value={form.aviso_previo_reducao ? String(form.aviso_previo_reducao) : ''} onValueChange={v => setForm(f => ({ ...f, aviso_previo_reducao: v ? Number(v) : null }))}>
                    <SelectTrigger className="h-8"><SelectValue placeholder="Sem redução" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2 horas a menos por dia</SelectItem>
                      <SelectItem value="7">7 dias corridos no final</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Controle de ponto */}
            <div className="flex items-center justify-between border rounded-lg p-3 bg-muted/30">
              <div>
                <p className="text-sm font-medium">Controlar batidas no Espelho de Ponto</p>
                <p className="text-[11px] text-muted-foreground">Desative para colaboradores que não precisam de controle de ponto</p>
              </div>
              <Switch
                checked={form.controla_ponto}
                onCheckedChange={v => setForm(f => ({ ...f, controla_ponto: v }))}
              />
            </div>

            {/* Ponto Online */}
            <div className="flex items-center justify-between border rounded-lg p-3 bg-muted/30">
              <div>
                <p className="text-sm font-medium">Ponto Online</p>
                <p className="text-[11px] text-muted-foreground">Permite que o colaborador registre batidas pelo sistema</p>
              </div>
              <Switch
                checked={form.ponto_online}
                onCheckedChange={v => setForm(f => ({ ...f, ponto_online: v }))}
              />
            </div>

            {/* Financeiro / Benefícios */}
            <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
              <p className="text-sm font-medium">Financeiro / Benefícios</p>
              <div className="space-y-1">
                <Label className="text-xs">Salário Base (R$)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={form.salario_base}
                  onChange={e => setForm(f => ({ ...f, salario_base: e.target.value }))}
                  placeholder="Ex: 2592.00"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Recebe Vale Transporte?</p>
                  <p className="text-[11px] text-muted-foreground">Ativar para colaboradores com VT</p>
                </div>
                <Switch
                  checked={form.vt_ativo}
                  onCheckedChange={v => setForm(f => ({ ...f, vt_ativo: v }))}
                />
              </div>
              {form.vt_ativo && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Passagens por dia</Label>
                    <Input
                      type="number"
                      min={1}
                      max={6}
                      value={form.vt_passagens_dia}
                      onChange={e => setForm(f => ({ ...f, vt_passagens_dia: Number(e.target.value) || 2 }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Dias úteis no mês</Label>
                    <Input
                      type="number"
                      min={1}
                      max={31}
                      value={form.vt_dias_mes}
                      onChange={e => setForm(f => ({ ...f, vt_dias_mes: e.target.value }))}
                      placeholder="Padrão: 26 (6x1)"
                    />
                  </div>
                </div>
              )}
            </div>

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
