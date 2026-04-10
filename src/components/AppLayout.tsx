import { ReactNode, useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Users, CalendarDays, Menu, X, BarChart3, Palmtree, CalendarCheck, LogOut, Shield, LayoutDashboard, FileWarning, CalendarClock, UserMinus, Mic, ClipboardList, ClipboardCheck, Bus, Percent, FileSpreadsheet, ChevronRight, Clock, Wallet, CalendarMinus, Landmark, Fingerprint, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import ChangePasswordDialog from '@/components/ChangePasswordDialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useOpenDemandsCount } from '@/hooks/useDemands';
import { useCollaborators } from '@/hooks/useCollaborators';
import rhLoveIcon from '@/assets/rh-love-icon.png';
import clienteIcon from '@/assets/cliente-estrela-icon.png';

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  roles: string[];
  badge?: boolean;
};

type NavGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
};

const FIXED_TOP: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'gestor', 'visualizador'] },
];

const GROUPS: NavGroup[] = [
  {
    id: 'equipe',
    label: 'Equipe',
    icon: Users,
    items: [
      { to: '/colaboradores', label: 'Colaboradores', icon: Users, roles: ['admin', 'gestor'] },
      { to: '/escala', label: 'Escala', icon: CalendarDays, roles: ['admin', 'gestor', 'lider', 'visualizador'] },
      { to: '/produtividade', label: 'Produtividade', icon: BarChart3, roles: ['admin', 'gestor'] },
    ],
  },
  {
    id: 'financeiro',
    label: 'Financeiro',
    icon: Wallet,
    items: [
      { to: '/bonus-10', label: 'Bônus 10%', icon: Percent, roles: ['admin', 'gestor'] },
      { to: '/vale-transporte', label: 'Vale Transporte', icon: Bus, roles: ['admin', 'gestor'] },
      { to: '/fechamento-folha', label: 'Fechamento Folha', icon: FileSpreadsheet, roles: ['admin', 'gestor'] },
    ],
  },
  {
    id: 'ponto',
    label: 'Ponto',
    icon: Clock,
    items: [
      { to: '/espelho-ponto', label: 'Espelho de Ponto', icon: ClipboardList, roles: ['admin', 'gestor'] },
      { to: '/banco-horas', label: 'Banco de Horas', icon: Landmark, roles: ['admin', 'gestor'] },
      { to: '/checkout', label: 'Checkout', icon: Mic, roles: ['admin', 'gestor', 'lider'] },
    ],
  },
  {
    id: 'ausencias',
    label: 'Ausências',
    icon: CalendarMinus,
    items: [
      { to: '/ferias', label: 'Férias', icon: Palmtree, roles: ['admin', 'gestor'] },
      { to: '/compensacoes', label: 'Compensações', icon: CalendarCheck, roles: ['admin', 'gestor'] },
      { to: '/afastamentos', label: 'Afastamentos', icon: UserMinus, roles: ['admin', 'gestor'] },
      { to: '/avisos-previos', label: 'Avisos Prévios', icon: FileWarning, roles: ['admin', 'gestor'] },
    ],
  },
];

const FIXED_BOTTOM: NavItem[] = [
  { to: '/demandas', label: 'Demandas', icon: ClipboardCheck, roles: ['admin', 'gestor', 'lider', 'visualizador'], badge: true },
  { to: '/usuarios', label: 'Usuários', icon: Shield, roles: ['admin'] },
];

const STORAGE_KEY = 'rhlove-sidebar-groups';

function getInitialExpanded(pathname: string): Record<string, boolean> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  // Default: expand group containing active route
  const result: Record<string, boolean> = {};
  for (const g of GROUPS) {
    result[g.id] = g.items.some(i => i.to === pathname);
  }
  return result;
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { usuario, signOut } = useAuth();
  const { data: openTasksCount } = useOpenDemandsCount();
  const { data: collaborators = [] } = useCollaborators();
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => getInitialExpanded(location.pathname));

  // Check if current user has ponto_online enabled
  const showPontoOnline = useMemo(() => {
    if (!usuario?.collaborator_id) return false;
    const collab = collaborators.find(c => c.id === usuario.collaborator_id);
    return collab?.ponto_online === true;
  }, [usuario, collaborators]);

  // Auto-expand group containing current route
  useEffect(() => {
    setExpanded(prev => {
      const next = { ...prev };
      for (const g of GROUPS) {
        if (g.items.some(i => i.to === location.pathname)) {
          next[g.id] = true;
        }
      }
      return next;
    });
  }, [location.pathname]);

  // Persist to localStorage
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(expanded)); } catch { /* ignore */ }
  }, [expanded]);

  const toggleGroup = useCallback((id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const isVisible = (item: NavItem) => usuario && item.roles.includes(usuario.perfil);

  const renderNavItem = (item: NavItem, active: boolean, onClick?: () => void, indent = false) => (
    <Link
      key={item.to}
      to={item.to}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-200 ${
        indent ? 'pl-7 pr-3 py-2' : 'px-3 py-2.5'
      } ${
        active
          ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-sidebar-primary/25'
          : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground'
      }`}
    >
      <item.icon className="w-[18px] h-[18px] shrink-0" />
      <span className="flex-1">{item.label}</span>
      {item.badge && openTasksCount && openTasksCount > 0 ? (
        <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
          {openTasksCount > 99 ? '99+' : openTasksCount}
        </span>
      ) : null}
    </Link>
  );

  const renderGroup = (group: NavGroup, onClick?: () => void) => {
    const visibleItems = group.items.filter(isVisible);
    if (visibleItems.length === 0) return null;
    const isOpen = !!expanded[group.id];
    const hasActive = visibleItems.some(i => i.to === location.pathname);

    return (
      <div key={group.id}>
        <button
          onClick={() => toggleGroup(group.id)}
          className="flex items-center gap-2 w-full px-3 py-2 text-[11px] uppercase tracking-[0.05em] font-semibold text-sidebar-foreground/40 hover:text-sidebar-foreground/60 transition-colors"
        >
          <group.icon className="w-3.5 h-3.5 shrink-0" />
          <span className="flex-1 text-left">{group.label}</span>
          <ChevronRight
            className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
          />
        </button>
        <div
          className="overflow-hidden transition-all duration-200 ease-in-out"
          style={{
            maxHeight: isOpen ? `${visibleItems.length * 44}px` : '0px',
            opacity: isOpen ? 1 : 0,
          }}
        >
          <div className="space-y-0.5 pb-1">
            {visibleItems.map(item =>
              renderNavItem(item, location.pathname === item.to, onClick, true)
            )}
          </div>
        </div>
      </div>
    );
  };

  const visibleFixedTop = FIXED_TOP.filter(isVisible);
  const visibleFixedBottom = FIXED_BOTTOM.filter(isVisible);

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

        <ScrollArea className="flex-1 min-h-0">
          <nav className="px-3 pb-3 space-y-0.5">
            {/* Fixed top items */}
            {visibleFixedTop.map(item =>
              renderNavItem(item, location.pathname === item.to)
            )}

            {/* Ponto Online — only if user has it enabled */}
            {showPontoOnline && renderNavItem(
              { to: '/ponto', label: 'Meu Ponto', icon: Fingerprint, roles: ['admin', 'gestor', 'lider', 'visualizador'] },
              location.pathname === '/ponto'
            )}

            {/* Separator */}
            <div className="!my-2 mx-1 h-px bg-sidebar-foreground/10" />

            {/* Groups */}
            <div className="space-y-1">
              {GROUPS.map((group, idx) => (
                <div key={group.id}>
                  {renderGroup(group)}
                  {idx < GROUPS.length - 1 && (
                    <div className="my-1 mx-1 h-px bg-sidebar-foreground/10" />
                  )}
                </div>
              ))}
            </div>

            {/* Separator */}
            <div className="!my-2 mx-1 h-px bg-sidebar-foreground/10" />

            {/* Fixed bottom items */}
            {visibleFixedBottom.map(item =>
              renderNavItem(item, location.pathname === item.to)
            )}
          </nav>
        </ScrollArea>

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
            <button onClick={() => setMobileOpen(!mobileOpen)} className="relative p-1.5 rounded-lg hover:bg-muted transition-colors">
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              {!mobileOpen && openTasksCount && openTasksCount > 0 ? (
                <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[14px] h-[14px] px-0.5 rounded-full bg-destructive text-destructive-foreground text-[8px] font-bold">
                  {openTasksCount > 99 ? '99+' : openTasksCount}
                </span>
              ) : null}
            </button>
          </div>
        </header>

        {mobileOpen && (
          <div className="md:hidden absolute inset-0 z-50 bg-background/98 backdrop-blur-sm pt-16">
            <ScrollArea className="h-full">
              <nav className="px-4 pb-4 space-y-0.5">
                {visibleFixedTop.map(item =>
                  renderNavItem(item, location.pathname === item.to, () => setMobileOpen(false))
                )}
                <div className="!my-2 mx-1 h-px bg-border" />
                {GROUPS.map(group => renderGroup(group, () => setMobileOpen(false)))}
                <div className="!my-2 mx-1 h-px bg-border" />
                {visibleFixedBottom.map(item =>
                  renderNavItem(item, location.pathname === item.to, () => setMobileOpen(false))
                )}
              </nav>
            </ScrollArea>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
