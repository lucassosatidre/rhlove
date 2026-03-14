import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Users, CalendarDays, Menu, X, BarChart3 } from 'lucide-react';
import logo from '@/assets/logo.png';

const NAV_ITEMS = [
  { to: '/', label: 'Escala', icon: CalendarDays },
  { to: '/colaboradores', label: 'Colaboradores', icon: Users },
  { to: '/produtividade', label: 'Produtividade', icon: BarChart3 },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex md:w-56 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="p-5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <Pizza className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          <div className="leading-tight">
            <span className="text-sm font-bold tracking-tight block">Estrela RH</span>
            <span className="text-[10px] text-sidebar-foreground/50">Pizzaria Estrela da Ilha</span>
          </div>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {NAV_ITEMS.map(item => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-sidebar-accent text-sidebar-primary'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-sidebar-border">
          <span className="text-[11px] text-sidebar-foreground/40">v1.0 · Sistema interno</span>
        </div>
      </aside>

      {/* Mobile */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Pizza className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-sm">Estrela RH</span>
          </div>
          <button onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </header>

        {mobileOpen && (
          <div className="md:hidden absolute inset-0 z-50 bg-background/95 pt-16">
            <nav className="px-4 space-y-1">
              {NAV_ITEMS.map(item => {
                const active = location.pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                      active ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
