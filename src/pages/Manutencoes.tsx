import { useState, useRef } from 'react';
import { Wrench, Plus, Eye, ImageIcon, Camera, X, Loader2, ShoppingCart } from 'lucide-react';
import { DropZone } from '@/components/ui/drop-zone';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useManutencoes, useCreateManutencao, useUpdateManutencaoStatus, type Manutencao } from '@/hooks/useManutencoes';
import { useComprasInsumos, useCreateCompraInsumo, useUpdateCompraInsumoStatus, type CompraInsumo } from '@/hooks/useComprasInsumos';

const SECTORS = ['COZINHA', 'SALÃO', 'TELE - ENTREGA', 'BANHEIRO', 'ÁREA EXTERNA', 'ELÉTRICA', 'HIDRÁULICA', 'OUTRO'];
const PRIORITIES = [
  { value: 'baixa', label: 'Baixa' },
  { value: 'media', label: 'Média' },
  { value: 'alta', label: 'Alta' },
  { value: 'urgente', label: 'Urgente' },
];

function statusBadge(status: string) {
  switch (status) {
    case 'concluido':
      return <Badge className="bg-primary text-primary-foreground">Concluído</Badge>;
    case 'em_andamento':
      return <Badge variant="secondary">Em andamento</Badge>;
    default:
      return <Badge variant="outline">Solicitado</Badge>;
  }
}

function priorityBadge(priority: string) {
  switch (priority) {
    case 'urgente':
      return <Badge variant="destructive">Urgente</Badge>;
    case 'alta':
      return <Badge className="bg-accent text-accent-foreground">Alta</Badge>;
    case 'media':
      return <Badge variant="secondary">Média</Badge>;
    default:
      return <Badge variant="outline">Baixa</Badge>;
  }
}

function getPublicUrl(path: string) {
  const { data } = supabase.storage.from('manutencao-fotos').getPublicUrl(path);
  return data.publicUrl;
}

/* ───────────── MANUTENÇÕES TAB ───────────── */
function ManutencaoTab() {
  const { usuario } = useAuth();
  const { toast } = useToast();
  const isAdminOrGestor = usuario?.perfil === 'admin' || usuario?.perfil === 'gestor';

  const [showNewDialog, setShowNewDialog] = useState(false);
  const [description, setDescription] = useState('');
  const [sector, setSector] = useState('');
  const [priority, setPriority] = useState('media');
  const [observation, setObservation] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [filterName, setFilterName] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSector, setFilterSector] = useState('');

  const [viewItem, setViewItem] = useState<Manutencao | null>(null);
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);

  const { data: items = [], isLoading } = useManutencoes({
    collaborator: filterName || undefined,
    dateFrom: filterDateFrom || undefined,
    dateTo: filterDateTo || undefined,
    status: filterStatus !== 'all' ? filterStatus : undefined,
    sector: filterSector || undefined,
  });

  const createManutencao = useCreateManutencao();
  const updateStatus = useUpdateManutencaoStatus();

  const resetForm = () => {
    setDescription('');
    setSector('');
    setPriority('media');
    setObservation('');
    setSelectedFiles([]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!usuario) return;
    if (!description.trim()) {
      toast({ title: 'Erro', description: 'A descrição é obrigatória.', variant: 'destructive' });
      return;
    }
    if (selectedFiles.length === 0) {
      toast({ title: 'Erro', description: 'Anexe pelo menos 1 foto.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const photoPaths: string[] = [];
      for (const file of selectedFiles) {
        const ext = file.name.split('.').pop() || 'jpg';
        const path = `${usuario.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from('manutencao-fotos').upload(path, file, { contentType: file.type });
        if (error) throw error;
        photoPaths.push(path);
      }

      await createManutencao.mutateAsync({
        usuario_id: usuario.id,
        collaborator_name: usuario.nome,
        description: description.trim(),
        sector,
        priority,
        observation: observation.trim(),
        photo_paths: photoPaths,
      });

      resetForm();
      setShowNewDialog(false);
      toast({ title: 'Solicitação criada!', description: 'Sua solicitação de manutenção foi registrada.' });
    } catch (err: any) {
      toast({ title: 'Erro ao enviar', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = (id: string, newStatus: string) => {
    updateStatus.mutate({ id, status: newStatus }, {
      onSuccess: () => {
        toast({ title: 'Status atualizado!' });
        if (viewItem?.id === id) {
          setViewItem((prev) => prev ? { ...prev, status: newStatus } : null);
        }
      },
    });
  };

  const clearFilters = () => {
    setFilterName('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterStatus('all');
    setFilterSector('');
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowNewDialog(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Nova solicitação
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Colaborador</label>
              <Input placeholder="Nome" value={filterName} onChange={(e) => setFilterName(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Data início</label>
              <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Data fim</label>
              <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="solicitado">Solicitado</SelectItem>
                  <SelectItem value="em_andamento">Em andamento</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Setor</label>
              <Input placeholder="Setor" value={filterSector} onChange={(e) => setFilterSector(e.target.value)} />
            </div>
            <Button variant="outline" onClick={clearFilters}>Limpar</Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Carregando...</p>
          ) : items.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma solicitação encontrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Data / Hora</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Fotos</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((m) => {
                  const dt = new Date(m.created_at);
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.collaborator_name}</TableCell>
                      <TableCell className="text-sm">
                        {dt.toLocaleDateString('pt-BR')}
                        <br />
                        <span className="text-muted-foreground">{dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">{m.description}</TableCell>
                      <TableCell>{m.sector || '—'}</TableCell>
                      <TableCell>{priorityBadge(m.priority)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <ImageIcon className="w-4 h-4 text-muted-foreground" />
                          {m.photo_paths?.length || 0}
                        </div>
                      </TableCell>
                      <TableCell>{statusBadge(m.status)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" title="Ver detalhes" onClick={() => setViewItem(m)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          {isAdminOrGestor && m.status !== 'concluido' && (
                            <Select value={m.status} onValueChange={(val) => handleStatusChange(m.id, val)}>
                              <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="solicitado">Solicitado</SelectItem>
                                <SelectItem value="em_andamento">Em andamento</SelectItem>
                                <SelectItem value="concluido">Concluído</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* New Request Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="w-5 h-5" />
              Nova solicitação de manutenção
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Descrição do problema *</Label>
              <Textarea placeholder="Descreva o problema encontrado..." value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Setor / Local</Label>
                <Select value={sector} onValueChange={setSector}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {SECTORS.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridade</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (<SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Observações adicionais</Label>
              <Textarea placeholder="Informações extras..." value={observation} onChange={(e) => setObservation(e.target.value)} rows={2} />
            </div>
            <div>
              <Label>Fotos * (mínimo 1)</Label>
              <div className="mt-2 space-y-3">
                <DropZone
                  accept="image/*"
                  multiple
                  onFiles={(files) => setSelectedFiles(prev => [...prev, ...Array.from(files)])}
                  label="Arraste fotos aqui ou clique para selecionar"
                  className="py-4"
                >
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Camera className="w-8 h-8 opacity-50" />
                    <p className="text-sm">Arraste fotos aqui ou clique para selecionar</p>
                  </div>
                </DropZone>
                {selectedFiles.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {selectedFiles.map((file, i) => (
                      <div key={i} className="relative group">
                        <img src={URL.createObjectURL(file)} alt={`Foto ${i + 1}`} className="w-full h-24 object-cover rounded-lg border border-border" />
                        <button onClick={() => removeFile(i)} className="absolute top-1 right-1 bg-background/80 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setShowNewDialog(false); }}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Enviar solicitação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!viewItem} onOpenChange={() => setViewItem(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Detalhes da solicitação</DialogTitle></DialogHeader>
          {viewItem && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Colaborador</span><p className="font-medium">{viewItem.collaborator_name}</p></div>
                <div><span className="text-muted-foreground">Data / Hora</span><p className="font-medium">{new Date(viewItem.created_at).toLocaleDateString('pt-BR')} {new Date(viewItem.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p></div>
                <div><span className="text-muted-foreground">Setor</span><p className="font-medium">{viewItem.sector || '—'}</p></div>
                <div><span className="text-muted-foreground">Prioridade</span><p>{priorityBadge(viewItem.priority)}</p></div>
                <div>
                  <span className="text-muted-foreground">Status</span>
                  <div className="flex items-center gap-2">
                    {statusBadge(viewItem.status)}
                    {isAdminOrGestor && viewItem.status !== 'concluido' && (
                      <Select value={viewItem.status} onValueChange={(val) => handleStatusChange(viewItem.id, val)}>
                        <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="solicitado">Solicitado</SelectItem>
                          <SelectItem value="em_andamento">Em andamento</SelectItem>
                          <SelectItem value="concluido">Concluído</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Descrição</span>
                <p className="text-sm bg-muted rounded-lg p-3 mt-1 whitespace-pre-wrap">{viewItem.description}</p>
              </div>
              {viewItem.observation && (
                <div>
                  <span className="text-sm text-muted-foreground">Observações</span>
                  <p className="text-sm bg-muted rounded-lg p-3 mt-1 whitespace-pre-wrap">{viewItem.observation}</p>
                </div>
              )}
              <div>
                <span className="text-sm text-muted-foreground">Fotos ({viewItem.photo_paths?.length || 0})</span>
                <div className="grid grid-cols-3 gap-3 mt-2">
                  {viewItem.photo_paths?.map((path, i) => (
                    <button key={i} onClick={() => setViewPhoto(getPublicUrl(path))} className="overflow-hidden rounded-lg border border-border hover:ring-2 ring-primary transition-all">
                      <img src={getPublicUrl(path)} alt={`Foto ${i + 1}`} className="w-full h-32 object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Full Photo Viewer */}
      <Dialog open={!!viewPhoto} onOpenChange={() => setViewPhoto(null)}>
        <DialogContent className="max-w-4xl p-2">
          {viewPhoto && <img src={viewPhoto} alt="Foto ampliada" className="w-full h-auto max-h-[80vh] object-contain rounded-lg" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ───────────── COMPRAS INSUMOS TAB ───────────── */
function ComprasInsumosTab() {
  const { usuario } = useAuth();
  const { toast } = useToast();
  const isAdminOrGestor = usuario?.perfil === 'admin' || usuario?.perfil === 'gestor';

  const [showNewDialog, setShowNewDialog] = useState(false);
  const [itemName, setItemName] = useState('');
  const [stockQuantity, setStockQuantity] = useState('');
  const [priority, setPriority] = useState('media');
  const [observation, setObservation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [filterName, setFilterName] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterItem, setFilterItem] = useState('');

  const [viewItem, setViewItem] = useState<CompraInsumo | null>(null);

  const { data: items = [], isLoading } = useComprasInsumos({
    collaborator: filterName || undefined,
    dateFrom: filterDateFrom || undefined,
    dateTo: filterDateTo || undefined,
    status: filterStatus !== 'all' ? filterStatus : undefined,
    item: filterItem || undefined,
  });

  const createCompra = useCreateCompraInsumo();
  const updateStatus = useUpdateCompraInsumoStatus();

  const resetForm = () => {
    setItemName('');
    setStockQuantity('');
    setPriority('media');
    setObservation('');
  };

  const handleSubmit = async () => {
    if (!usuario) return;
    if (!itemName.trim()) {
      toast({ title: 'Erro', description: 'O nome do insumo é obrigatório.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      await createCompra.mutateAsync({
        usuario_id: usuario.id,
        collaborator_name: usuario.nome,
        item_name: itemName.trim(),
        stock_quantity: stockQuantity.trim(),
        priority,
        observation: observation.trim(),
      });

      resetForm();
      setShowNewDialog(false);
      toast({ title: 'Solicitação criada!', description: 'Sua solicitação de compra foi registrada.' });
    } catch (err: any) {
      toast({ title: 'Erro ao enviar', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = (id: string, newStatus: string) => {
    updateStatus.mutate({ id, status: newStatus }, {
      onSuccess: () => {
        toast({ title: 'Status atualizado!' });
        if (viewItem?.id === id) {
          setViewItem((prev) => prev ? { ...prev, status: newStatus } : null);
        }
      },
    });
  };

  const clearFilters = () => {
    setFilterName('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterStatus('all');
    setFilterItem('');
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowNewDialog(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Nova solicitação
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Colaborador</label>
              <Input placeholder="Nome" value={filterName} onChange={(e) => setFilterName(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Data início</label>
              <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Data fim</label>
              <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="solicitado">Solicitado</SelectItem>
                  <SelectItem value="em_andamento">Em andamento</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Insumo</label>
              <Input placeholder="Nome do insumo" value={filterItem} onChange={(e) => setFilterItem(e.target.value)} />
            </div>
            <Button variant="outline" onClick={clearFilters}>Limpar</Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Carregando...</p>
          ) : items.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma solicitação encontrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Data / Hora</TableHead>
                  <TableHead>Insumo</TableHead>
                  <TableHead>Qtd em Estoque</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((c) => {
                  const dt = new Date(c.created_at);
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.collaborator_name}</TableCell>
                      <TableCell className="text-sm">
                        {dt.toLocaleDateString('pt-BR')}
                        <br />
                        <span className="text-muted-foreground">{dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">{c.item_name}</TableCell>
                      <TableCell>{c.stock_quantity || '—'}</TableCell>
                      <TableCell>{priorityBadge(c.priority)}</TableCell>
                      <TableCell>{statusBadge(c.status)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" title="Ver detalhes" onClick={() => setViewItem(c)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          {isAdminOrGestor && c.status !== 'concluido' && (
                            <Select value={c.status} onValueChange={(val) => handleStatusChange(c.id, val)}>
                              <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="solicitado">Solicitado</SelectItem>
                                <SelectItem value="em_andamento">Em andamento</SelectItem>
                                <SelectItem value="concluido">Concluído</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* New Request Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Nova solicitação de compra
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Insumo que faltou *</Label>
              <Input placeholder="Ex: Mussarela, Farinha de trigo..." value={itemName} onChange={(e) => setItemName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Quantidade em estoque</Label>
                <Input placeholder="Ex: 2 unidades, 500g..." value={stockQuantity} onChange={(e) => setStockQuantity(e.target.value)} />
              </div>
              <div>
                <Label>Prioridade</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (<SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea placeholder="Informações extras..." value={observation} onChange={(e) => setObservation(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setShowNewDialog(false); }}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Enviar solicitação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!viewItem} onOpenChange={() => setViewItem(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Detalhes da solicitação de compra</DialogTitle></DialogHeader>
          {viewItem && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Colaborador</span><p className="font-medium">{viewItem.collaborator_name}</p></div>
                <div><span className="text-muted-foreground">Data / Hora</span><p className="font-medium">{new Date(viewItem.created_at).toLocaleDateString('pt-BR')} {new Date(viewItem.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p></div>
                <div><span className="text-muted-foreground">Insumo</span><p className="font-medium">{viewItem.item_name}</p></div>
                <div><span className="text-muted-foreground">Qtd em Estoque</span><p className="font-medium">{viewItem.stock_quantity || '—'}</p></div>
                <div><span className="text-muted-foreground">Prioridade</span><p>{priorityBadge(viewItem.priority)}</p></div>
                <div>
                  <span className="text-muted-foreground">Status</span>
                  <div className="flex items-center gap-2">
                    {statusBadge(viewItem.status)}
                    {isAdminOrGestor && viewItem.status !== 'concluido' && (
                      <Select value={viewItem.status} onValueChange={(val) => handleStatusChange(viewItem.id, val)}>
                        <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="solicitado">Solicitado</SelectItem>
                          <SelectItem value="em_andamento">Em andamento</SelectItem>
                          <SelectItem value="concluido">Concluído</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              </div>
              {viewItem.observation && (
                <div>
                  <span className="text-sm text-muted-foreground">Observações</span>
                  <p className="text-sm bg-muted rounded-lg p-3 mt-1 whitespace-pre-wrap">{viewItem.observation}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ───────────── MAIN PAGE ───────────── */
export default function Manutencoes() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Manutenções & Compras</h1>

      <Tabs defaultValue="manutencoes" className="w-full">
        <TabsList>
          <TabsTrigger value="manutencoes" className="gap-2">
            <Wrench className="w-4 h-4" />
            Manutenções
          </TabsTrigger>
          <TabsTrigger value="compras" className="gap-2">
            <ShoppingCart className="w-4 h-4" />
            Compras de Insumos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="manutencoes">
          <ManutencaoTab />
        </TabsContent>
        <TabsContent value="compras">
          <ComprasInsumosTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
