import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, CalendarDays, UserX, Palmtree, AlertTriangle, FlaskConical, Briefcase } from 'lucide-react';
import type { Collaborator } from '@/types/collaborator';
import type { ScheduledVacation } from '@/hooks/useScheduledVacations';
import type { AvisoPrevio } from '@/hooks/useAvisosPrevios';
import type { HolidayCompensation } from '@/hooks/useHolidayCompensations';

export interface HREvent {
  id: string;
  date: string; // YYYY-MM-DD
  type: 'desligamento' | 'aviso_inicio' | 'aviso_fim' | 'ferias_inicio' | 'ferias_fim' | 'ferias_pagamento' | 'experiencia_inicio' | 'experiencia_fim' | 'exame' | 'contabilidade' | 'compensacao' | 'rescisao_pagamento' | 'rescisao_assinatura';
  label: string;
  collaboratorName: string;
  sector: string;
  observacao?: string;
}

const EVENT_CATEGORIES = {
  ferias: { label: 'Férias', types: ['ferias_inicio', 'ferias_fim', 'ferias_pagamento'] as string[], color: 'bg-yellow-400', textColor: 'text-yellow-900' },
  aviso: { label: 'Aviso Prévio', types: ['aviso_inicio', 'aviso_fim', 'rescisao_pagamento', 'rescisao_assinatura'] as string[], color: 'bg-orange-400', textColor: 'text-orange-900' },
  desligamento: { label: 'Desligamentos', types: ['desligamento'] as string[], color: 'bg-red-500', textColor: 'text-white' },
  experiencia: { label: 'Experiência', types: ['experiencia_inicio', 'experiencia_fim'] as string[], color: 'bg-blue-400', textColor: 'text-blue-900' },
  compensacao: { label: 'Compensações', types: ['compensacao'] as string[], color: 'bg-green-400', textColor: 'text-green-900' },
  admin: { label: 'Administrativo', types: ['exame', 'contabilidade'] as string[], color: 'bg-purple-400', textColor: 'text-purple-900' },
} as const;

type CategoryKey = keyof typeof EVENT_CATEGORIES;

const EVENT_TYPE_META: Record<string, { emoji: string; label: string; category: CategoryKey }> = {
  desligamento: { emoji: '🔴', label: 'Desligamento', category: 'desligamento' },
  aviso_inicio: { emoji: '🟠', label: 'Início aviso prévio', category: 'aviso' },
  aviso_fim: { emoji: '🟢', label: 'Fim aviso prévio', category: 'aviso' },
  ferias_inicio: { emoji: '🟡', label: 'Início férias', category: 'ferias' },
  ferias_pagamento: { emoji: '💰', label: 'Pagamento férias', category: 'ferias' },
  ferias_fim: { emoji: '🟡', label: 'Fim férias', category: 'ferias' },
  experiencia_inicio: { emoji: '🔵', label: 'Início experiência', category: 'experiencia' },
  experiencia_fim: { emoji: '🔵', label: 'Fim experiência', category: 'experiencia' },
  exame: { emoji: '🟣', label: 'Exame demissional', category: 'admin' },
  contabilidade: { emoji: '🟣', label: 'Envio contabilidade', category: 'admin' },
  compensacao: { emoji: '🟢', label: 'Compensação feriado', category: 'compensacao' },
  rescisao_pagamento: { emoji: '💵', label: 'Pgto. verbas rescisórias', category: 'aviso' },
  rescisao_assinatura: { emoji: '✍️', label: 'Assinatura rescisão', category: 'aviso' },
};

function getEventColor(type: string): string {
  const meta = EVENT_TYPE_META[type];
  if (!meta) return 'bg-muted';
  return EVENT_CATEGORIES[meta.category].color;
}

function buildEvents(
  collaborators: Collaborator[],
  vacations: ScheduledVacation[],
  avisos: AvisoPrevio[],
  compensations: HolidayCompensation[],
): HREvent[] {
  const events: HREvent[] = [];

  // Desligamentos
  for (const c of collaborators) {
    if (c.data_desligamento) {
      events.push({ id: `desl-${c.id}`, date: c.data_desligamento, type: 'desligamento', label: 'Desligamento', collaboratorName: c.collaborator_name, sector: c.sector });
    }
    // Experiência
    if (c.status === 'EXPERIENCIA') {
      if (c.inicio_periodo) {
        events.push({ id: `exp-i-${c.id}`, date: c.inicio_periodo, type: 'experiencia_inicio', label: 'Início experiência', collaboratorName: c.collaborator_name, sector: c.sector });
      }
      if (c.fim_periodo) {
        events.push({ id: `exp-f-${c.id}`, date: c.fim_periodo, type: 'experiencia_fim', label: 'Fim experiência', collaboratorName: c.collaborator_name, sector: c.sector });
      }
    }
  }

  // Férias
  for (const v of vacations) {
    if (v.status === 'CANCELADA') continue;
    events.push({ id: `fer-i-${v.id}`, date: v.data_inicio_ferias, type: 'ferias_inicio', label: 'Início férias', collaboratorName: v.collaborator_name, sector: v.sector });
    events.push({ id: `fer-f-${v.id}`, date: v.data_fim_ferias, type: 'ferias_fim', label: 'Fim férias', collaboratorName: v.collaborator_name, sector: v.sector, observacao: v.observacao });
    // Lembrete de pagamento (usa campo do DB ou calcula 3 dias antes)
    const payDateStr = v.data_pagamento_ferias || (() => {
      const startDate = new Date(v.data_inicio_ferias + 'T00:00:00');
      const payDate = new Date(startDate);
      payDate.setDate(payDate.getDate() - 3);
      return `${payDate.getFullYear()}-${String(payDate.getMonth() + 1).padStart(2, '0')}-${String(payDate.getDate()).padStart(2, '0')}`;
    })();
    events.push({ id: `fer-p-${v.id}`, date: payDateStr, type: 'ferias_pagamento', label: `Pagamento das férias do colaborador ${v.collaborator_name}`, collaboratorName: v.collaborator_name, sector: v.sector, observacao: `Pagamento deve ser realizado até esta data (3 dias antes do início das férias em ${v.data_inicio_ferias.split('-').reverse().join('/')})` });
  }

  // Avisos prévios
  for (const a of avisos) {
    events.push({ id: `av-i-${a.id}`, date: a.data_inicio, type: 'aviso_inicio', label: 'Início aviso prévio', collaboratorName: a.collaborator_name, sector: a.sector, observacao: a.observacoes || undefined });
    events.push({ id: `av-f-${a.id}`, date: a.data_fim, type: 'aviso_fim', label: 'Fim aviso prévio', collaboratorName: a.collaborator_name, sector: a.sector });

    // Auto-calculated deadlines based on data_fim (último dia trabalhado)
    const fimDate = new Date(a.data_fim + 'T00:00:00');

    // Contabilidade: D+1 após último dia trabalhado
    const contabDate = new Date(fimDate);
    contabDate.setDate(contabDate.getDate() + 1);
    const contabStr = contabDate.toISOString().slice(0, 10);
    events.push({ id: `cont-auto-${a.id}`, date: contabStr, type: 'contabilidade', label: `Info contabilidade — ${a.collaborator_name}`, collaboratorName: a.collaborator_name, sector: a.sector, observacao: `Enviar informações para contabilidade (D+1 do último dia trabalhado: ${a.data_fim.split('-').reverse().join('/')})` });

    // Exame demissional: D+1 após último dia trabalhado
    events.push({ id: `ex-auto-${a.id}`, date: contabStr, type: 'exame', label: `Exame demissional — ${a.collaborator_name}`, collaboratorName: a.collaborator_name, sector: a.sector, observacao: `Exame demissional (D+1 do último dia trabalhado: ${a.data_fim.split('-').reverse().join('/')})` });

    // Pagamento das verbas rescisórias: D+7 do último dia trabalhado
    const pagDate = new Date(fimDate);
    pagDate.setDate(pagDate.getDate() + 7);
    const pagStr = pagDate.toISOString().slice(0, 10);
    events.push({ id: `pag-auto-${a.id}`, date: pagStr, type: 'rescisao_pagamento', label: `Pagamento verbas rescisórias — ${a.collaborator_name}`, collaboratorName: a.collaborator_name, sector: a.sector, observacao: `Prazo para pagamento das verbas rescisórias (D+7 do último dia trabalhado: ${a.data_fim.split('-').reverse().join('/')})` });

    // Assinatura dos documentos: D+8 do último dia trabalhado
    const assDate = new Date(fimDate);
    assDate.setDate(assDate.getDate() + 8);
    const assStr = assDate.toISOString().slice(0, 10);
    events.push({ id: `ass-auto-${a.id}`, date: assStr, type: 'rescisao_assinatura', label: `Assinatura rescisão — ${a.collaborator_name}`, collaboratorName: a.collaborator_name, sector: a.sector, observacao: `Assinatura dos documentos da rescisão com colaborador (D+8 do último dia trabalhado: ${a.data_fim.split('-').reverse().join('/')})` });
  }

  // Compensações
  for (const c of compensations) {
    if (c.compensation_date && c.status === 'COMPENSADO') {
      events.push({ id: `comp-${c.id}`, date: c.compensation_date, type: 'compensacao', label: `Compensação — ${c.holiday_name}`, collaboratorName: c.collaborator_name, sector: c.sector });
    }
  }

  return events;
}

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function getCalendarDays(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function fmt(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

interface Props {
  collaborators: Collaborator[];
  vacations: ScheduledVacation[];
  avisos: AvisoPrevio[];
  compensations: HolidayCompensation[];
}

export default function HRCalendar({ collaborators, vacations, avisos, compensations }: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [activeFilters, setActiveFilters] = useState<Set<CategoryKey>>(new Set(Object.keys(EVENT_CATEGORIES) as CategoryKey[]));
  const [selectedEvent, setSelectedEvent] = useState<HREvent | null>(null);

  const allEvents = useMemo(() => buildEvents(collaborators, vacations, avisos, compensations), [collaborators, vacations, avisos, compensations]);

  // Filter events by active categories
  const filteredEvents = useMemo(() => {
    const activeTypes = new Set<string>();
    for (const cat of activeFilters) {
      for (const t of EVENT_CATEGORIES[cat].types) activeTypes.add(t);
    }
    return allEvents.filter(e => activeTypes.has(e.type));
  }, [allEvents, activeFilters]);

  // Events for current month
  const monthEvents = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    return filteredEvents.filter(e => e.date.startsWith(prefix));
  }, [filteredEvents, year, month]);

  // Map date -> events
  const eventsByDate = useMemo(() => {
    const map = new Map<string, HREvent[]>();
    for (const e of monthEvents) {
      const existing = map.get(e.date) || [];
      existing.push(e);
      map.set(e.date, existing);
    }
    return map;
  }, [monthEvents]);

  // Month summary
  const summary = useMemo(() => {
    const desligamentos = monthEvents.filter(e => e.type === 'desligamento').length;
    const ferias = monthEvents.filter(e => e.type === 'ferias_inicio').length;
    const avisosAtivos = monthEvents.filter(e => e.type === 'aviso_inicio' || e.type === 'aviso_fim').length;
    const eventosRH = monthEvents.filter(e => e.type === 'exame' || e.type === 'contabilidade' || e.type === 'compensacao').length;
    return { desligamentos, ferias, avisosAtivos, eventosRH };
  }, [monthEvents]);

  const cells = getCalendarDays(year, month);
  const todayStr = fmt(today.getFullYear(), today.getMonth(), today.getDate());

  const in7Days = new Date(today);
  in7Days.setDate(in7Days.getDate() + 7);

  function toggleFilter(cat: CategoryKey) {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  }

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }

  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  function isNear(dateStr: string): boolean {
    const d = new Date(dateStr + 'T00:00:00');
    return d >= today && d <= in7Days;
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="w-5 h-5 text-primary" />
            Calendário de Compromissos RH
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <SummaryCard icon={<UserX className="w-4 h-4" />} label="Desligamentos" value={summary.desligamentos} color="text-red-500" />
            <SummaryCard icon={<Palmtree className="w-4 h-4" />} label="Início férias" value={summary.ferias} color="text-yellow-600" />
            <SummaryCard icon={<AlertTriangle className="w-4 h-4" />} label="Avisos prévios" value={summary.avisosAtivos} color="text-orange-500" />
            <SummaryCard icon={<Briefcase className="w-4 h-4" />} label="Eventos RH" value={summary.eventosRH} color="text-purple-500" />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            {(Object.entries(EVENT_CATEGORIES) as [CategoryKey, typeof EVENT_CATEGORIES[CategoryKey]][]).map(([key, cat]) => (
              <label key={key} className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                <Checkbox
                  checked={activeFilters.has(key)}
                  onCheckedChange={() => toggleFilter(key)}
                  className="w-3.5 h-3.5"
                />
                <span className={`w-2.5 h-2.5 rounded-full ${cat.color}`} />
                {cat.label}
              </label>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={prevMonth}><ChevronLeft className="w-4 h-4" /></Button>
            <span className="font-semibold text-sm">{MONTH_NAMES[month]} {year}</span>
            <Button variant="ghost" size="icon" onClick={nextMonth}><ChevronRight className="w-4 h-4" /></Button>
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 text-center text-[11px] font-medium text-muted-foreground">
            {WEEKDAY_LABELS.map(d => <div key={d} className="py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 border-t border-l border-border">
            {cells.map((day, i) => {
              const dateStr = day ? fmt(year, month, day) : '';
              const dayEvents = day ? eventsByDate.get(dateStr) || [] : [];
              const isToday = dateStr === todayStr;
              const hasNearEvent = dayEvents.some(e => isNear(e.date));

              return (
                <div
                  key={i}
                  className={`border-r border-b border-border min-h-[60px] sm:min-h-[80px] p-0.5 ${
                    day ? '' : 'bg-muted/30'
                  } ${isToday ? 'bg-primary/5' : ''} ${hasNearEvent ? 'ring-2 ring-inset ring-orange-400/60' : ''}`}
                >
                  {day && (
                    <>
                      <div className={`text-[11px] px-1 ${isToday ? 'font-bold text-primary' : 'text-muted-foreground'}`}>
                        {day}
                      </div>
                      <div className="space-y-0.5 mt-0.5">
                        {dayEvents.slice(0, 3).map(ev => (
                          <button
                            key={ev.id}
                            onClick={() => setSelectedEvent(ev)}
                            className={`w-full text-left text-[9px] sm:text-[10px] leading-tight px-1 py-0.5 rounded truncate ${getEventColor(ev.type)} ${EVENT_TYPE_META[ev.type]?.category ? EVENT_CATEGORIES[EVENT_TYPE_META[ev.type].category].textColor : ''} hover:opacity-80 transition-opacity`}
                            title={`${ev.label} — ${ev.collaboratorName}`}
                          >
                            <span className="hidden sm:inline">{EVENT_TYPE_META[ev.type]?.emoji} </span>
                            {ev.collaboratorName}
                          </button>
                        ))}
                        {dayEvents.length > 3 && (
                          <div className="text-[9px] text-muted-foreground px-1">+{dayEvents.length - 3} mais</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Event detail dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedEvent && EVENT_TYPE_META[selectedEvent.type]?.emoji}
              {selectedEvent?.label}
            </DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-muted-foreground">Colaborador</span>
                  <p className="font-medium">{selectedEvent.collaboratorName}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Setor</span>
                  <p className="font-medium">{selectedEvent.sector}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Tipo</span>
                  <p className="font-medium">{EVENT_TYPE_META[selectedEvent.type]?.label}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Data</span>
                  <p className="font-medium">{selectedEvent.date.split('-').reverse().join('/')}</p>
                </div>
              </div>
              {selectedEvent.observacao && (
                <div>
                  <span className="text-muted-foreground">Observações</span>
                  <p className="mt-1">{selectedEvent.observacao}</p>
                </div>
              )}
              <Badge variant="outline" className={`${getEventColor(selectedEvent.type)} ${EVENT_TYPE_META[selectedEvent.type]?.category ? EVENT_CATEGORIES[EVENT_TYPE_META[selectedEvent.type].category].textColor : ''} border-0`}>
                {EVENT_TYPE_META[selectedEvent.type]?.label}
              </Badge>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function SummaryCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border p-2">
      <div className={color}>{icon}</div>
      <div>
        <div className="text-lg font-bold leading-none">{value}</div>
        <div className="text-[10px] text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}
