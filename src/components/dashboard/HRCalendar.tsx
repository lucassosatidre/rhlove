import { useState, useMemo, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ChevronLeft, ChevronRight, CalendarDays, UserX, Palmtree, AlertTriangle,
  Briefcase, Check, X, Clock, GripVertical, Plus, Bell, Filter,
  AlertCircle, CalendarCheck, List, Trash2, Ban
} from 'lucide-react';
import { useUpdateAvisoPrevio } from '@/hooks/useAvisosPrevios';
import { useHolidays } from '@/hooks/useHolidayCompensations';
import { useUpdateScheduledVacation } from '@/hooks/useScheduledVacations';
import { useUpdateCollaborator } from '@/hooks/useCollaborators';
import { useReminders, useUpdateReminder, useDeleteReminder, generateRecurringInstances, PRIORITIES, REMINDER_TYPES, REMINDER_STATUSES } from '@/hooks/useReminders';
import { useEventCompletions, useUpsertEventCompletion } from '@/hooks/useEventCompletions';
import { useToast } from '@/hooks/use-toast';
import NewReminderDialog from '@/components/NewReminderDialog';
import type { Collaborator } from '@/types/collaborator';
import type { ScheduledVacation } from '@/hooks/useScheduledVacations';
import type { AvisoPrevio } from '@/hooks/useAvisosPrevios';
import type { HolidayCompensation } from '@/hooks/useHolidayCompensations';
import type { HRReminder } from '@/hooks/useReminders';

/* ───── Event types ───── */

export interface HREvent {
  id: string;
  date: string;           // effective date (may be overridden)
  originalDate: string;    // computed/original date
  type: string;
  label: string;
  collaboratorName: string;
  sector: string;
  observacao?: string;
  avisoId?: string;
  avisoField?: 'enviado_contabilidade' | 'exame' | 'pago' | 'assinatura';
  avisoFieldValue?: boolean;
  avisoDateField?: string;
  vacationId?: string;
  vacationField?: 'aviso_ferias_assinado' | 'contabilidade_solicitada' | 'pagamento_efetuado' | 'recibo_assinado';
  vacationFieldValue?: boolean;
  reminderId?: string;
  reminder?: HRReminder;
  priority?: string;
  isManual?: boolean;
  // Generic completion status from hr_event_completions
  completionStatus?: string; // pendente | concluido | nao_executado
}

/* ───── Categories & Meta ───── */

const EVENT_CATEGORIES = {
  ferias: { label: 'Férias', types: ['ferias_inicio', 'ferias_fim', 'ferias_pagamento', 'ferias_aviso', 'ferias_contabilidade', 'ferias_pagamento_exec', 'ferias_recibo', 'ferias_retorno'] as string[], color: 'bg-yellow-400', textColor: 'text-yellow-900' },
  aviso: { label: 'Aviso Prévio', types: ['aviso_inicio', 'aviso_fim', 'rescisao_pagamento', 'rescisao_assinatura'] as string[], color: 'bg-orange-400', textColor: 'text-orange-900' },
  desligamento: { label: 'Desligamentos', types: ['desligamento'] as string[], color: 'bg-red-500', textColor: 'text-white' },
  experiencia: { label: 'Experiência', types: ['experiencia_inicio', 'experiencia_fim'] as string[], color: 'bg-blue-400', textColor: 'text-blue-900' },
  compensacao: { label: 'Compensações', types: ['compensacao'] as string[], color: 'bg-green-400', textColor: 'text-green-900' },
  admin: { label: 'Administrativo', types: ['exame', 'contabilidade'] as string[], color: 'bg-purple-400', textColor: 'text-purple-900' },
  folha: { label: 'Folha de Pagamento', types: ['salario', 'adiantamento'] as string[], color: 'bg-emerald-500', textColor: 'text-white' },
  lembrete: { label: 'Lembretes', types: ['lembrete'] as string[], color: 'bg-teal-400', textColor: 'text-teal-900' },
} as const;

type CategoryKey = keyof typeof EVENT_CATEGORIES;

const EVENT_TYPE_META: Record<string, { emoji: string; label: string; shortLabel: string; category: CategoryKey }> = {
  desligamento: { emoji: '🔴', label: 'Desligamento', shortLabel: 'Deslig.', category: 'desligamento' },
  aviso_inicio: { emoji: '🟠', label: 'Início aviso prévio', shortLabel: 'Início AP', category: 'aviso' },
  aviso_fim: { emoji: '🟢', label: 'Fim aviso prévio', shortLabel: 'Fim AP', category: 'aviso' },
  ferias_inicio: { emoji: '🟡', label: 'Início férias', shortLabel: 'Início Fér.', category: 'ferias' },
  ferias_pagamento: { emoji: '💰', label: 'Pagamento férias', shortLabel: 'Pgto Fér.', category: 'ferias' },
  ferias_fim: { emoji: '🟡', label: 'Fim férias', shortLabel: 'Fim Fér.', category: 'ferias' },
  ferias_aviso: { emoji: '📋', label: 'Assinar aviso de férias', shortLabel: 'Aviso Fér.', category: 'ferias' },
  ferias_contabilidade: { emoji: '📄', label: 'Solicitar docs à contabilidade', shortLabel: 'Contab. Fér.', category: 'ferias' },
  ferias_pagamento_exec: { emoji: '💵', label: 'Efetuar pagamento das férias', shortLabel: 'Pgto Fér.', category: 'ferias' },
  ferias_recibo: { emoji: '✍️', label: 'Assinar recibo de pagamento', shortLabel: 'Recibo Fér.', category: 'ferias' },
  ferias_retorno: { emoji: '🔄', label: 'Retorno de férias', shortLabel: 'Retorno', category: 'ferias' },
  experiencia_inicio: { emoji: '🔵', label: 'Início experiência', shortLabel: 'Início Exp.', category: 'experiencia' },
  experiencia_fim: { emoji: '🔵', label: 'Fim experiência', shortLabel: 'Fim Exp.', category: 'experiencia' },
  exame: { emoji: '🟣', label: 'Exame demissional', shortLabel: 'Exame', category: 'admin' },
  contabilidade: { emoji: '🟣', label: 'Envio contabilidade', shortLabel: 'Contab.', category: 'admin' },
  compensacao: { emoji: '🟢', label: 'Compensação feriado', shortLabel: 'Compens.', category: 'compensacao' },
  rescisao_pagamento: { emoji: '💵', label: 'Pgto. verbas rescisórias', shortLabel: 'Pgto Resc.', category: 'aviso' },
  rescisao_assinatura: { emoji: '✍️', label: 'Assinatura rescisão', shortLabel: 'Assinatura', category: 'aviso' },
  lembrete: { emoji: '🔔', label: 'Lembrete', shortLabel: 'Lembrete', category: 'lembrete' },
  salario: { emoji: '💰', label: 'Pagamento de salário', shortLabel: 'Salário', category: 'folha' },
  adiantamento: { emoji: '💵', label: 'Adiantamento salarial', shortLabel: 'Adiantamento', category: 'folha' },
};

/* ───── Payroll date helpers ───── */

/** Check if a date is a non-business day (sunday or holiday). Saturday IS a business day per CLT. */
function isNonBusinessDay(d: Date, holidaySet: Set<string>): boolean {
  if (d.getDay() === 0) return true; // domingo
  if (holidaySet.has(toDateStr(d))) return true;
  return false;
}

/** Get the 5th business day of a given month/year (CLT Art. 459). Sat counts as business day. */
function get5thBusinessDay(year: number, month: number, holidaySet: Set<string>): Date {
  let count = 0;
  const d = new Date(year, month, 1);
  while (count < 5) {
    if (!isNonBusinessDay(d, holidaySet)) {
      count++;
      if (count === 5) return new Date(d);
    }
    d.setDate(d.getDate() + 1);
  }
  return d;
}

/** Get day 15 of a month, or next business day if it falls on sunday/holiday. */
function getAdjusted15th(year: number, month: number, holidaySet: Set<string>): Date {
  const d = new Date(year, month, 15);
  while (isNonBusinessDay(d, holidaySet)) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

/** Build payroll events for a range of months */
function buildPayrollEvents(startYear: number, startMonth: number, months: number, holidaySet: Set<string>): HREvent[] {
  const events: HREvent[] = [];
  for (let i = 0; i < months; i++) {
    let y = startYear;
    let m = startMonth + i;
    if (m > 11) { y += Math.floor(m / 12); m = m % 12; }

    // Salário: 5º dia útil do mês (paga o mês anterior)
    const salDate = get5thBusinessDay(y, m, holidaySet);
    const salStr = toDateStr(salDate);
    const prevMonth = m === 0 ? 12 : m;
    const prevMonthName = MONTH_NAMES[prevMonth - 1];
    events.push({
      id: `salario-${y}-${m}`,
      date: salStr,
      originalDate: salStr,
      type: 'salario',
      label: `Pagamento salário (ref. ${prevMonthName})`,
      collaboratorName: 'EQUIPE',
      sector: '',
    });

    // Adiantamento: dia 15 ou próximo dia útil
    const advDate = getAdjusted15th(y, m, holidaySet);
    const advStr = toDateStr(advDate);
    events.push({
      id: `adiantamento-${y}-${m}`,
      date: advStr,
      originalDate: advStr,
      type: 'adiantamento',
      label: `Adiantamento salarial (${MONTH_NAMES[m]})`,
      collaboratorName: 'EQUIPE',
      sector: '',
    });
  }
  return events;
}

function getEventColor(type: string, priority?: string): string {
  if (type === 'lembrete' && priority) {
    const p = PRIORITIES.find(x => x.value === priority);
    if (p) return p.color;
  }
  const meta = EVENT_TYPE_META[type];
  if (!meta) return 'bg-muted';
  return EVENT_CATEGORIES[meta.category].color;
}

function getEventTextColor(type: string): string {
  if (type === 'lembrete') return 'text-white';
  const meta = EVENT_TYPE_META[type];
  if (!meta) return '';
  return EVENT_CATEGORIES[meta.category].textColor;
}

function getStatusIndicator(ev: HREvent): { icon: React.ReactNode; className: string } | null {
  // Manual reminders use their own status
  if (ev.isManual) {
    if (ev.reminder?.status === 'concluido') return { icon: <Check className="w-2.5 h-2.5" />, className: 'text-emerald-600' };
    if (ev.reminder?.status === 'cancelado') return { icon: <X className="w-2.5 h-2.5" />, className: 'text-red-500' };
    if (ev.reminder?.status === 'adiado') return { icon: <Clock className="w-2.5 h-2.5" />, className: 'text-blue-500' };
    return { icon: <Clock className="w-2.5 h-2.5" />, className: 'text-amber-500' };
  }
  // Events with native field (aviso/vacation)
  const fieldVal = ev.avisoField != null ? ev.avisoFieldValue : ev.vacationField != null ? ev.vacationFieldValue : undefined;
  if (fieldVal !== undefined) {
    if (fieldVal === true) return { icon: <Check className="w-2.5 h-2.5" />, className: 'text-emerald-600' };
    return { icon: <Clock className="w-2.5 h-2.5" />, className: 'text-amber-500' };
  }
  // Generic completion status
  if (ev.completionStatus === 'concluido') return { icon: <Check className="w-2.5 h-2.5" />, className: 'text-emerald-600' };
  if (ev.completionStatus === 'nao_executado') return { icon: <Ban className="w-2.5 h-2.5" />, className: 'text-red-500' };
  // Default: pendente (show clock for all auto events)
  return { icon: <Clock className="w-2.5 h-2.5" />, className: 'text-amber-500' };
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getEventOrigin(ev: HREvent): string {
  if (ev.isManual) return 'Lembrete manual';
  if (ev.vacationId || ev.type.startsWith('ferias')) return 'Férias';
  if (ev.avisoId || ev.type.startsWith('aviso') || ev.type.startsWith('rescisao')) return 'Aviso prévio';
  if (ev.type.startsWith('experiencia')) return 'Experiência';
  if (ev.type === 'compensacao') return 'Compensação';
  if (ev.type === 'desligamento') return 'Desligamento';
  if (ev.type === 'salario' || ev.type === 'adiantamento') return 'Folha de pagamento';
  if (ev.type === 'exame' || ev.type === 'contabilidade') return 'Aviso prévio';
  return 'Automático';
}

/* ───── Build automatic events ───── */

function buildAutoEvents(
  collaborators: Collaborator[],
  vacations: ScheduledVacation[],
  avisos: AvisoPrevio[],
  compensations: HolidayCompensation[],
): HREvent[] {
  const events: HREvent[] = [];

  const mkEv = (base: Omit<HREvent, 'originalDate'>): HREvent => ({ ...base, originalDate: base.date });

  for (const c of collaborators) {
    if (c.data_desligamento) {
      events.push(mkEv({ id: `desl-${c.id}`, date: c.data_desligamento, type: 'desligamento', label: 'Desligamento', collaboratorName: c.collaborator_name, sector: c.sector }));
    }
    if (c.status === 'EXPERIENCIA') {
      if (c.inicio_periodo) events.push(mkEv({ id: `exp-i-${c.id}`, date: c.inicio_periodo, type: 'experiencia_inicio', label: 'Início experiência', collaboratorName: c.collaborator_name, sector: c.sector }));
      if (c.fim_periodo) events.push(mkEv({ id: `exp-f-${c.id}`, date: c.fim_periodo, type: 'experiencia_fim', label: 'Fim experiência', collaboratorName: c.collaborator_name, sector: c.sector }));
    }
  }

  for (const v of vacations) {
    if (v.status === 'CANCELADA') continue;
    const inicioDate = new Date(v.data_inicio_ferias + 'T00:00:00');
    const fimDate = new Date(v.data_fim_ferias + 'T00:00:00');
    events.push(mkEv({ id: `fer-i-${v.id}`, date: v.data_inicio_ferias, type: 'ferias_inicio', label: 'Início férias', collaboratorName: v.collaborator_name, sector: v.sector }));
    events.push(mkEv({ id: `fer-f-${v.id}`, date: v.data_fim_ferias, type: 'ferias_fim', label: 'Fim férias', collaboratorName: v.collaborator_name, sector: v.sector, observacao: v.observacao }));

    const avisoFerDate = new Date(inicioDate); avisoFerDate.setDate(avisoFerDate.getDate() - 30);
    events.push(mkEv({ id: `fer-aviso-${v.id}`, date: toDateStr(avisoFerDate), type: 'ferias_aviso', label: 'Assinar aviso de férias', collaboratorName: v.collaborator_name, sector: v.sector, vacationId: v.id, vacationField: 'aviso_ferias_assinado', vacationFieldValue: v.aviso_ferias_assinado }));

    const contabFerDate = new Date(avisoFerDate); contabFerDate.setDate(contabFerDate.getDate() - 3);
    events.push(mkEv({ id: `fer-contab-${v.id}`, date: toDateStr(contabFerDate), type: 'ferias_contabilidade', label: 'Solicitar docs à contabilidade', collaboratorName: v.collaborator_name, sector: v.sector, vacationId: v.id, vacationField: 'contabilidade_solicitada', vacationFieldValue: v.contabilidade_solicitada }));

    const pagFerDate = new Date(inicioDate); pagFerDate.setDate(pagFerDate.getDate() - 2);
    events.push(mkEv({ id: `fer-pgto-${v.id}`, date: toDateStr(pagFerDate), type: 'ferias_pagamento_exec', label: 'Efetuar pagamento das férias', collaboratorName: v.collaborator_name, sector: v.sector, vacationId: v.id, vacationField: 'pagamento_efetuado', vacationFieldValue: v.pagamento_efetuado }));
    events.push(mkEv({ id: `fer-recibo-${v.id}`, date: toDateStr(pagFerDate), type: 'ferias_recibo', label: 'Assinar recibo de pagamento', collaboratorName: v.collaborator_name, sector: v.sector, vacationId: v.id, vacationField: 'recibo_assinado', vacationFieldValue: v.recibo_assinado }));

    const retornoDate = new Date(fimDate); retornoDate.setDate(retornoDate.getDate() + 1);
    events.push(mkEv({ id: `fer-retorno-${v.id}`, date: toDateStr(retornoDate), type: 'ferias_retorno', label: 'Retorno de férias', collaboratorName: v.collaborator_name, sector: v.sector }));
  }

  for (const a of avisos) {
    events.push(mkEv({ id: `av-i-${a.id}`, date: a.data_inicio, type: 'aviso_inicio', label: 'Início aviso prévio', collaboratorName: a.collaborator_name, sector: a.sector, observacao: a.observacoes || undefined, avisoId: a.id, avisoDateField: 'data_inicio' }));
    events.push(mkEv({ id: `av-f-${a.id}`, date: a.data_fim, type: 'aviso_fim', label: 'Fim aviso prévio', collaboratorName: a.collaborator_name, sector: a.sector, avisoId: a.id, avisoDateField: 'data_fim' }));

    const fimDate = new Date(a.data_fim + 'T00:00:00');
    const contabDate = new Date(fimDate); contabDate.setDate(contabDate.getDate() + 1);
    events.push(mkEv({ id: `cont-auto-${a.id}`, date: toDateStr(contabDate), type: 'contabilidade', label: 'Info contabilidade', collaboratorName: a.collaborator_name, sector: a.sector, avisoId: a.id, avisoField: 'enviado_contabilidade', avisoFieldValue: a.enviado_contabilidade }));

    const exameDate = new Date(fimDate); exameDate.setDate(exameDate.getDate() - 7);
    events.push(mkEv({ id: `ex-auto-${a.id}`, date: toDateStr(exameDate), type: 'exame', label: 'Exame demissional', collaboratorName: a.collaborator_name, sector: a.sector, avisoId: a.id, avisoField: 'exame', avisoFieldValue: a.exame }));

    const pagDate = new Date(fimDate); pagDate.setDate(pagDate.getDate() + 7);
    events.push(mkEv({ id: `pag-auto-${a.id}`, date: toDateStr(pagDate), type: 'rescisao_pagamento', label: 'Pagamento verbas rescisórias', collaboratorName: a.collaborator_name, sector: a.sector, avisoId: a.id, avisoField: 'pago', avisoFieldValue: a.pago }));

    const assDate = new Date(fimDate); assDate.setDate(assDate.getDate() + 8);
    events.push(mkEv({ id: `ass-auto-${a.id}`, date: toDateStr(assDate), type: 'rescisao_assinatura', label: 'Assinatura rescisão', collaboratorName: a.collaborator_name, sector: a.sector, avisoId: a.id, avisoField: 'assinatura', avisoFieldValue: a.assinatura }));
  }

  for (const c of compensations) {
    if (c.compensation_date && c.status === 'COMPENSADO') {
      events.push(mkEv({ id: `comp-${c.id}`, date: c.compensation_date, type: 'compensacao', label: `Compensação — ${c.holiday_name}`, collaboratorName: c.collaborator_name, sector: c.sector }));
    }
  }

  return events;
}

/* ───── Calendar helpers ───── */

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

function fmtDate(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const FIELD_LABELS: Record<string, string> = {
  enviado_contabilidade: 'Envio para contabilidade',
  exame: 'Exame demissional',
  pago: 'Pagamento de verbas rescisórias',
  assinatura: 'Assinatura da rescisão',
  aviso_ferias_assinado: 'Assinatura do aviso de férias',
  contabilidade_solicitada: 'Solicitação de docs à contabilidade',
  pagamento_efetuado: 'Pagamento das férias',
  recibo_assinado: 'Assinatura do recibo de pagamento',
};

/* ───── Component ───── */

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
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const draggedEventRef = useRef<HREvent | null>(null);
  const [showNewReminder, setShowNewReminder] = useState(false);
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Filters
  const [filterCollaborator, setFilterCollaborator] = useState('');
  const [filterSector, setFilterSector] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSource, setFilterSource] = useState<'all' | 'auto' | 'manual'>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Postpone / conclusion
  const [postponeDate, setPostponeDate] = useState('');
  const [conclusionNote, setConclusionNote] = useState('');

  const updateAviso = useUpdateAvisoPrevio();
  const updateVacation = useUpdateScheduledVacation();
  const updateCollaborator = useUpdateCollaborator();
  const { data: reminders = [] } = useReminders();
  const updateReminder = useUpdateReminder();
  const deleteReminder = useDeleteReminder();
  const { data: completions = [] } = useEventCompletions();
  const upsertCompletion = useUpsertEventCompletion();
  const { data: holidays = [] } = useHolidays();
  const { toast } = useToast();

  // Build holiday set for payroll calculations
  const holidaySet = useMemo(() => {
    const set = new Set<string>();
    for (const h of holidays) set.add(h.date);
    return set;
  }, [holidays]);

  const todayStr = toDateStr(today);

  // Build completions map
  const completionsMap = useMemo(() => {
    const map = new Map<string, { status: string; override_date: string | null }>();
    for (const c of completions) {
      map.set(c.event_key, { status: c.status, override_date: c.override_date });
    }
    return map;
  }, [completions]);

  // Build all events with completions applied
  const allEvents = useMemo(() => {
    const autoEvents = buildAutoEvents(collaborators, vacations, avisos, compensations);

    // Apply completions (override dates + statuses) to auto events
    for (const ev of autoEvents) {
      const comp = completionsMap.get(ev.id);
      if (comp) {
        ev.completionStatus = comp.status;
        if (comp.override_date) {
          ev.date = comp.override_date;
        }
      }
    }

    // Add manual reminders with recurrence expansion for visible range
    const rangeStart = new Date(year, month - 1, 1);
    const rangeEnd = new Date(year, month + 2, 0);
    const manualEvents: HREvent[] = [];

    for (const r of reminders) {
      const instances = generateRecurringInstances(r, rangeStart, rangeEnd);
      for (const inst of instances) {
        manualEvents.push({
          id: `rem-${r.id}-${inst.date}`,
          date: inst.date,
          originalDate: inst.date,
          type: 'lembrete',
          label: r.title,
          collaboratorName: r.collaborator_name || 'RH',
          sector: r.sector || '',
          observacao: r.description,
          reminderId: r.id,
          reminder: r,
          priority: r.priority,
          isManual: true,
        });
      }
    }

    // Add payroll events (salary + advance) for visible range
    const payrollEvents = buildPayrollEvents(year, month > 0 ? month - 1 : 11, 4, holidaySet);
    for (const ev of payrollEvents) {
      const comp = completionsMap.get(ev.id);
      if (comp) {
        ev.completionStatus = comp.status;
        if (comp.override_date) ev.date = comp.override_date;
      }
    }

    return [...autoEvents, ...manualEvents, ...payrollEvents];
  }, [collaborators, vacations, avisos, compensations, reminders, year, month, completionsMap, holidaySet]);

  // Apply filters
  const filteredEvents = useMemo(() => {
    let result = allEvents;

    // Category filter
    const activeTypes = new Set<string>();
    for (const cat of activeFilters) {
      for (const t of EVENT_CATEGORIES[cat].types) activeTypes.add(t);
    }
    result = result.filter(e => activeTypes.has(e.type));

    if (filterCollaborator) result = result.filter(e => e.collaboratorName.toLowerCase().includes(filterCollaborator.toLowerCase()));
    if (filterSector) result = result.filter(e => e.sector === filterSector);
    if (filterType) result = result.filter(e => {
      if (e.isManual) return e.reminder?.reminder_type === filterType;
      const meta = EVENT_TYPE_META[e.type];
      return meta?.category === filterType;
    });
    if (filterPriority) result = result.filter(e => e.priority === filterPriority);
    if (filterStatus) {
      result = result.filter(e => {
        if (e.isManual) return e.reminder?.status === filterStatus;
        // Check native field first
        const fv = e.avisoField != null ? e.avisoFieldValue : e.vacationField != null ? e.vacationFieldValue : undefined;
        if (fv !== undefined) {
          if (filterStatus === 'concluido') return fv === true;
          if (filterStatus === 'pendente') return fv === false;
          return true;
        }
        // Use generic completion status
        const cs = e.completionStatus || 'pendente';
        return cs === filterStatus;
      });
    }
    if (filterSource === 'auto') result = result.filter(e => !e.isManual);
    if (filterSource === 'manual') result = result.filter(e => e.isManual);

    return result;
  }, [allEvents, activeFilters, filterCollaborator, filterSector, filterType, filterPriority, filterStatus, filterSource]);

  const monthEvents = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    return filteredEvents.filter(e => e.date.startsWith(prefix));
  }, [filteredEvents, year, month]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, HREvent[]>();
    for (const e of monthEvents) {
      const existing = map.get(e.date) || [];
      existing.push(e);
      map.set(e.date, existing);
    }
    return map;
  }, [monthEvents]);

  // Pending list - check effective status
  const pendingEvents = useMemo(() => {
    const now = toDateStr(today);
    const in3 = new Date(today); in3.setDate(in3.getDate() + 3);
    const in7 = new Date(today); in7.setDate(in7.getDate() + 7);
    const in3Str = toDateStr(in3);
    const in7Str = toDateStr(in7);

    const isPending = (e: HREvent) => {
      if (e.isManual) return e.reminder?.status === 'pendente';
      // Native field
      const fv = e.avisoField != null ? e.avisoFieldValue : e.vacationField != null ? e.vacationFieldValue : undefined;
      if (fv !== undefined) return fv === false;
      // Generic completion
      return (e.completionStatus || 'pendente') === 'pendente';
    };

    const pending = filteredEvents.filter(isPending);
    const overdue = pending.filter(e => e.date < now);
    const dueToday = pending.filter(e => e.date === now);
    const due3 = pending.filter(e => e.date > now && e.date <= in3Str);
    const due7 = pending.filter(e => e.date > in3Str && e.date <= in7Str);

    return { overdue, dueToday, due3, due7 };
  }, [filteredEvents, today]);

  // Summary
  const summary = useMemo(() => ({
    desligamentos: monthEvents.filter(e => e.type === 'desligamento').length,
    ferias: monthEvents.filter(e => e.type === 'ferias_inicio').length,
    avisosAtivos: monthEvents.filter(e => e.type === 'aviso_inicio' || e.type === 'aviso_fim').length,
    lembretes: monthEvents.filter(e => e.isManual).length,
    total: monthEvents.length,
  }), [monthEvents]);

  const cells = getCalendarDays(year, month);
  const sectors = [...new Set(collaborators.map(c => c.sector))].sort();

  function toggleFilter(cat: CategoryKey) {
    setActiveFilters(prev => { const next = new Set(prev); if (next.has(cat)) next.delete(cat); else next.add(cat); return next; });
  }
  function prevMonth() { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); }

  function isNear(dateStr: string): boolean {
    const d = new Date(dateStr + 'T00:00:00');
    const in7Days = new Date(today); in7Days.setDate(in7Days.getDate() + 7);
    return d >= today && d <= in7Days;
  }

  // ── Drag & Drop for ALL events ──
  const handleDragStart = useCallback((ev: HREvent, e: React.DragEvent) => {
    draggedEventRef.current = ev;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', ev.id);
  }, []);

  const handleDragOver = useCallback((dateStr: string, e: React.DragEvent) => {
    e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverDate(dateStr);
  }, []);

  const handleDragLeave = useCallback(() => { setDragOverDate(null); }, []);

  const handleDrop = useCallback(async (newDateStr: string, e: React.DragEvent) => {
    e.preventDefault(); setDragOverDate(null);
    const ev = draggedEventRef.current; draggedEventRef.current = null;
    if (!ev) return;
    if (ev.date === newDateStr) return;

    const oldDate = ev.date;
    const meta = EVENT_TYPE_META[ev.type];
    const evLabel = ev.isManual ? ev.label : (meta?.label || ev.label);

    try {
      // Manual reminders: update event_date directly
      if (ev.isManual && ev.reminderId) {
        await updateReminder.mutateAsync({ id: ev.reminderId, event_date: newDateStr });
        toast({ title: 'Evento reagendado', description: `${ev.collaboratorName} — ${evLabel}: ${newDateStr.split('-').reverse().join('/')}` });
        return;
      }

      // For ALL auto events: store override in hr_event_completions
      await upsertCompletion.mutateAsync({
        event_key: ev.id,
        status: ev.completionStatus || 'pendente',
        override_date: newDateStr,
        original_date: ev.originalDate,
      });

      toast({ title: 'Evento reagendado', description: `${ev.collaboratorName} — ${evLabel}: ${oldDate.split('-').reverse().join('/')} → ${newDateStr.split('-').reverse().join('/')}` });
    } catch {
      toast({ title: 'Erro ao reagendar', variant: 'destructive' });
    }
  }, [updateReminder, upsertCompletion, toast]);

  // ── Status actions for events with native fields (aviso/vacation) ──
  async function handleSetNativeStatus(ev: HREvent, newVal: boolean) {
    if (ev.avisoId && ev.avisoField) {
      const updates: any = { id: ev.avisoId, [ev.avisoField]: newVal };
      if (ev.avisoField === 'enviado_contabilidade' && newVal) updates.data_envio_contabilidade = new Date().toISOString().slice(0, 10);
      try {
        await updateAviso.mutateAsync(updates);
        // Check if aviso is fully complete
        const aviso = avisos.find(a => a.id === ev.avisoId);
        if (aviso && newVal) {
          const updated = { ...aviso, [ev.avisoField!]: newVal };
          const now = new Date(); now.setHours(0, 0, 0, 0);
          const fim = new Date(updated.data_fim + 'T00:00:00');
          if (now >= fim && updated.pago && updated.exame && updated.assinatura) {
            await updateAviso.mutateAsync({ id: aviso.id, status_processo: 'Concluído' });
            const collab = collaborators.find(c => c.id === aviso.collaborator_id);
            if (collab && collab.status !== 'DESLIGADO') {
              await updateCollaborator.mutateAsync({ id: collab.id, collaborator_name: collab.collaborator_name, sector: collab.sector, tipo_escala: collab.tipo_escala, folgas_semanais: collab.folgas_semanais, sunday_n: collab.sunday_n, status: 'DESLIGADO', inicio_na_empresa: collab.inicio_na_empresa, data_desligamento: aviso.data_fim });
              toast({ title: `${collab.collaborator_name} desligado automaticamente` });
            }
          }
        }
        toast({ title: newVal ? 'Marcado como concluído' : 'Marcado como pendente' });
        setSelectedEvent(null);
      } catch { toast({ title: 'Erro ao atualizar', variant: 'destructive' }); }
      return;
    }
    if (ev.vacationId && ev.vacationField) {
      const vac = vacations.find(v => v.id === ev.vacationId);
      if (!vac) return;
      try {
        await updateVacation.mutateAsync({ id: vac.id, collaborator_id: vac.collaborator_id, collaborator_name: vac.collaborator_name, sector: vac.sector, data_inicio_ferias: vac.data_inicio_ferias, data_fim_ferias: vac.data_fim_ferias, [ev.vacationField]: newVal });
        toast({ title: newVal ? 'Marcado como concluído' : 'Marcado como pendente' });
        setSelectedEvent(null);
      } catch { toast({ title: 'Erro ao atualizar', variant: 'destructive' }); }
    }
  }

  // ── Generic status for events WITHOUT native fields ──
  async function handleSetGenericStatus(ev: HREvent, status: 'concluido' | 'pendente' | 'nao_executado', note?: string) {
    try {
      await upsertCompletion.mutateAsync({
        event_key: ev.id,
        status,
        original_date: ev.originalDate,
        override_date: ev.date !== ev.originalDate ? ev.date : null,
        concluded_at: status === 'concluido' ? new Date().toISOString() : null,
        concluded_by: status === 'concluido' ? '' : undefined,
        conclusion_note: note || '',
      });
      toast({ title: status === 'concluido' ? 'Marcado como concluído' : status === 'nao_executado' ? 'Marcado como não executado' : 'Marcado como pendente' });
      setSelectedEvent(null);
      setConclusionNote('');
    } catch { toast({ title: 'Erro ao atualizar status', variant: 'destructive' }); }
  }

  // Reminder status actions
  async function handleReminderStatus(reminderId: string, status: string, note?: string) {
    try {
      const updates: any = { id: reminderId, status };
      if (status === 'concluido') {
        updates.concluded_at = new Date().toISOString();
        if (note) updates.conclusion_note = note;
      }
      if (status === 'adiado' && postponeDate) {
        updates.postponed_to = postponeDate;
        updates.event_date = postponeDate;
      }
      await updateReminder.mutateAsync(updates);
      toast({ title: `Lembrete ${status === 'concluido' ? 'concluído' : status === 'cancelado' ? 'cancelado' : status === 'adiado' ? 'adiado' : 'atualizado'}` });
      setSelectedEvent(null);
      setPostponeDate('');
      setConclusionNote('');
    } catch { toast({ title: 'Erro ao atualizar lembrete', variant: 'destructive' }); }
  }

  async function handleDeleteReminder(reminderId: string) {
    try {
      await deleteReminder.mutateAsync(reminderId);
      toast({ title: 'Lembrete excluído' });
      setSelectedEvent(null);
    } catch { toast({ title: 'Erro ao excluir', variant: 'destructive' }); }
  }

  // Determine selected event's effective status
  const getEffectiveStatus = (ev: HREvent | null): 'concluido' | 'pendente' | 'nao_executado' => {
    if (!ev) return 'pendente';
    if (ev.isManual) return (ev.reminder?.status as any) || 'pendente';
    const fv = ev.avisoField != null ? ev.avisoFieldValue : ev.vacationField != null ? ev.vacationFieldValue : undefined;
    if (fv !== undefined) return fv ? 'concluido' : 'pendente';
    return (ev.completionStatus as any) || 'pendente';
  };

  const hasNativeField = selectedEvent?.avisoField != null || selectedEvent?.vacationField != null;
  const effectiveStatus = getEffectiveStatus(selectedEvent);

  // Day/Week views
  const weekDates = useMemo(() => {
    const base = selectedDay ? new Date(selectedDay + 'T00:00:00') : today;
    const dow = base.getDay();
    const start = new Date(base); start.setDate(start.getDate() - dow);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start); d.setDate(d.getDate() + i);
      return toDateStr(d);
    });
  }, [selectedDay, today]);

  function renderEventChip(ev: HREvent) {
    const statusInd = getStatusIndicator(ev);
    const meta = EVENT_TYPE_META[ev.type];
    return (
      <button
        key={ev.id}
        draggable
        onDragStart={(e) => handleDragStart(ev, e)}
        onClick={() => { setSelectedEvent(ev); setConclusionNote(''); setPostponeDate(''); }}
        className={`w-full text-left text-[9px] sm:text-[10px] leading-tight px-1 py-0.5 rounded truncate flex items-center gap-0.5 ${getEventColor(ev.type, ev.priority)} ${getEventTextColor(ev.type)} hover:opacity-80 transition-opacity cursor-grab active:cursor-grabbing`}
        title={`${ev.collaboratorName} — ${meta?.label || ev.label}`}
      >
        {statusInd && <span className={statusInd.className}>{statusInd.icon}</span>}
        {ev.priority === 'critica' && <AlertCircle className="w-2.5 h-2.5 text-white" />}
        <span className="truncate">
          <span className="font-semibold">{ev.collaboratorName}</span>
          <span className="hidden sm:inline"> · {ev.isManual ? ev.label : meta?.shortLabel}</span>
        </span>
      </button>
    );
  }

  function renderPendingSection(title: string, events: HREvent[], icon: React.ReactNode, colorClass: string) {
    if (events.length === 0) return null;
    return (
      <div className="space-y-1">
        <div className={`flex items-center gap-1.5 text-xs font-semibold ${colorClass}`}>
          {icon} {title} ({events.length})
        </div>
        <div className="space-y-0.5 ml-4">
          {events.slice(0, 5).map(ev => (
            <button key={ev.id} onClick={() => { setSelectedEvent(ev); setConclusionNote(''); setPostponeDate(''); }} className="w-full text-left text-[10px] py-0.5 px-1.5 rounded hover:bg-muted/50 truncate flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${getEventColor(ev.type, ev.priority)}`} />
              <span className="font-medium">{ev.collaboratorName}</span>
              <span className="text-muted-foreground">— {ev.isManual ? ev.label : EVENT_TYPE_META[ev.type]?.shortLabel}</span>
              <span className="text-muted-foreground ml-auto">{ev.date.split('-').reverse().join('/')}</span>
            </button>
          ))}
          {events.length > 5 && <div className="text-[9px] text-muted-foreground ml-1">+{events.length - 5} mais</div>}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold">Calendário RH</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="w-3.5 h-3.5" /> Filtros
            </Button>
            <Button size="sm" className="gap-1" onClick={() => setShowNewReminder(true)}>
              <Plus className="w-3.5 h-3.5" /> Novo Lembrete
            </Button>
          </div>
        </div>

        {/* Filters panel */}
        {showFilters && (
          <Card>
            <CardContent className="pt-4 pb-3 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px]">Colaborador</Label>
                  <Input placeholder="Buscar..." value={filterCollaborator} onChange={e => setFilterCollaborator(e.target.value)} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Setor</Label>
                  <Select value={filterSector || '__all__'} onValueChange={v => setFilterSector(v === '__all__' ? '' : v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todos</SelectItem>
                      {sectors.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Tipo</Label>
                  <Select value={filterType || '__all__'} onValueChange={v => setFilterType(v === '__all__' ? '' : v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todos</SelectItem>
                      {REMINDER_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Prioridade</Label>
                  <Select value={filterPriority || '__all__'} onValueChange={v => setFilterPriority(v === '__all__' ? '' : v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todas</SelectItem>
                      {PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Status</Label>
                  <Select value={filterStatus || '__all__'} onValueChange={v => setFilterStatus(v === '__all__' ? '' : v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todos</SelectItem>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="concluido">Concluído</SelectItem>
                      <SelectItem value="nao_executado">Não executado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Origem</Label>
                  <Select value={filterSource} onValueChange={v => setFilterSource(v as any)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="auto">Automáticos</SelectItem>
                      <SelectItem value="manual">Manuais</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Category toggles */}
              <div className="flex flex-wrap gap-3">
                {(Object.entries(EVENT_CATEGORIES) as [CategoryKey, typeof EVENT_CATEGORIES[CategoryKey]][]).map(([key, cat]) => (
                  <label key={key} className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                    <Checkbox checked={activeFilters.has(key)} onCheckedChange={() => toggleFilter(key)} className="w-3.5 h-3.5" />
                    <span className={`w-2.5 h-2.5 rounded-full ${cat.color}`} />
                    {cat.label}
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary + Views */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Main calendar area */}
          <div className="lg:col-span-3">
            <Card>
              <CardContent className="pt-4 space-y-3">
                {/* Summary cards */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <SummaryCard icon={<UserX className="w-4 h-4" />} label="Desligamentos" value={summary.desligamentos} color="text-red-500" />
                  <SummaryCard icon={<Palmtree className="w-4 h-4" />} label="Início férias" value={summary.ferias} color="text-yellow-600" />
                  <SummaryCard icon={<AlertTriangle className="w-4 h-4" />} label="Avisos prévios" value={summary.avisosAtivos} color="text-orange-500" />
                  <SummaryCard icon={<Bell className="w-4 h-4" />} label="Lembretes" value={summary.lembretes} color="text-teal-500" />
                  <SummaryCard icon={<CalendarCheck className="w-4 h-4" />} label="Total" value={summary.total} color="text-primary" />
                </div>

                {/* View tabs + navigation */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <Tabs value={viewMode} onValueChange={v => setViewMode(v as any)}>
                    <TabsList className="h-8">
                      <TabsTrigger value="month" className="text-xs px-2 h-6">Mês</TabsTrigger>
                      <TabsTrigger value="week" className="text-xs px-2 h-6">Semana</TabsTrigger>
                      <TabsTrigger value="day" className="text-xs px-2 h-6">Dia</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prevMonth}><ChevronLeft className="w-4 h-4" /></Button>
                    <span className="font-semibold text-sm min-w-[140px] text-center">{MONTH_NAMES[month]} {year}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nextMonth}><ChevronRight className="w-4 h-4" /></Button>
                  </div>
                </div>

                {/* Month view */}
                {viewMode === 'month' && (
                  <>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <GripVertical className="w-3 h-3" /> Arraste qualquer evento para reagendar
                    </p>
                    <div className="grid grid-cols-7 text-center text-[11px] font-medium text-muted-foreground">
                      {WEEKDAY_LABELS.map(d => <div key={d} className="py-1">{d}</div>)}
                    </div>
                    <div className="grid grid-cols-7 border-t border-l border-border">
                      {cells.map((day, i) => {
                        const dateStr = day ? fmtDate(year, month, day) : '';
                        const dayEvents = day ? eventsByDate.get(dateStr) || [] : [];
                        const isToday = dateStr === todayStr;
                        const hasNearEvent = dayEvents.some(e => isNear(e.date));
                        const isDropTarget = dragOverDate === dateStr;
                        const hasOverdue = dayEvents.some(e => {
                          if (e.date >= todayStr) return false;
                          if (e.isManual) return e.reminder?.status === 'pendente';
                          const fv = e.avisoField != null ? e.avisoFieldValue : e.vacationField != null ? e.vacationFieldValue : undefined;
                          if (fv !== undefined) return fv === false;
                          return (e.completionStatus || 'pendente') === 'pendente';
                        });

                        return (
                          <div
                            key={i}
                            className={`border-r border-b border-border min-h-[60px] sm:min-h-[80px] p-0.5 transition-colors cursor-pointer ${day ? 'hover:bg-muted/30' : 'bg-muted/30'} ${isToday ? 'bg-primary/5' : ''} ${hasNearEvent ? 'ring-2 ring-inset ring-orange-400/60' : ''} ${isDropTarget ? 'bg-primary/15 ring-2 ring-inset ring-primary/50' : ''} ${hasOverdue ? 'bg-red-50 dark:bg-red-950/20' : ''}`}
                            onClick={() => { if (day) { setSelectedDay(dateStr); setViewMode('day'); } }}
                            onDragOver={day ? (e) => handleDragOver(dateStr, e) : undefined}
                            onDragLeave={day ? handleDragLeave : undefined}
                            onDrop={day ? (e) => handleDrop(dateStr, e) : undefined}
                          >
                            {day && (
                              <>
                                <div className={`text-[11px] px-1 ${isToday ? 'font-bold text-primary' : 'text-muted-foreground'}`}>{day}</div>
                                <div className="space-y-0.5 mt-0.5">
                                  {dayEvents.slice(0, 3).map(renderEventChip)}
                                  {dayEvents.length > 3 && <div className="text-[9px] text-muted-foreground px-1">+{dayEvents.length - 3} mais</div>}
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* Week view */}
                {viewMode === 'week' && (
                  <div className="grid grid-cols-7 gap-1">
                    {weekDates.map(dateStr => {
                      const dayEvents = filteredEvents.filter(e => e.date === dateStr);
                      const d = new Date(dateStr + 'T00:00:00');
                      const isToday = dateStr === todayStr;
                      return (
                        <div key={dateStr} className={`border border-border rounded p-1.5 min-h-[120px] ${isToday ? 'bg-primary/5 border-primary/30' : ''}`}>
                          <div className={`text-[10px] font-semibold ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                            {WEEKDAY_LABELS[d.getDay()]} {d.getDate()}/{d.getMonth() + 1}
                          </div>
                          <div className="space-y-0.5 mt-1">
                            {dayEvents.slice(0, 6).map(renderEventChip)}
                            {dayEvents.length > 6 && <div className="text-[9px] text-muted-foreground">+{dayEvents.length - 6}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Day view */}
                {viewMode === 'day' && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => {
                        const d = new Date((selectedDay || todayStr) + 'T00:00:00');
                        d.setDate(d.getDate() - 1);
                        setSelectedDay(toDateStr(d));
                      }}>
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="font-semibold text-sm">
                        {selectedDay ? (() => { const d = new Date(selectedDay + 'T00:00:00'); return `${WEEKDAY_LABELS[d.getDay()]}, ${d.getDate()} de ${MONTH_NAMES[d.getMonth()]} de ${d.getFullYear()}`; })() : 'Hoje'}
                      </span>
                      <Button variant="ghost" size="sm" onClick={() => {
                        const d = new Date((selectedDay || todayStr) + 'T00:00:00');
                        d.setDate(d.getDate() + 1);
                        setSelectedDay(toDateStr(d));
                      }}>
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm" className="text-xs ml-2" onClick={() => { setSelectedDay(todayStr); }}>Hoje</Button>
                    </div>
                    <div className="space-y-1">
                      {(() => {
                        const dayStr = selectedDay || todayStr;
                        const dayEvents = filteredEvents.filter(e => e.date === dayStr);
                        if (dayEvents.length === 0) return <p className="text-sm text-muted-foreground py-8 text-center">Nenhum evento neste dia</p>;
                        return dayEvents.map(ev => {
                          const meta = EVENT_TYPE_META[ev.type];
                          const statusInd = getStatusIndicator(ev);
                          return (
                            <button key={ev.id} onClick={() => { setSelectedEvent(ev); setConclusionNote(''); setPostponeDate(''); }} className="w-full text-left border border-border rounded-lg p-3 hover:bg-muted/30 transition-colors flex items-center gap-3">
                              <div className={`w-3 h-8 rounded-full ${getEventColor(ev.type, ev.priority)}`} />
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-sm">{ev.collaboratorName}</div>
                                <div className="text-xs text-muted-foreground">{ev.isManual ? ev.label : meta?.label}</div>
                                {ev.isManual && ev.reminder?.event_time && <div className="text-xs text-muted-foreground">⏰ {ev.reminder.event_time.slice(0, 5)}</div>}
                              </div>
                              {statusInd && <span className={statusInd.className}>{statusInd.icon}</span>}
                              {ev.priority === 'critica' && <Badge variant="destructive" className="text-[9px] h-4">Crítica</Badge>}
                              {ev.priority === 'alta' && <Badge className="bg-orange-100 text-orange-700 border-0 text-[9px] h-4">Alta</Badge>}
                            </button>
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar: Pending list */}
          <div className="lg:col-span-1 space-y-3">
            <Card>
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="flex items-center gap-1.5 text-sm">
                  <List className="w-4 h-4 text-primary" /> Pendências
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pb-3">
                {renderPendingSection('Atrasados', pendingEvents.overdue, <AlertCircle className="w-3.5 h-3.5" />, 'text-red-600')}
                {renderPendingSection('Vence hoje', pendingEvents.dueToday, <Clock className="w-3.5 h-3.5" />, 'text-orange-600')}
                {renderPendingSection('Próximos 3 dias', pendingEvents.due3, <CalendarCheck className="w-3.5 h-3.5" />, 'text-amber-600')}
                {renderPendingSection('Próximos 7 dias', pendingEvents.due7, <CalendarDays className="w-3.5 h-3.5" />, 'text-blue-600')}
                {pendingEvents.overdue.length === 0 && pendingEvents.dueToday.length === 0 && pendingEvents.due3.length === 0 && pendingEvents.due7.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhuma pendência próxima 🎉</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* New Reminder Dialog */}
      <NewReminderDialog open={showNewReminder} onOpenChange={setShowNewReminder} collaborators={collaborators} />

      {/* Event detail dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              {selectedEvent && EVENT_TYPE_META[selectedEvent.type]?.emoji}
              {selectedEvent?.collaboratorName} — {selectedEvent?.isManual ? selectedEvent?.label : (selectedEvent && EVENT_TYPE_META[selectedEvent.type]?.label)}
            </DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4 text-sm">
              {/* Info grid */}
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground text-xs">Colaborador</span><p className="font-medium">{selectedEvent.collaboratorName}</p></div>
                <div><span className="text-muted-foreground text-xs">Setor</span><p className="font-medium">{selectedEvent.sector || '—'}</p></div>
                <div><span className="text-muted-foreground text-xs">Tipo</span><p className="font-medium">{selectedEvent.isManual ? REMINDER_TYPES.find(t => t.value === selectedEvent.reminder?.reminder_type)?.label || 'Lembrete' : EVENT_TYPE_META[selectedEvent.type]?.label}</p></div>
                <div><span className="text-muted-foreground text-xs">Data</span><p className="font-medium">{selectedEvent.date.split('-').reverse().join('/')}</p></div>
                <div><span className="text-muted-foreground text-xs">Origem</span><p className="font-medium">{getEventOrigin(selectedEvent)}</p></div>
                {selectedEvent.isManual && selectedEvent.reminder?.responsible && (
                  <div><span className="text-muted-foreground text-xs">Responsável</span><p className="font-medium">{selectedEvent.reminder.responsible}</p></div>
                )}
                {selectedEvent.priority && (
                  <div><span className="text-muted-foreground text-xs">Prioridade</span><p className="font-medium flex items-center gap-1"><span className={`w-2 h-2 rounded-full ${PRIORITIES.find(p => p.value === selectedEvent.priority)?.color || ''}`} />{PRIORITIES.find(p => p.value === selectedEvent.priority)?.label}</p></div>
                )}
              </div>

              {selectedEvent.observacao && (
                <div><span className="text-muted-foreground text-xs">Observações</span><p className="mt-1 text-xs">{selectedEvent.observacao}</p></div>
              )}

              {selectedEvent.date !== selectedEvent.originalDate && (
                <p className="text-[10px] text-muted-foreground">📅 Data original: {selectedEvent.originalDate.split('-').reverse().join('/')} — reagendado para {selectedEvent.date.split('-').reverse().join('/')}</p>
              )}

              {/* ══════ STATUS CONTROLS ══════ */}

              {/* A) Events with native field (aviso prévio / férias sub-tasks) */}
              {hasNativeField && (
                <div className="border border-border rounded-lg p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs">Status da etapa</span>
                    <StatusBadge status={effectiveStatus} />
                  </div>
                  <p className="text-xs text-muted-foreground">{FIELD_LABELS[selectedEvent.avisoField || selectedEvent.vacationField || '']}</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant={effectiveStatus === 'concluido' ? 'default' : 'outline'} className="flex-1 gap-1" onClick={() => handleSetNativeStatus(selectedEvent, true)} disabled={updateAviso.isPending || updateVacation.isPending}>
                      <Check className="w-3.5 h-3.5" /> Concluído
                    </Button>
                    <Button size="sm" variant={effectiveStatus === 'pendente' ? 'secondary' : 'outline'} className="flex-1 gap-1" onClick={() => handleSetNativeStatus(selectedEvent, false)} disabled={updateAviso.isPending || updateVacation.isPending}>
                      <Clock className="w-3.5 h-3.5" /> Pendente
                    </Button>
                  </div>
                </div>
              )}

              {/* B) Manual reminders */}
              {selectedEvent.isManual && selectedEvent.reminder && (
                <div className="border border-border rounded-lg p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs">Status</span>
                    <StatusBadge status={effectiveStatus} />
                  </div>

                  {selectedEvent.reminder.recurrence !== 'none' && (
                    <p className="text-[10px] text-muted-foreground">🔁 Recorrência: {selectedEvent.reminder.recurrence === 'monthly' ? 'Mensal' : selectedEvent.reminder.recurrence === 'weekly' ? 'Semanal' : 'Anual'}</p>
                  )}

                  {selectedEvent.reminder.status !== 'concluido' && (
                    <>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Observação de conclusão (opcional)</Label>
                        <Textarea value={conclusionNote} onChange={e => setConclusionNote(e.target.value)} rows={2} className="text-xs" placeholder="O que foi feito..." />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="flex-1 gap-1" onClick={() => handleReminderStatus(selectedEvent.reminder!.id, 'concluido', conclusionNote)}>
                          <Check className="w-3.5 h-3.5" /> Concluir
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => handleReminderStatus(selectedEvent.reminder!.id, 'cancelado')}>
                          <X className="w-3.5 h-3.5" /> Cancelar
                        </Button>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[10px]">Adiar para</Label>
                        <div className="flex gap-2">
                          <Input type="date" value={postponeDate} onChange={e => setPostponeDate(e.target.value)} className="h-8 text-xs flex-1" />
                          <Button size="sm" variant="secondary" disabled={!postponeDate} onClick={() => handleReminderStatus(selectedEvent.reminder!.id, 'adiado')}>
                            Adiar
                          </Button>
                        </div>
                      </div>
                    </>
                  )}

                  {selectedEvent.reminder.concluded_at && (
                    <p className="text-[10px] text-muted-foreground">Concluído em: {new Date(selectedEvent.reminder.concluded_at).toLocaleString('pt-BR')}</p>
                  )}
                  {selectedEvent.reminder.conclusion_note && (
                    <p className="text-[10px]">📝 {selectedEvent.reminder.conclusion_note}</p>
                  )}

                  <div className="pt-2 border-t border-border">
                    <Button size="sm" variant="ghost" className="text-destructive gap-1 text-xs" onClick={() => handleDeleteReminder(selectedEvent.reminder!.id)}>
                      <Trash2 className="w-3 h-3" /> Excluir lembrete
                    </Button>
                  </div>
                </div>
              )}

              {/* C) Generic auto events WITHOUT native field (desligamento, experiencia, ferias_inicio/fim/retorno, compensacao, etc.) */}
              {!hasNativeField && !selectedEvent.isManual && (
                <div className="border border-border rounded-lg p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs">Status do evento</span>
                    <StatusBadge status={effectiveStatus} />
                  </div>

                  {effectiveStatus !== 'concluido' && (
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <Label className="text-[10px]">Observação (opcional)</Label>
                        <Textarea value={conclusionNote} onChange={e => setConclusionNote(e.target.value)} rows={2} className="text-xs" placeholder="O que foi feito..." />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="flex-1 gap-1" onClick={() => handleSetGenericStatus(selectedEvent, 'concluido', conclusionNote)} disabled={upsertCompletion.isPending}>
                          <Check className="w-3.5 h-3.5" /> Concluir
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => handleSetGenericStatus(selectedEvent, 'nao_executado')} disabled={upsertCompletion.isPending}>
                          <Ban className="w-3.5 h-3.5" /> Não executado
                        </Button>
                      </div>
                    </div>
                  )}

                  {effectiveStatus === 'concluido' && (
                    <Button size="sm" variant="outline" className="w-full gap-1" onClick={() => handleSetGenericStatus(selectedEvent, 'pendente')} disabled={upsertCompletion.isPending}>
                      <Clock className="w-3.5 h-3.5" /> Voltar para pendente
                    </Button>
                  )}

                  {effectiveStatus === 'nao_executado' && (
                    <Button size="sm" variant="outline" className="w-full gap-1" onClick={() => handleSetGenericStatus(selectedEvent, 'pendente')} disabled={upsertCompletion.isPending}>
                      <Clock className="w-3.5 h-3.5" /> Voltar para pendente
                    </Button>
                  )}

                  {/* Reschedule */}
                  <div className="space-y-1">
                    <Label className="text-[10px]">Reagendar para</Label>
                    <div className="flex gap-2">
                      <Input type="date" value={postponeDate} onChange={e => setPostponeDate(e.target.value)} className="h-8 text-xs flex-1" />
                      <Button size="sm" variant="secondary" disabled={!postponeDate || upsertCompletion.isPending} onClick={async () => {
                        try {
                          await upsertCompletion.mutateAsync({
                            event_key: selectedEvent.id,
                            status: effectiveStatus,
                            override_date: postponeDate,
                            original_date: selectedEvent.originalDate,
                          });
                          toast({ title: 'Evento reagendado', description: `${selectedEvent.collaboratorName} → ${postponeDate.split('-').reverse().join('/')}` });
                          setSelectedEvent(null);
                          setPostponeDate('');
                        } catch { toast({ title: 'Erro ao reagendar', variant: 'destructive' }); }
                      }}>
                        Reagendar
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <GripVertical className="w-3 h-3" /> Você pode arrastar este evento no calendário para reagendar
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ───── Sub-components ───── */

function StatusBadge({ status }: { status: string }) {
  if (status === 'concluido') return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 gap-1 text-[10px]"><Check className="w-3 h-3" /> Concluído</Badge>;
  if (status === 'nao_executado') return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0 gap-1 text-[10px]"><Ban className="w-3 h-3" /> Não executado</Badge>;
  if (status === 'cancelado') return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0 gap-1 text-[10px]"><X className="w-3 h-3" /> Cancelado</Badge>;
  if (status === 'adiado') return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0 gap-1 text-[10px]"><Clock className="w-3 h-3" /> Adiado</Badge>;
  return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0 gap-1 text-[10px]"><Clock className="w-3 h-3" /> Pendente</Badge>;
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
