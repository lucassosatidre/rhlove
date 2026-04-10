import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useOnlinePunchRecords, useInsertOnlinePunch } from '@/hooks/useOnlinePunchRecords';
import { toast } from 'sonner';
import { Clock, Fingerprint } from 'lucide-react';

function getBRTNow(): Date {
  // Create a date in BRT (UTC-3)
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc - 3 * 3600000);
}

function formatBRTDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatBRTTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

function formatBRTISO(d: Date): string {
  return `${formatBRTDate(d)}T${formatBRTTime(d)}-03:00`;
}

const MAX_PUNCHES = 6;

export default function PontoOnline() {
  const { usuario } = useAuth();
  const [clock, setClock] = useState(getBRTNow());

  // Update clock every second
  useEffect(() => {
    const interval = setInterval(() => setClock(getBRTNow()), 1000);
    return () => clearInterval(interval);
  }, []);

  const todayStr = formatBRTDate(clock);
  const collaboratorId = (usuario as any)?.collaborator_id as string | null;

  const { data: punches = [], isLoading } = useOnlinePunchRecords(collaboratorId, todayStr);
  const insertPunch = useInsertOnlinePunch();

  const punchCount = punches.length;
  const limitReached = punchCount >= MAX_PUNCHES;

  const handlePunch = async () => {
    if (!collaboratorId || !usuario) return;
    const now = getBRTNow();
    try {
      await insertPunch.mutateAsync({
        collaborator_id: collaboratorId,
        punch_time: formatBRTISO(now),
        created_by: usuario.id,
        device_user_agent: navigator.userAgent,
      });
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      toast.success(`Ponto registrado às ${timeStr}`);
    } catch {
      toast.error('Erro ao registrar ponto');
    }
  };

  // Parse punch times for display
  const punchList = useMemo(() => {
    return punches.map((p, idx) => {
      const dt = new Date(p.punch_time);
      // Convert to BRT
      const utc = dt.getTime() + dt.getTimezoneOffset() * 60000;
      const brt = new Date(utc - 3 * 3600000);
      const time = `${String(brt.getHours()).padStart(2, '0')}:${String(brt.getMinutes()).padStart(2, '0')}`;
      const label = idx % 2 === 0 ? 'Entrada' : 'Saída';
      return { time, label, id: p.id };
    });
  }, [punches]);

  const dateDisplay = clock.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="max-w-md mx-auto space-y-6 pt-4">
      {/* Header */}
      <div className="text-center space-y-1">
        <h1 className="text-xl font-bold text-foreground">Meu Ponto</h1>
        {usuario && (
          <p className="text-sm text-muted-foreground">{usuario.nome}</p>
        )}
      </div>

      {/* Clock card */}
      <Card>
        <CardContent className="py-8 text-center space-y-3">
          <p className="text-sm text-muted-foreground capitalize">{dateDisplay}</p>
          <div className="flex items-center justify-center gap-2">
            <Clock className="w-6 h-6 text-primary" />
            <span className="text-5xl font-mono font-bold tracking-tight text-foreground tabular-nums">
              {formatBRTTime(clock)}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">Horário de Brasília (BRT)</p>
        </CardContent>
      </Card>

      {/* Punch button */}
      <Button
        onClick={handlePunch}
        disabled={limitReached || insertPunch.isPending || !collaboratorId}
        className="w-full h-14 text-lg font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg"
        size="lg"
      >
        <Fingerprint className="w-6 h-6 mr-2" />
        {limitReached ? 'Limite de batidas atingido para hoje' : 'REGISTRAR PONTO'}
      </Button>

      {/* Today's punches */}
      <Card>
        <CardContent className="py-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Batidas de hoje</p>
            <Badge variant="secondary" className="text-xs">
              {punchCount}/{MAX_PUNCHES}
            </Badge>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : punchList.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma batida registrada hoje
            </p>
          ) : (
            <div className="space-y-2">
              {punchList.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50"
                >
                  <span className="font-mono font-semibold text-foreground">{p.time}</span>
                  <Badge
                    variant="secondary"
                    className={
                      p.label === 'Entrada'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }
                  >
                    {p.label}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
