import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useOnlinePunchRecords, useInsertOnlinePunch } from '@/hooks/useOnlinePunchRecords';
import { toast } from 'sonner';
import { Clock, Fingerprint } from 'lucide-react';

function getBRTNow(): Date {
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
const CONFIRM_DURATION = 3000;

export default function PontoOnline() {
  const { usuario } = useAuth();
  const [clock, setClock] = useState(getBRTNow());
  const [justRegistered, setJustRegistered] = useState(false);

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

  const handlePunch = useCallback(async () => {
    if (!collaboratorId || !usuario || justRegistered) return;
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
      setJustRegistered(true);
      setTimeout(() => setJustRegistered(false), CONFIRM_DURATION);
    } catch {
      toast.error('Erro ao registrar ponto');
    }
  }, [collaboratorId, usuario, justRegistered, insertPunch]);

  const punchList = useMemo(() => {
    return punches.map((p, idx) => {
      const dt = new Date(p.punch_time);
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

  const buttonDisabled = limitReached || insertPunch.isPending || !collaboratorId || justRegistered;

  const buttonText = limitReached
    ? 'Limite atingido hoje'
    : justRegistered
      ? 'Registrado ✓'
      : 'REGISTRAR PONTO';

  // ── Desktop version ──
  const desktopView = (
    <div className="hidden md:block max-w-md mx-auto space-y-6 pt-4">
      <div className="text-center space-y-1">
        <h1 className="text-xl font-bold text-foreground">Meu Ponto</h1>
        {usuario && <p className="text-sm text-muted-foreground">{usuario.nome}</p>}
      </div>

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

      <Button
        onClick={handlePunch}
        disabled={buttonDisabled}
        className={`w-full h-14 text-lg font-bold shadow-lg transition-transform duration-200 ${
          justRegistered
            ? 'bg-gray-500 hover:bg-gray-500 text-white scale-95'
            : limitReached
              ? ''
              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
        }`}
        size="lg"
      >
        <Fingerprint className="w-6 h-6 mr-2" />
        {buttonText}
      </Button>

      <Card>
        <CardContent className="py-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Batidas de hoje</p>
            <Badge variant="secondary" className="text-xs">{punchCount}/{MAX_PUNCHES}</Badge>
          </div>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : punchList.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma batida registrada hoje</p>
          ) : (
            <div className="space-y-2">
              {punchList.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50">
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

  // ── Mobile version ──
  const mobileView = (
    <div className="md:hidden fixed inset-0 z-50 flex flex-col bg-[#1A1A1A] text-white p-6 overflow-y-auto">
      {/* Name */}
      <div className="text-center pt-4">
        {usuario && (
          <p className="text-lg font-bold text-white">{usuario.nome}</p>
        )}
      </div>

      {/* Clock */}
      <div className="flex-1 flex flex-col items-center justify-center space-y-2 -mt-8">
        <span className="text-5xl font-mono font-bold tracking-tight text-white tabular-nums">
          {formatBRTTime(clock)}
        </span>
        <p className="text-sm text-white/60 capitalize">{dateDisplay}</p>
      </div>

      {/* Button */}
      <div className="py-6">
        <button
          onClick={handlePunch}
          disabled={buttonDisabled}
          className={`w-full h-16 text-xl font-bold rounded-xl shadow-lg flex items-center justify-center gap-3 transition-all duration-200 ${
            justRegistered
              ? 'bg-gray-600 text-white/80 scale-95'
              : limitReached
                ? 'bg-gray-700 text-white/50 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white'
          }`}
        >
          <Fingerprint className="w-7 h-7" />
          {buttonText}
        </button>
      </div>

      {/* Punches list */}
      <div className="space-y-2 pb-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-white/70">Batidas de hoje</p>
          <span className="text-xs text-white/40">{punchCount}/{MAX_PUNCHES}</span>
        </div>

        {isLoading ? (
          <p className="text-sm text-white/50">Carregando...</p>
        ) : punchList.length === 0 ? (
          <p className="text-sm text-white/40 text-center py-3">Nenhuma batida registrada</p>
        ) : (
          <div className="space-y-1.5">
            {punchList.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-white/5"
              >
                <span className="font-mono text-lg font-bold text-white">{p.time}</span>
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    p.label === 'Entrada'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}
                >
                  {p.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {mobileView}
      {desktopView}
    </>
  );
}
