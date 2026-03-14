import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Users, CalendarDays, Menu, X, BarChart3, Palmtree, CalendarCheck } from 'lucide-react';
import logo from '@/assets/logo.png';

const NAV_ITEMS = [
  { to: '/', label: 'Escala', icon: CalendarDays },
  { to: '/colaboradores', label: 'Colaboradores', icon: Users },
  { to: '/produtividade', label: 'Produtividade', icon: BarChart3 },
  { to: '/ferias', label: 'Férias', icon: Palmtree },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex md:w-60 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden shadow-lg ring-2 ring-sidebar-primary/30">
            <img src={logo} alt="Estrela RH" className="w-full h-full object-cover" />
          </div>
          <div className="leading-tight">
            <span className="text-sm font-bold tracking-tight block">Estrela RH</span>
            <span className="text-[10px] text-sidebar-foreground/40 font-medium">Pizzaria Estrela da Ilha</span>
          </div>
        </div>

        <div className="px-4 mb-2">
          <div className="h-px bg-gradient-to-r from-sidebar-primary/40 via-sidebar-primary/20 to-transparent" />
        </div>

        <nav className="flex-1 px-3 space-y-0.5">
          {NAV_ITEMS.map(item => {
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

        <div className="p-4 border-t border-sidebar-border">
          <span className="text-[11px] text-sidebar-foreground/30 font-medium">v1.0 · Sistema interno</span>
        </div>
      </aside>

      {/* Mobile */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg overflow-hidden shadow ring-1 ring-primary/20">
              <img src={logo} alt="Estrela RH" className="w-full h-full object-cover" />
            </div>
            <span className="font-bold text-sm">Estrela RH</span>
          </div>
          <button onClick={() => setMobileOpen(!mobileOpen)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </header>

        {mobileOpen && (
          <div className="md:hidden absolute inset-0 z-50 bg-background/98 backdrop-blur-sm pt-16">
            <nav className="px-4 space-y-1">
              {NAV_ITEMS.map(item => {
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
