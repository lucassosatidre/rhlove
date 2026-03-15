import { useAuth } from '@/contexts/AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { CalendarDays, User } from 'lucide-react';

const DIAS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

interface Props {
  period: string;
  setPeriod: (v: string) => void;
  customStart: string;
  setCustomStart: (v: string) => void;
  customEnd: string;
  setCustomEnd: (v: string) => void;
}

export default function DashboardHeader({ period, setPeriod, customStart, setCustomStart, customEnd, setCustomEnd }: Props) {
  const { usuario } = useAuth();
  const today = new Date();
  const dateStr = today.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const dayOfWeek = DIAS[today.getDay()];

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between print:flex-row">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground md:text-2xl">
          Dashboard Operacional
        </h1>
        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5" />
            {dateStr} · {dayOfWeek}
          </span>
          {usuario && (
            <span className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              {usuario.nome}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 no-print">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[160px] h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hoje">Hoje</SelectItem>
            <SelectItem value="ontem">Ontem</SelectItem>
            <SelectItem value="7dias">Últimos 7 dias</SelectItem>
            <SelectItem value="30dias">Últimos 30 dias</SelectItem>
            <SelectItem value="personalizado">Personalizado</SelectItem>
          </SelectContent>
        </Select>
        {period === 'personalizado' && (
          <>
            <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="w-[140px] h-9 text-xs" />
            <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="w-[140px] h-9 text-xs" />
          </>
        )}
      </div>
    </div>
  );
}
