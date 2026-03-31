import { useState, useMemo, useEffect } from 'react';
import { useCollaborators } from '@/hooks/useCollaborators';
import { useBonusFuncaoPontos, useCreateBonusFuncao, useUpdateBonusFuncao, useDeleteBonusFuncao, useBonus10Monthly, useUpsertBonus10Monthly } from '@/hooks/useBonus10';
import type { BonusFuncaoPontos, Bonus10Monthly } from '@/hooks/useBonus10';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Download, Save, Settings, Users, DollarSign, Percent, Plus, Pencil, Trash2, RefreshCw, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const IMPORT_COLLABORATORS = [
  { nome: 'JENIFFER', funcao: 'LIDER DE SALÃO', carga_horaria_mensal: 220 },
  { nome: 'EMILLY', funcao: 'GARÇONETE PLENA', carga_horaria_mensal: 180 },
  { nome: 'WELLINGTON', funcao: 'GARÇOM PLENO', carga_horaria_mensal: 180 },
  { nome: 'JULIA', funcao: 'GARÇONETE PLENA', carga_horaria_mensal: 180 },
  { nome: 'PAULO', funcao: 'GARÇOM JUNIOR', carga_horaria_mensal: 180 },
  { nome: 'ALANA', funcao: 'GARÇONETE JUNIOR', carga_horaria_mensal: 220 },
  { nome: 'DINHO', funcao: 'LIDER DE COZINHA', carga_horaria_mensal: 220 },
  { nome: 'ALISSON', funcao: 'VICE LIDER DE COZINHA', carga_horaria_mensal: 220 },
  { nome: 'GLEPSON', funcao: 'LIDER DE PRODUÇÃO', carga_horaria_mensal: 220 },
  { nome: 'ELIONEL', funcao: 'PIZZAIOLO PLENO', carga_horaria_mensal: 220 },
  { nome: 'JAVIER', funcao: 'PIZZAIOLO PLENO', carga_horaria_mensal: 220 },
  { nome: 'ALINE', funcao: 'PIZZAIOLO PLENO', carga_horaria_mensal: 220 },
  { nome: 'JOSÉ', funcao: 'PIZZAIOLO JUNIOR', carga_horaria_mensal: 220 },
  { nome: 'CICERO', funcao: 'PIZZAIOLO JUNIOR', carga_horaria_mensal: 220 },
  { nome: 'DAVI', funcao: 'PIZZAIOLO JUNIOR', carga_horaria_mensal: 220 },
  { nome: 'DIEGO', funcao: 'AUXILIAR PIZZAIOLO', carga_horaria_mensal: 220 },
  { nome: 'SHEYLA', funcao: 'AUXILIAR PIZZAIOLO', carga_horaria_mensal: 220 },
  { nome: 'LUIZ', funcao: 'AUXILIAR PIZZAIOLO', carga_horaria_mensal: 220 },
  { nome: 'RICHARD', funcao: 'AUXILIAR PIZZAIOLO', carga_horaria_mensal: 220 },
  { nome: 'GABRIEL', funcao: 'ATENDENTE 3', carga_horaria_mensal: 180 },
  { nome: 'JOHNNY', funcao: 'ATENDENTE 2', carga_horaria_mensal: 90 },
  { nome: 'KAYLANE', funcao: 'ATENDENTE 1', carga_horaria_mensal: 150 },
  { nome: 'ALICIA', funcao: 'LIMPEZA', carga_horaria_mensal: 180 },
  { nome: 'ANA JULIA', funcao: 'ADM 3', carga_horaria_mensal: 220 },
  { nome: 'LUCAS MENEZES', funcao: 'ADM 2', carga_horaria_mensal: 220, exactMatch: 'LUCAS MENEZES' },
  { nome: 'LUANA', funcao: 'ADM 1', carga_horaria_mensal: 220 },
] as const;

const IMPORT_FUNCOES = [
  { funcao: 'LIDER DE SALÃO', carga_horaria: 220, pontos: 6 },
  { funcao: 'GARÇONETE PLENA', carga_horaria: 180, pontos: 4.9 },
  { funcao: 'GARÇOM PLENO', carga_horaria: 180, pontos: 4.9 },
  { funcao: 'GARÇOM JUNIOR', carga_horaria: 180, pontos: 4.1 },
  { funcao: 'GARÇONETE JUNIOR', carga_horaria: 220, pontos: 5 },
  { funcao: 'LIDER DE COZINHA', carga_horaria: 220, pontos: 9 },
  { funcao: 'VICE LIDER DE COZINHA', carga_horaria: 220, pontos: 7 },
  { funcao: 'LIDER DE PRODUÇÃO', carga_horaria: 220, pontos: 7 },
  { funcao: 'PIZZAIOLO PLENO', carga_horaria: 220, pontos: 7 },
  { funcao: 'PIZZAIOLO JUNIOR', carga_horaria: 220, pontos: 5 },
  { funcao: 'AUXILIAR PIZZAIOLO', carga_horaria: 220, pontos: 3 },
  { funcao: 'ATENDENTE 3', carga_horaria: 180, pontos: 6.9 },
  { funcao: 'ATENDENTE 2', carga_horaria: 90, pontos: 1 },
  { funcao: 'ATENDENTE 1', carga_horaria: 150, pontos: 1.5 },
  { funcao: 'LIMPEZA', carga_horaria: 180, pontos: 2.4 },
  { funcao: 'ADM 1', carga_horaria: 220, pontos: 11 },
  { funcao: 'ADM 2', carga_horaria: 220, pontos: 9 },
  { funcao: 'ADM 3', carga_horaria: 220, pontos: 5 },
] as const;

export default function Bonus10() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const { toast } = useToast();
  const { usuario, session } = useAuth();

  const { data: collaborators = [] } = useCollaborators();
  const { data: funcaoPontos = [] } = useBonusFuncaoPontos();
  const { data: monthlyData = [], isLoading } = useBonus10Monthly(selectedMonth, selectedYear);
  const upsertMonthly = useUpsertBonus10Monthly();

  const [receita, setReceita] = useState('');
  const [localOverrides, setLocalOverrides] = useState<Record<string, string>>({});
  const [configOpen, setConfigOpen] = useState(false);
  const [autoGenerated, setAutoGenerated] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState('');
  const [importDone, setImportDone] = useState(false);

  const activeCollabs = useMemo(() => collaborators.filter(c => c.status !== 'DESLIGADO'), [collaborators]);

  const funcaoMap = useMemo(() => {
    const m: Record<string, number> = {};
    funcaoPontos.forEach(fp => {
      m[`${fp.funcao?.toUpperCase()}|${fp.carga_horaria}`] = fp.pontos;
    });
    return m;
  }, [funcaoPontos]);

  const monthlyMap = useMemo(() => {
    const m: Record<string, typeof monthlyData[0]> = {};
    monthlyData.forEach(r => {
      m[r.collaborator_id] = r;
    });
    return m;
  }, [monthlyData]);

  const refreshMonthlyPoints = async (
    month: number,
    year: number,
    options?: {
      progressPrefix?: string;
      onProgress?: (message: string) => void;
      sourceCollaborators?: Pick<typeof collaborators[number], 'id' | 'funcao' | 'carga_horaria_mensal'>[];
      sourcePontos?: Pick<BonusFuncaoPontos, 'funcao' | 'carga_horaria' | 'pontos'>[];
      sourceMonthly?: Pick<Bonus10Monthly, 'id' | 'collaborator_id' | 'pontos_override'>[];
    }
  ) => {
    const monthlyRecords = options?.sourceMonthly ?? (
      await supabase
        .from('bonus_10_monthly')
        .select('id, collaborator_id, pontos_override')
        .eq('month', month)
        .eq('year', year)
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []) as Pick<Bonus10Monthly, 'id' | 'collaborator_id' | 'pontos_override'>[];
        })
    );

    const allCollabs = options?.sourceCollaborators ?? (
      await supabase
        .from('collaborators')
        .select('id, funcao, carga_horaria_mensal')
        .then(({ data, error }) => {
          if (error) throw error;
          return data ?? [];
        })
    );

    const pontosTable = options?.sourcePontos ?? (
      await supabase
        .from('bonus_funcao_pontos')
        .select('funcao, carga_horaria, pontos')
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []) as Pick<BonusFuncaoPontos, 'funcao' | 'carga_horaria' | 'pontos'>[];
        })
    );

    const collabMap = new Map(allCollabs.map(c => [c.id, c]));
    const pontosMap = new Map(pontosTable.map(p => [`${p.funcao.toUpperCase()}|${p.carga_horaria}`, p]));

    let updatedCount = 0;

    for (let i = 0; i < monthlyRecords.length; i++) {
      const record = monthlyRecords[i];
      options?.onProgress?.(`${options?.progressPrefix ?? 'Atualizando pontos'} ${i + 1} de ${monthlyRecords.length}...`);
      const collab = collabMap.get(record.collaborator_id);
      const funcao = collab?.funcao?.toUpperCase().trim();
      const cargaHoraria = collab?.carga_horaria_mensal ?? null;

      if (!funcao || !cargaHoraria) continue;

      const match = pontosMap.get(`${funcao}|${cargaHoraria}`);
      if (!match) continue;

      const { error } = await supabase
        .from('bonus_10_monthly')
        .update({
          pontos: match.pontos,
          funcao,
          carga_horaria: cargaHoraria,
        } as any)
        .eq('id', record.id);

      if (error) throw error;
      updatedCount++;
    }

    return updatedCount;
  };

  const handleImportFuncoes = async () => {
    if (!confirm('Importar funções, cargas horárias e pontos para todos os colaboradores? Isso vai sobrescrever os dados atuais.')) return;

    setImporting(true);
    try {
      for (let i = 0; i < IMPORT_COLLABORATORS.length; i++) {
        const c = IMPORT_COLLABORATORS[i];
        setImportProgress(`Atualizando colaborador ${i + 1} de ${IMPORT_COLLABORATORS.length}: ${c.nome}...`);

        let query = supabase
          .from('collaborators')
          .update({ funcao: c.funcao, carga_horaria_mensal: c.carga_horaria_mensal } as any);

        if ('exactMatch' in c && c.exactMatch) {
          query = query.eq('collaborator_name', c.exactMatch);
        } else {
          query = query.ilike('collaborator_name', `${c.nome}%`);
        }

        const { error } = await query;
        if (error) throw error;
      }

      setImportProgress('Limpando tabela de pontos...');
      const { error: deleteError } = await supabase
        .from('bonus_funcao_pontos' as any)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (deleteError) throw deleteError;

      let insertedCount = 0;
      for (let i = 0; i < IMPORT_FUNCOES.length; i++) {
        const funcao = IMPORT_FUNCOES[i];
        setImportProgress(`Inserindo função ${i + 1} de ${IMPORT_FUNCOES.length}: ${funcao.funcao}...`);
        const { data, error } = await supabase
          .from('bonus_funcao_pontos' as any)
          .insert(funcao as any)
          .select('id');
        if (error) throw error;
        insertedCount += data?.length ?? 0;
        console.log(`[Bônus 10%] ${insertedCount} registros inseridos em bonus_funcao_pontos`);
      }

      toast({ title: `${insertedCount} funções inseridas com sucesso` });

      const updatedCount = await refreshMonthlyPoints(3, 2026, {
        progressPrefix: 'Atualizando pontos de Março/2026',
        onProgress: setImportProgress,
      });

      setAutoGenerated(false);
      setImportProgress('Concluído! Recarregando...');
      setImportDone(true);
      toast({ title: `${updatedCount} registros atualizados com pontos` });
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      console.error(err);
      toast({ title: 'Erro na importação', variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  useEffect(() => {
    setAutoGenerated(false);
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    if (isLoading || autoGenerated) return;
    if (activeCollabs.length === 0) return;
    if (monthlyData.length > 0) {
      setAutoGenerated(true);
      return;
    }

    const rows = activeCollabs.map(c => {
      const key = `${(c.funcao || '').toUpperCase()}|${c.carga_horaria_mensal || 0}`;
      const pontos = funcaoMap[key] ?? 0;
      return {
        collaborator_id: c.id,
        month: selectedMonth,
        year: selectedYear,
        funcao: c.funcao || null,
        carga_horaria: c.carga_horaria_mensal || null,
        pontos,
        pontos_override: null,
        valor_ponto: null,
        valor_bonus: null,
        created_by: session?.user?.id || null,
      };
    });

    upsertMonthly.mutate(rows);
    setAutoGenerated(true);
  }, [isLoading, autoGenerated, activeCollabs, monthlyData, funcaoMap, selectedMonth, selectedYear, session, upsertMonthly]);

  const rows = useMemo(() => {
    const receitaNum = parseFloat(receita.replace(',', '.')) || 0;

    const collabRows = activeCollabs.map(c => {
      const record = monthlyMap[c.id];
      const funcao = c.funcao || null;
      const ch = c.carga_horaria_mensal || null;
      const key = `${(funcao || '').toUpperCase()}|${ch || 0}`;
      const pontosTabelaRaw = funcaoMap[key] ?? 0;
      const pontosTabela = record?.pontos ?? pontosTabelaRaw;

      const overrideStr = localOverrides[c.id];
      const pontosOverride = overrideStr !== undefined
        ? (overrideStr.trim() === '' ? null : parseFloat(overrideStr.replace(',', '.')))
        : record?.pontos_override ?? null;

      const pontosEfetivo = pontosOverride ?? pontosTabela;
      const hasMissing = !funcao || !ch;

      return {
        id: c.id,
        name: c.collaborator_name,
        sector: c.sector,
        ch,
        funcao,
        pontosTabela,
        pontosOverride,
        pontosEfetivo,
        hasMissing,
        hasOverride: pontosOverride != null,
      };
    });

    const totalPontos = collabRows.reduce((s, r) => s + (r.pontosEfetivo || 0), 0);
    const valorPonto = totalPontos > 0 ? receitaNum / totalPontos : 0;

    return {
      collabRows: collabRows.map(r => ({
        ...r,
        valorBonus: +(r.pontosEfetivo * valorPonto).toFixed(2),
      })),
      totalPontos,
      valorPonto,
      receita: receitaNum,
    };
  }, [activeCollabs, monthlyMap, funcaoMap, localOverrides, receita]);

  const sectors = useMemo(() => {
    const groups: Record<string, typeof rows.collabRows> = {};
    rows.collabRows.forEach(r => {
      if (!groups[r.sector]) groups[r.sector] = [];
      groups[r.sector].push(r);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [rows.collabRows]);

  const handleSaveAll = async () => {
    const allRows = rows.collabRows.map(r => ({
      collaborator_id: r.id,
      month: selectedMonth,
      year: selectedYear,
      funcao: r.funcao,
      carga_horaria: r.ch,
      pontos: r.pontosTabela,
      pontos_override: r.pontosOverride,
      valor_ponto: +rows.valorPonto.toFixed(4),
      valor_bonus: r.valorBonus,
      created_by: session?.user?.id || null,
    }));

    try {
      await upsertMonthly.mutateAsync(allRows);
      setLocalOverrides({});
      toast({ title: 'Dados salvos com sucesso!' });
    } catch {
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    }
  };

  const handleRecalculate = async () => {
    try {
      setImporting(true);
      setImportProgress(`Recalculando pontos de ${MONTHS[selectedMonth - 1]}/${selectedYear}...`);
      const updatedCount = await refreshMonthlyPoints(selectedMonth, selectedYear, {
        progressPrefix: `Recalculando ${MONTHS[selectedMonth - 1]}/${selectedYear}`,
        onProgress: setImportProgress,
        sourceCollaborators: activeCollabs.map(c => ({
          id: c.id,
          funcao: c.funcao,
          carga_horaria_mensal: c.carga_horaria_mensal,
        })),
        sourcePontos: funcaoPontos,
        sourceMonthly: monthlyData.map(r => ({
          id: r.id,
          collaborator_id: r.collaborator_id,
          pontos_override: r.pontos_override,
        })),
      });
      setAutoGenerated(false);
      setLocalOverrides({});
      toast({ title: `${updatedCount} registros atualizados com pontos` });
    } catch {
      toast({ title: 'Erro ao recalcular', variant: 'destructive' });
    } finally {
      setImporting(false);
      setImportProgress('');
    }
  };

  const handleExport = () => {
    const data: any[] = [];
    let seq = 0;
    sectors.forEach(([sector, sectorRows]) => {
      sectorRows.forEach(r => {
        seq++;
        data.push({
          '#': seq,
          'Setor': sector,
          'Colaborador': r.name,
          'C.H.': r.ch ?? '',
          'Função': r.funcao ?? '',
          'Pontos (tabela)': r.pontosTabela,
          'Pontos (efetivo)': r.pontosEfetivo,
          'Valor Bônus (R$)': r.valorBonus,
        });
      });
      const sectorTotal = sectorRows.reduce((s, r) => s + r.pontosEfetivo, 0);
      const sectorBonus = sectorRows.reduce((s, r) => s + r.valorBonus, 0);
      data.push({
        '#': '',
        'Setor': '',
        'Colaborador': `SUBTOTAL ${sector}`,
        'C.H.': '',
        'Função': '',
        'Pontos (tabela)': '',
        'Pontos (efetivo)': +sectorTotal.toFixed(2),
        'Valor Bônus (R$)': +sectorBonus.toFixed(2),
      });
    });
    data.push({
      '#': '',
      'Setor': '',
      'Colaborador': 'TOTAL GERAL',
      'C.H.': '',
      'Função': '',
      'Pontos (tabela)': '',
      'Pontos (efetivo)': +rows.totalPontos.toFixed(2),
      'Valor Bônus (R$)': +rows.receita.toFixed(2),
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bônus 10%');
    XLSX.writeFile(wb, `bonus-10-${String(selectedMonth).padStart(2, '0')}-${selectedYear}.xlsx`);
  };

  const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold flex items-center gap-2"><Percent className="w-5 h-5" /> Bônus 10%</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={String(selectedMonth)} onValueChange={v => setSelectedMonth(Number(v))}>
            <SelectTrigger className="w-36 h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-24 h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{[2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Users className="w-3.5 h-3.5" /> Participantes</div>
          <p className="text-xl font-bold mt-1">{activeCollabs.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Percent className="w-3.5 h-3.5" /> Total Pontos</div>
          <p className="text-xl font-bold mt-1">{fmt(rows.totalPontos)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><DollarSign className="w-3.5 h-3.5" /> Receita 10%</div>
          <p className="text-xl font-bold mt-1">R$ {fmt(rows.receita)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><DollarSign className="w-3.5 h-3.5" /> Valor/Ponto</div>
          <p className="text-xl font-bold mt-1">R$ {rows.valorPonto.toFixed(4)}</p>
        </CardContent></Card>
      </div>

      {/* Receita input + actions */}
      <Card><CardContent className="p-4 flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[200px] space-y-1">
          <Label className="text-sm font-medium">Receita de Taxa de Serviço (R$)</Label>
          <Input
            value={receita}
            onChange={e => setReceita(e.target.value)}
            placeholder="Ex: 25000.00"
            className="text-lg font-semibold h-11"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => setConfigOpen(true)}><Settings className="w-4 h-4 mr-1" /> Configurar pontos</Button>
        <Button variant="outline" size="sm" onClick={handleRecalculate}><RefreshCw className="w-4 h-4 mr-1" /> Recalcular</Button>
        <Button size="sm" onClick={handleSaveAll} disabled={upsertMonthly.isPending}><Save className="w-4 h-4 mr-1" /> Salvar tudo</Button>
        <Button variant="outline" size="sm" onClick={handleExport}><Download className="w-4 h-4 mr-1" /> Excel</Button>
        {usuario?.perfil === 'admin' && !importDone && (
          <Button variant="outline" size="sm" onClick={handleImportFuncoes} disabled={importing} className="border-amber-400 text-amber-700 hover:bg-amber-50">
            <Upload className="w-4 h-4 mr-1" /> Importar funções e pontos 10%
          </Button>
        )}
        {importing && (
          <div className="w-full mt-2">
            <p className="text-xs text-muted-foreground mb-1">{importProgress}</p>
            <Progress value={undefined} className="h-2" />
          </div>
        )}
      </CardContent></Card>

      {/* Main table grouped by sector */}
      <Card><CardContent className="p-0 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-10 text-xs">#</TableHead>
              <TableHead className="text-xs">Colaborador</TableHead>
              <TableHead className="text-xs text-center w-16">C.H.</TableHead>
              <TableHead className="text-xs">Função</TableHead>
              <TableHead className="text-xs text-center w-24">Pontos (tab.)</TableHead>
              <TableHead className="text-xs text-center w-28">Pontos (efetivo)</TableHead>
              <TableHead className="text-xs text-right w-32">Valor Bônus</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sectors.map(([sector, sectorRows]) => {
              const sectorPontos = sectorRows.reduce((s, r) => s + r.pontosEfetivo, 0);
              const sectorBonus = sectorRows.reduce((s, r) => s + r.valorBonus, 0);
              let seq = 0;
              return (
                <SectorGroup
                  key={sector}
                  sector={sector}
                  rows={sectorRows}
                  sectorPontos={sectorPontos}
                  sectorBonus={sectorBonus}
                  localOverrides={localOverrides}
                  setLocalOverrides={setLocalOverrides}
                  fmt={fmt}
                />
              );
            })}
            {/* Grand total */}
            <TableRow className="bg-muted font-bold border-t-2">
              <TableCell colSpan={4} className="text-xs">TOTAL GERAL</TableCell>
              <TableCell className="text-xs text-center"></TableCell>
              <TableCell className="text-xs text-center">{fmt(rows.totalPontos)}</TableCell>
              <TableCell className="text-xs text-right">R$ {fmt(rows.receita)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent></Card>

      {/* Config dialog */}
      <FuncaoPontosDialog open={configOpen} onOpenChange={setConfigOpen} pontos={funcaoPontos} />
    </div>
  );
}

function SectorGroup({ sector, rows: sectorRows, sectorPontos, sectorBonus, localOverrides, setLocalOverrides, fmt }: {
  sector: string;
  rows: any[];
  sectorPontos: number;
  sectorBonus: number;
  localOverrides: Record<string, string>;
  setLocalOverrides: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  fmt: (n: number) => string;
}) {
  return (
    <>
      <TableRow className="bg-primary/5 border-t">
        <TableCell colSpan={7} className="text-xs font-bold text-primary py-1.5">{sector}</TableCell>
      </TableRow>
      {sectorRows.map((r, i) => (
        <TableRow key={r.id} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
          <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
          <TableCell className="text-xs font-medium">
            {r.name}
            {r.hasMissing && <Badge variant="outline" className="ml-1.5 text-[9px] border-amber-300 text-amber-600">⚠️ Configurar</Badge>}
          </TableCell>
          <TableCell className="text-xs text-center">{r.ch ?? '—'}</TableCell>
          <TableCell className="text-xs">{r.funcao ?? '—'}</TableCell>
          <TableCell className="text-xs text-center text-muted-foreground">{r.pontosTabela}</TableCell>
          <TableCell className="text-xs text-center">
            <Input
              className="h-7 w-20 text-xs text-center mx-auto"
              value={localOverrides[r.id] ?? (r.pontosOverride != null ? String(r.pontosOverride) : '')}
              onChange={e => setLocalOverrides(p => ({ ...p, [r.id]: e.target.value }))}
              placeholder={String(r.pontosTabela)}
            />
            {r.hasOverride && <Badge className="text-[8px] mt-0.5 bg-blue-100 text-blue-700 border-blue-200" variant="outline">ajustado</Badge>}
          </TableCell>
          <TableCell className="text-xs text-right font-medium">R$ {fmt(r.valorBonus)}</TableCell>
        </TableRow>
      ))}
      <TableRow className="bg-muted/40">
        <TableCell colSpan={4} className="text-xs font-semibold">Subtotal {sector}</TableCell>
        <TableCell className="text-xs text-center"></TableCell>
        <TableCell className="text-xs text-center font-semibold">{fmt(sectorPontos)}</TableCell>
        <TableCell className="text-xs text-right font-semibold">R$ {fmt(sectorBonus)}</TableCell>
      </TableRow>
    </>
  );
}

function FuncaoPontosDialog({ open, onOpenChange, pontos }: { open: boolean; onOpenChange: (v: boolean) => void; pontos: BonusFuncaoPontos[] }) {
  const createMut = useCreateBonusFuncao();
  const updateMut = useUpdateBonusFuncao();
  const deleteMut = useDeleteBonusFuncao();
  const { toast } = useToast();

  const [newFuncao, setNewFuncao] = useState('');
  const [newCh, setNewCh] = useState('');
  const [newPontos, setNewPontos] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editPontos, setEditPontos] = useState('');

  const handleAdd = async () => {
    if (!newFuncao.trim() || !newCh || !newPontos) return;
    try {
      await createMut.mutateAsync({ funcao: newFuncao.trim().toUpperCase(), carga_horaria: parseInt(newCh), pontos: parseFloat(newPontos.replace(',', '.')) });
      setNewFuncao(''); setNewCh(''); setNewPontos('');
      toast({ title: 'Função adicionada' });
    } catch {
      toast({ title: 'Erro ao adicionar', variant: 'destructive' });
    }
  };

  const handleSaveEdit = async (id: string) => {
    try {
      await updateMut.mutateAsync({ id, pontos: parseFloat(editPontos.replace(',', '.')) });
      setEditId(null);
      toast({ title: 'Pontos atualizados' });
    } catch {
      toast({ title: 'Erro ao atualizar', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta função?')) return;
    try {
      await deleteMut.mutateAsync(id);
      toast({ title: 'Função removida' });
    } catch {
      toast({ title: 'Erro ao remover', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Configurar Pontos por Função</DialogTitle></DialogHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Função</TableHead>
              <TableHead className="text-xs text-center">C.H.</TableHead>
              <TableHead className="text-xs text-center">Pontos</TableHead>
              <TableHead className="text-xs w-20">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pontos.map(p => (
              <TableRow key={p.id}>
                <TableCell className="text-xs">{p.funcao}</TableCell>
                <TableCell className="text-xs text-center">{p.carga_horaria}h</TableCell>
                <TableCell className="text-xs text-center">
                  {editId === p.id ? (
                    <Input className="h-7 w-20 text-xs text-center mx-auto" value={editPontos} onChange={e => setEditPontos(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSaveEdit(p.id)} autoFocus />
                  ) : p.pontos}
                </TableCell>
                <TableCell className="flex gap-1">
                  {editId === p.id ? (
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => handleSaveEdit(p.id)}>✓</Button>
                  ) : (
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setEditId(p.id); setEditPontos(String(p.pontos)); }}><Pencil className="w-3 h-3" /></Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDelete(p.id)}><Trash2 className="w-3 h-3" /></Button>
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell><Input className="h-7 text-xs" value={newFuncao} onChange={e => setNewFuncao(e.target.value)} placeholder="Função" /></TableCell>
              <TableCell><Input className="h-7 text-xs text-center" type="number" value={newCh} onChange={e => setNewCh(e.target.value)} placeholder="CH" /></TableCell>
              <TableCell><Input className="h-7 text-xs text-center" value={newPontos} onChange={e => setNewPontos(e.target.value)} placeholder="Pontos" /></TableCell>
              <TableCell><Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={handleAdd} disabled={createMut.isPending}><Plus className="w-3 h-3" /></Button></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
}
