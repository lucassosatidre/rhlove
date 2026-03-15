import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, type Perfil } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/components/ui/sonner';
import { Plus, Pencil, UserCheck, UserX, KeyRound } from 'lucide-react';

interface UsuarioRow {
  id: string;
  nome: string;
  email: string;
  perfil: string;
  status: string;
  created_at: string;
}

const PERFIS: Perfil[] = ['admin', 'gestor', 'lider', 'visualizador'];

export default function GerenciarUsuarios() {
  const { usuario: currentUser } = useAuth();
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [perfil, setPerfil] = useState<Perfil>('visualizador');
  const [status, setStatus] = useState<'ativo' | 'inativo'>('ativo');

  const fetchUsuarios = async () => {
    const { data } = await supabase.from('usuarios').select('*').order('nome');
    setUsuarios((data as UsuarioRow[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchUsuarios(); }, []);

  const resetForm = () => {
    setNome(''); setEmail(''); setSenha(''); setPerfil('visualizador'); setStatus('ativo'); setEditingId(null);
  };

  const openCreate = () => { resetForm(); setDialogOpen(true); };

  const openEdit = (u: UsuarioRow) => {
    setEditingId(u.id);
    setNome(u.nome);
    setEmail(u.email);
    setSenha('');
    setPerfil(u.perfil as Perfil);
    setStatus(u.status as 'ativo' | 'inativo');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!nome.trim() || !email.trim()) {
      toast.error('Preencha nome e email');
      return;
    }

    if (editingId) {
      // Update profile data
      const { error } = await supabase.from('usuarios').update({ nome, email, perfil, status }).eq('id', editingId);
      if (error) { toast.error('Erro ao atualizar: ' + error.message); return; }
      toast.success('Usuário atualizado');
    } else {
      // Create new user via edge function or auth signup
      if (!senha.trim() || senha.length < 6) {
        toast.error('Senha deve ter pelo menos 6 caracteres');
        return;
      }
      
      // Use supabase admin signup via edge function
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: { email, password: senha, nome, perfil, status }
      });
      
      if (error || data?.error) {
        toast.error('Erro ao criar usuário: ' + (data?.error || error?.message));
        return;
      }
      toast.success('Usuário criado com sucesso');
    }

    setDialogOpen(false);
    resetForm();
    fetchUsuarios();
  };

  const handleResetPassword = async (u: UsuarioRow) => {
    const newPassword = prompt(`Digite a nova senha para ${u.nome} (mínimo 6 caracteres):`);
    if (!newPassword) return;
    if (newPassword.length < 6) {
      toast.error('Senha deve ter pelo menos 6 caracteres');
      return;
    }
    const { data, error } = await supabase.functions.invoke('create-user', {
      body: { action: 'reset-password', userId: u.id, newPassword }
    });
    if (error || data?.error) {
      toast.error('Erro ao redefinir senha: ' + (data?.error || error?.message));
      return;
    }
    toast.success(`Senha de ${u.nome} redefinida com sucesso`);
  };

  const toggleStatus = async (u: UsuarioRow) => {
    const newStatus = u.status === 'ativo' ? 'inativo' : 'ativo';
    const { error } = await supabase.from('usuarios').update({ status: newStatus }).eq('id', u.id);
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success(`Usuário ${newStatus === 'ativo' ? 'ativado' : 'desativado'}`);
    fetchUsuarios();
  };

  if (currentUser?.perfil !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Acesso restrito a administradores.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gerenciar Usuários</h1>
          <p className="text-sm text-muted-foreground">Cadastro e controle de acesso</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}><Plus className="w-4 h-4 mr-1" /> Novo Usuário</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar Usuário' : 'Novo Usuário'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome completo" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemplo.com" disabled={!!editingId} />
              </div>
              {!editingId && (
                <div className="space-y-2">
                  <Label>Senha</Label>
                  <Input type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="Mínimo 6 caracteres" />
                </div>
              )}
              <div className="space-y-2">
                <Label>Perfil</Label>
                <Select value={perfil} onValueChange={v => setPerfil(v as Perfil)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PERFIS.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={v => setStatus(v as 'ativo' | 'inativo')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSave} className="w-full">
                {editingId ? 'Salvar Alterações' : 'Criar Usuário'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
              ) : usuarios.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum usuário cadastrado</TableCell></TableRow>
              ) : usuarios.map(u => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.nome}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell><Badge variant="secondary" className="capitalize">{u.perfil}</Badge></TableCell>
                  <TableCell>
                    <Badge variant={u.status === 'ativo' ? 'default' : 'destructive'} className="capitalize">
                      {u.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(u)} title="Editar">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => toggleStatus(u)} title={u.status === 'ativo' ? 'Desativar' : 'Ativar'}>
                      {u.status === 'ativo' ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
