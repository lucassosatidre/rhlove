import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, TrendingUp, TrendingDown, AlertTriangle, Plus, ArrowUpDown, Download, Pencil, Gift } from 'lucide-react';
import { useCollaborators } from '@/hooks/useCollaborators';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  useBHTransactions,
  useInsertBHTransaction,
  useDeleteBHTransactionsBySemester,
  useInsertBHFolga,
  getSemesterStart,
  getSemesterOptions,
  getSemesterMonths,
  getSemesterLabel,
  type BHTransaction,
} from '@/hooks/useBancoHoras';
import * as XLSX from 'xlsx';

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  auto_espelho: { label: 'Espelho', color: 'bg-muted text-muted-foreground' },
  folga_bh: { label: 'Folga BH', color: 'bg-blue-100 text-blue-700' },
  saldo_anterior: { label: 'Saldo Anterior', color: 'bg-green-100 text-green-700' },
  acerto_semestre: { label: 'Acerto', color: 'bg-orange-100 text-orange-700' },
  ajuste_manual: { label: 'Ajuste Manual', color: 'bg-yellow-100 text-yellow-700' },
};

function fmtMinToHHMM(min: number): string {
  const abs = Math.abs(min);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const sign = min < 0 ? '-' : (min > 0 ? '+' : '');
  return `${sign}${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function parseHHMM(str: string): number | null {
  const neg = str.startsWith('-');
  const clean = str.replace(/^[+-]/, '').trim();
  const match = clean.match(/^(\d{1,3}):(\d{2})$/);
  if (!match) return null;
  const mins = parseInt(match[1]) * 60 + parseInt(match[2]);
  return neg ? -mins : mins;
}

export default function BancoHoras() {
  const now = new Date();
  const [semesterStart, setSemesterStart] = useState(getSemesterStart(now));
  const semesterOptions = useMemo(() => getSemesterOptions(), []);
  const semesterMonths = useMemo(() => getSemesterMonths(semesterStart), [semesterStart]);

  const { data: collaborators = [] } = useCollaborators();
  const { data: allTransactions = [], isLoading } = useBHTransactions(semesterStart);
  const insertTx = useInsertBHTransaction();
  const deleteTx = useDeleteBHTransactionsBySemester();
  const insertFolga = useInsertBHFolga();
  const { usuario, session } = useAuth();
  const isAdmin = usuario?.perfil === 'admin';

  const [sortBy, setSortBy] = useState<'name' | 'saldo'>('name');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [selectedCollabId, setSelectedCollabId] = useState<string | null>(null);

  // Action modals
  const [folgaOpen, setFolgaOpen] = useState(false);
  const [saldoAnteriorOpen, setSaldoAnteriorOpen] = useState(false);
  const [ajusteOpen, setAjusteOpen] = useState(false);

  // Form states
  const [formCollabId, setFormCollabId] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formValue, setFormValue] = useState('');
  const [formReason, setFormReason] = useState('');
  const [formType, setFormType] = useState<'credito' | 'debito'>('credito');

  const activeCollabs = useMemo(
    () => collaborators.filter(c => c.status !== 'DESLIGADO'),
    [collaborators]
  );

  const sectors = useMemo(
    () => [...new Set(activeCollabs.map(c => c.sector))].sort(),
    [activeCollabs]
  );

  // Calculate balances per collaborator
  const collabBalances = useMemo(() => {
    const map = new Map<string, { credit: number; debit: number; balance: number }>();
    for (const c of activeCollabs) {
      map.set(c.id, { credit: 0, debit: 0, balance: 0 });
    }
    for (const tx of allTransactions) {
      const entry = map.get(tx.collaborator_id);
      if (entry) {
        entry.credit += tx.credit_minutes;
        entry.debit += tx.debit_minutes;
        entry.balance += tx.credit_minutes - tx.debit_minutes;
      }
    }
    return map;
  }, [activeCollabs, allTransactions]);

  const filteredCollabs = useMemo(() => {
    let list = activeCollabs;
    if (sectorFilter !== 'all') list = list.filter(c => c.sector === sectorFilter);
    if (sortBy === 'name') list = [...list].sort((a, b) => a.collaborator_name.localeCompare(b.collaborator_name));
    else list = [...list].sort((a, b) => (collabBalances.get(a.id)?.balance ?? 0) - (collabBalances.get(b.id)?.balance ?? 0));
    return list;
  }, [activeCollabs, sectorFilter, sortBy, collabBalances]);

  // Summary cards
  const summary = useMemo(() => {
    let positive = 0, negative = 0, totalPos = 0, totalNeg = 0, over20 = 0, under20 = 0;
    for (const c of activeCollabs) {
      const bal = collabBalances.get(c.id)?.balance ?? 0;
      if (bal > 0) { positive++; totalPos += bal; }
      if (bal < 0) { negative++; totalNeg += bal; }
      if (bal > 20 * 60) over20++;
      if (bal < -20 * 60) under20++;
    }
    return { total: activeCollabs.length, positive, negative, totalPos, totalNeg, over20, under20 };
  }, [activeCollabs, collabBalances]);

  // Extrato for selected collaborator
  const selectedCollab = activeCollabs.find(c => c.id === selectedCollabId);
  const selectedTransactions = useMemo(
    () => allTransactions.filter(tx => tx.collaborator_id === selectedCollabId).sort((a, b) => a.transaction_date.localeCompare(b.transaction_date) || a.created_at.localeCompare(b.created_at)),
    [allTransactions, selectedCollabId]
  );

  const handleConcederFolga = useCallback(async () => {
    if (!formCollabId || !formDate || !formValue) return;
    const mins = parseHHMM(formValue);
    if (mins === null || mins <= 0) { toast.error('Valor inválido'); return; }
    const bal = collabBalances.get(formCollabId)?.balance ?? 0;
    if (bal < mins && !confirm(`Saldo insuficiente (atual: ${fmtMinToHHMM(bal)}). Deseja conceder mesmo assim?`)) return;
    try {
      await insertFolga.mutateAsync({
        collaborator_id: formCollabId,
        folga_date: formDate,
        hours_debited: mins,
        reason: formReason,
        created_by: session?.user.id ?? null,
        updated_at: new Date().toISOString(),
      });
      await insertTx.mutateAsync({
        collaborator_id: formCollabId,
        semester_start: semesterStart,
        transaction_date: formDate,
        type: 'folga_bh',
        description: formReason || 'Folga BH concedida',
        credit_minutes: 0,
        debit_minutes: mins,
        balance_after_minutes: (bal - mins),
        reference_month: null,
        reference_year: null,
        created_by: session?.user.id ?? null,
      });
      toast.success('Folga BH concedida');
      setFolgaOpen(false);
      resetForm();
    } catch (e: any) { toast.error(e.message); }
  }, [formCollabId, formDate, formValue, formReason, semesterStart, session, collabBalances]);

  const handleSaldoAnterior = useCallback(async () => {
    if (!formCollabId || !formValue) return;
    const mins = parseHHMM(formValue);
    if (mins === null) { toast.error('Valor inválido. Use formato HH:MM ou -HH:MM'); return; }
    try {
      const credit = mins > 0 ? mins : 0;
      const debit = mins < 0 ? Math.abs(mins) : 0;
      await insertTx.mutateAsync({
        collaborator_id: formCollabId,
        semester_start: semesterStart,
        transaction_date: semesterStart,
        type: 'saldo_anterior',
        description: formReason || 'Saldo transferido do semestre anterior',
        credit_minutes: credit,
        debit_minutes: debit,
        balance_after_minutes: mins,
        reference_month: null,
        reference_year: null,
        created_by: session?.user.id ?? null,
      });
      toast.success('Saldo anterior inserido');
      setSaldoAnteriorOpen(false);
      resetForm();
    } catch (e: any) { toast.error(e.message); }
  }, [formCollabId, formValue, formReason, semesterStart, session]);

  const handleAjusteManual = useCallback(async () => {
    if (!formCollabId || !formValue || !formReason) { toast.error('Preencha todos os campos obrigatórios'); return; }
    const mins = parseHHMM(formValue);
    if (mins === null || mins <= 0) { toast.error('Valor inválido'); return; }
    try {
      const credit = formType === 'credito' ? mins : 0;
      const debit = formType === 'debito' ? mins : 0;
      const bal = collabBalances.get(formCollabId)?.balance ?? 0;
      await insertTx.mutateAsync({
        collaborator_id: formCollabId,
        semester_start: semesterStart,
        transaction_date: new Date().toISOString().slice(0, 10),
        type: 'ajuste_manual',
        description: formReason,
        credit_minutes: credit,
        debit_minutes: debit,
        balance_after_minutes: bal + credit - debit,
        reference_month: null,
        reference_year: null,
        created_by: session?.user.id ?? null,
      });
      toast.success('Ajuste registrado');
      setAjusteOpen(false);
      resetForm();
    } catch (e: any) { toast.error(e.message); }
  }, [formCollabId, formValue, formReason, formType, semesterStart, session, collabBalances]);

  const resetForm = () => { setFormCollabId(''); setFormDate(''); setFormValue(''); setFormReason(''); setFormType('credito'); };

  const handleExport = useCallback(() => {
    const rows = filteredCollabs.map(c => {
      const b = collabBalances.get(c.id);
      return {
        Colaborador: c.collaborator_name,
        Setor: c.sector,
        'Créditos (min)': b?.credit ?? 0,
        'Débitos (min)': b?.debit ?? 0,
        'Saldo (min)': b?.balance ?? 0,
        'Saldo (HH:MM)': fmtMinToHHMM(b?.balance ?? 0),
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Banco de Horas');
    XLSX.writeFile(wb, `banco_horas_${semesterStart}.xlsx`);
  }, [filteredCollabs, collabBalances, semesterStart]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Banco de Horas</h1>
          <p className="text-sm text-muted-foreground mt-1">Controle de saldo de horas extras e compensações</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={semesterStart} onValueChange={setSemesterStart}>
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {semesterOptions.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1"><Users className="w-4 h-4 text-muted-foreground" /><span className="text-xs text-muted-foreground">Colaboradores</span></div>
          <p className="text-2xl font-bold">{summary.total}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-green-600" /><span className="text-xs text-muted-foreground">Saldo Positivo</span></div>
          <p className="text-2xl font-bold text-green-600">{summary.positive}</p>
          <p className="text-xs text-muted-foreground">{fmtMinToHHMM(summary.totalPos)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1"><TrendingDown className="w-4 h-4 text-red-600" /><span className="text-xs text-muted-foreground">Saldo Negativo</span></div>
          <p className="text-2xl font-bold text-red-600">{summary.negative}</p>
          <p className="text-xs text-muted-foreground">{fmtMinToHHMM(summary.totalNeg)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1"><AlertTriangle className="w-4 h-4 text-orange-500" /><span className="text-xs text-muted-foreground">{'>'}20h crédito</span></div>
          <p className="text-2xl font-bold text-orange-500">{summary.over20}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1"><AlertTriangle className="w-4 h-4 text-red-500" /><span className="text-xs text-muted-foreground">{'<'}-20h débito</span></div>
          <p className="text-2xl font-bold text-red-500">{summary.under20}</p>
        </CardContent></Card>
      </div>

      {/* Actions bar */}
      <div className="flex flex-wrap gap-2">
        {isAdmin && (
          <>
            <Button size="sm" variant="outline" onClick={() => { resetForm(); setFolgaOpen(true); }}>
              <Gift className="w-4 h-4 mr-1" /> Conceder Folga
            </Button>
            <Button size="sm" variant="outline" onClick={() => { resetForm(); setSaldoAnteriorOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" /> Saldo Anterior
            </Button>
            <Button size="sm" variant="outline" onClick={() => { resetForm(); setAjusteOpen(true); }}>
              <Pencil className="w-4 h-4 mr-1" /> Ajuste Manual
            </Button>
          </>
        )}
        <div className="flex-1" />
        <Select value={sectorFilter} onValueChange={setSectorFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Setor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os setores</SelectItem>
            {sectors.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={handleExport}>
          <Download className="w-4 h-4 mr-1" /> Excel
        </Button>
      </div>

      {/* Main table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer" onClick={() => setSortBy('name')}>
                  Colaborador {sortBy === 'name' && <ArrowUpDown className="w-3 h-3 inline ml-1" />}
                </TableHead>
                <TableHead>Setor</TableHead>
                <TableHead className="text-right">Créditos</TableHead>
                <TableHead className="text-right">Débitos</TableHead>
                <TableHead className="text-right cursor-pointer" onClick={() => setSortBy('saldo')}>
                  Saldo {sortBy === 'saldo' && <ArrowUpDown className="w-3 h-3 inline ml-1" />}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filteredCollabs.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum colaborador encontrado</TableCell></TableRow>
              ) : filteredCollabs.map(c => {
                const b = collabBalances.get(c.id);
                const bal = b?.balance ?? 0;
                const isWarning = bal < -20 * 60 || bal > 40 * 60;
                return (
                  <TableRow key={c.id} className={`cursor-pointer hover:bg-muted/50 ${isWarning ? 'bg-yellow-50' : ''}`} onClick={() => setSelectedCollabId(c.id)}>
                    <TableCell className="font-medium">{c.collaborator_name}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{c.sector}</Badge></TableCell>
                    <TableCell className="text-right text-green-600">{b?.credit ? fmtMinToHHMM(b.credit) : '—'}</TableCell>
                    <TableCell className="text-right text-red-600">{b?.debit ? fmtMinToHHMM(-b.debit) : '—'}</TableCell>
                    <TableCell className={`text-right font-semibold ${bal > 0 ? 'text-green-600' : bal < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                      {fmtMinToHHMM(bal)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Extrato modal */}
      <Dialog open={!!selectedCollabId} onOpenChange={(open) => { if (!open) setSelectedCollabId(null); }}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Extrato — {selectedCollab?.collaborator_name}</DialogTitle>
            <DialogDescription>{getSemesterLabel(semesterStart)}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {selectedTransactions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhuma movimentação no semestre</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Crédito</TableHead>
                    <TableHead className="text-right">Débito</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    let running = 0;
                    return selectedTransactions.map(tx => {
                      running += tx.credit_minutes - tx.debit_minutes;
                      const typeInfo = TYPE_LABELS[tx.type] || { label: tx.type, color: 'bg-muted text-muted-foreground' };
                      return (
                        <TableRow key={tx.id}>
                          <TableCell className="text-sm">{new Date(tx.transaction_date + 'T12:00:00').toLocaleDateString('pt-BR')}</TableCell>
                          <TableCell><Badge className={`${typeInfo.color} text-[10px]`}>{typeInfo.label}</Badge></TableCell>
                          <TableCell className="text-sm max-w-[200px] truncate">{tx.description}</TableCell>
                          <TableCell className="text-right text-green-600 text-sm">{tx.credit_minutes > 0 ? fmtMinToHHMM(tx.credit_minutes) : ''}</TableCell>
                          <TableCell className="text-right text-red-600 text-sm">{tx.debit_minutes > 0 ? fmtMinToHHMM(-tx.debit_minutes) : ''}</TableCell>
                          <TableCell className={`text-right font-semibold text-sm ${running > 0 ? 'text-green-600' : running < 0 ? 'text-red-600' : ''}`}>{fmtMinToHHMM(running)}</TableCell>
                        </TableRow>
                      );
                    });
                  })()}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Conceder Folga modal */}
      <Dialog open={folgaOpen} onOpenChange={setFolgaOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Conceder Folga BH</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Colaborador</Label>
              <Select value={formCollabId} onValueChange={setFormCollabId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {activeCollabs.sort((a, b) => a.collaborator_name.localeCompare(b.collaborator_name)).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.collaborator_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formCollabId && <p className="text-xs text-muted-foreground mt-1">Saldo: {fmtMinToHHMM(collabBalances.get(formCollabId)?.balance ?? 0)}</p>}
            </div>
            <div><Label>Data da folga</Label><Input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} /></div>
            <div>
              <Label>Horas a debitar (HH:MM)</Label>
              <Input placeholder="05:00" value={formValue} onChange={e => setFormValue(e.target.value)} />
            </div>
            <div><Label>Motivo (opcional)</Label><Textarea value={formReason} onChange={e => setFormReason(e.target.value)} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolgaOpen(false)}>Cancelar</Button>
            <Button onClick={handleConcederFolga} disabled={insertTx.isPending}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Saldo Anterior modal */}
      <Dialog open={saldoAnteriorOpen} onOpenChange={setSaldoAnteriorOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Inserir Saldo Anterior</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Colaborador</Label>
              <Select value={formCollabId} onValueChange={setFormCollabId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {activeCollabs.sort((a, b) => a.collaborator_name.localeCompare(b.collaborator_name)).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.collaborator_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor (HH:MM — use -HH:MM para negativo)</Label>
              <Input placeholder="05:30 ou -02:00" value={formValue} onChange={e => setFormValue(e.target.value)} />
            </div>
            <div><Label>Descrição</Label><Textarea value={formReason} onChange={e => setFormReason(e.target.value)} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaldoAnteriorOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaldoAnterior} disabled={insertTx.isPending}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ajuste Manual modal */}
      <Dialog open={ajusteOpen} onOpenChange={setAjusteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ajuste Manual</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Colaborador</Label>
              <Select value={formCollabId} onValueChange={setFormCollabId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {activeCollabs.sort((a, b) => a.collaborator_name.localeCompare(b.collaborator_name)).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.collaborator_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={formType} onValueChange={(v: any) => setFormType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="credito">Crédito (+)</SelectItem>
                  <SelectItem value="debito">Débito (-)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor (HH:MM)</Label>
              <Input placeholder="02:30" value={formValue} onChange={e => setFormValue(e.target.value)} />
            </div>
            <div><Label>Motivo (obrigatório)</Label><Textarea value={formReason} onChange={e => setFormReason(e.target.value)} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAjusteOpen(false)}>Cancelar</Button>
            <Button onClick={handleAjusteManual} disabled={insertTx.isPending || !formReason}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
