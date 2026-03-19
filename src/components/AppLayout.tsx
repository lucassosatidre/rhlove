import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Users, CalendarDays, Menu, X, BarChart3, Palmtree, CalendarCheck, LogOut, Shield, LayoutDashboard, FileWarning, CalendarClock, UserMinus, Fingerprint, Mic } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import ChangePasswordDialog from '@/components/ChangePasswordDialog';
import rhLoveIcon from '@/assets/rh-love-icon.png';
import clienteIcon from '@/assets/cliente-estrela-icon.png';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'gestor', 'visualizador'] },
  { to: '/calendario-rh', label: 'Calendário RH', icon: CalendarClock, roles: ['admin', 'gestor'] },
  { to: '/escala', label: 'Escala', icon: CalendarDays, roles: ['admin', 'gestor', 'lider', 'visualizador'] },
  { to: '/colaboradores', label: 'Colaboradores', icon: Users, roles: ['admin', 'gestor'] },
  { to: '/produtividade', label: 'Produtividade', icon: BarChart3, roles: ['admin', 'gestor'] },
  { to: '/ferias', label: 'Férias', icon: Palmtree, roles: ['admin', 'gestor'] },
  { to: '/compensacoes', label: 'Compensações', icon: CalendarCheck, roles: ['admin', 'gestor'] },
  { to: '/avisos-previos', label: 'Avisos Prévios', icon: FileWarning, roles: ['admin', 'gestor'] },
  { to: '/afastamentos', label: 'Afastamentos', icon: UserMinus, roles: ['admin', 'gestor'] },
  { to: '/registro-ponto', label: 'Registro Ponto', icon: Fingerprint, roles: ['admin', 'gestor'] },
  { to: '/usuarios', label: 'Usuários', icon: Shield, roles: ['admin'] },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { usuario, signOut } = useAuth();

  const visibleItems = NAV_ITEMS.filter(item => 
    usuario && item.roles.includes(usuario.perfil)
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex md:w-60 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        {/* Product identity */}
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl overflow-hidden shadow-lg ring-2 ring-sidebar-primary/30">
              <img src={rhLoveIcon} alt="RH Love" className="w-full h-full object-cover" />
            </div>
            <div className="leading-tight">
              <span className="text-sm font-bold tracking-tight block">RH Love</span>
              <span className="text-[10px] text-sidebar-foreground/40 font-medium block">Plataforma de gestão de pessoas</span>
              <span className="text-[9px] text-sidebar-foreground/30 font-medium block mt-0.5">By: Propósito Soluções</span>
            </div>
          </div>
          
          {/* Active client */}
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg bg-sidebar-accent/50">
            <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 ring-1 ring-sidebar-foreground/10">
              <img src={clienteIcon} alt="Pizzaria Estrela da Ilha" className="w-full h-full object-cover" />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] text-sidebar-foreground/40 font-medium uppercase tracking-wider block">Cliente ativo</span>
              <span className="text-[11px] text-sidebar-foreground/80 font-semibold block truncate">Pizzaria Estrela da Ilha</span>
            </div>
          </div>
        </div>

        <div className="px-4 mb-2">
          <div className="h-px bg-gradient-to-r from-sidebar-primary/40 via-sidebar-primary/20 to-transparent" />
        </div>

        <nav className="flex-1 px-3 space-y-0.5">
          {visibleItems.map(item => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  active
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-sidebar-primary/25'
                    : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                }`}
              >
                <item.icon className="w-[18px] h-[18px]" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User info + developer credit */}
        <div className="p-4 border-t border-sidebar-border space-y-3">
          {usuario && (
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-sidebar-foreground truncate">{usuario.nome}</p>
                <p className="text-[10px] text-sidebar-foreground/40 capitalize">{usuario.perfil}</p>
              </div>
              <div className="flex items-center gap-1">
                <ChangePasswordDialog />
                <button
                  onClick={signOut}
                  className="p-1.5 rounded-lg hover:bg-sidebar-accent transition-colors text-sidebar-foreground/50 hover:text-sidebar-foreground"
                  title="Sair"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
          <span className="text-[10px] text-sidebar-foreground/30 font-medium block">Propósito Soluções · v1.0</span>
        </div>
      </aside>

      {/* Mobile */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg overflow-hidden shadow ring-1 ring-primary/20">
              <img src={rhLoveIcon} alt="RH Love" className="w-full h-full object-cover" />
            </div>
            <div>
              <span className="font-bold text-sm block">RH Love</span>
              {usuario && <span className="text-[10px] text-muted-foreground">{usuario.nome} · Pizzaria Estrela da Ilha</span>}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={signOut} className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="Sair">
              <LogOut className="w-4 h-4" />
            </button>
            <button onClick={() => setMobileOpen(!mobileOpen)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </header>

        {mobileOpen && (
          <div className="md:hidden absolute inset-0 z-50 bg-background/98 backdrop-blur-sm pt-16">
            <nav className="px-4 space-y-1">
              {visibleItems.map(item => {
                const active = location.pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      active ? 'bg-primary text-primary-foreground shadow-md' : 'hover:bg-muted'
                    }`}
                  >
                    <item.icon className="w-[18px] h-[18px]" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
