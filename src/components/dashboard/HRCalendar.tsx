import { useState, useMemo, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ChevronLeft, ChevronRight, CalendarDays, UserX, Palmtree, AlertTriangle, Briefcase, Check, X, Clock, GripVertical } from 'lucide-react';
import { useUpdateAvisoPrevio } from '@/hooks/useAvisosPrevios';
import { useUpdateScheduledVacation } from '@/hooks/useScheduledVacations';
import { useUpdateCollaborator, useCollaborators } from '@/hooks/useCollaborators';
import { useToast } from '@/hooks/use-toast';
import type { Collaborator } from '@/types/collaborator';
import type { ScheduledVacation } from '@/hooks/useScheduledVacations';
import type { AvisoPrevio } from '@/hooks/useAvisosPrevios';
import type { HolidayCompensation } from '@/hooks/useHolidayCompensations';

export interface HREvent {
  id: string;
  date: string;
  type: 'desligamento' | 'aviso_inicio' | 'aviso_fim' | 'ferias_inicio' | 'ferias_fim' | 'ferias_pagamento' | 'experiencia_inicio' | 'experiencia_fim' | 'exame' | 'contabilidade' | 'compensacao' | 'rescisao_pagamento' | 'rescisao_assinatura' | 'ferias_aviso' | 'ferias_contabilidade' | 'ferias_pagamento_exec' | 'ferias_recibo' | 'ferias_retorno';
  label: string;
  collaboratorName: string;
  sector: string;
  observacao?: string;
  avisoId?: string;
  avisoField?: 'enviado_contabilidade' | 'exame' | 'pago' | 'assinatura';
  avisoFieldValue?: boolean;
  /** Which date field on aviso_previo this event maps to, for drag-drop rescheduling */
  avisoDateField?: string;
  /** Vacation task tracking */
  vacationId?: string;
  vacationField?: 'aviso_ferias_assinado' | 'contabilidade_solicitada' | 'pagamento_efetuado' | 'recibo_assinado';
  vacationFieldValue?: boolean;
}

const EVENT_CATEGORIES = {
  ferias: { label: 'Férias', types: ['ferias_inicio', 'ferias_fim', 'ferias_pagamento', 'ferias_aviso', 'ferias_contabilidade', 'ferias_pagamento_exec', 'ferias_recibo', 'ferias_retorno'] as string[], color: 'bg-yellow-400', textColor: 'text-yellow-900' },
  aviso: { label: 'Aviso Prévio', types: ['aviso_inicio', 'aviso_fim', 'rescisao_pagamento', 'rescisao_assinatura'] as string[], color: 'bg-orange-400', textColor: 'text-orange-900' },
  desligamento: { label: 'Desligamentos', types: ['desligamento'] as string[], color: 'bg-red-500', textColor: 'text-white' },
  experiencia: { label: 'Experiência', types: ['experiencia_inicio', 'experiencia_fim'] as string[], color: 'bg-blue-400', textColor: 'text-blue-900' },
  compensacao: { label: 'Compensações', types: ['compensacao'] as string[], color: 'bg-green-400', textColor: 'text-green-900' },
  admin: { label: 'Administrativo', types: ['exame', 'contabilidade'] as string[], color: 'bg-purple-400', textColor: 'text-purple-900' },
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
};

type TaskStatus = 'PENDENTE' | 'CONCLUÍDO' | 'NÃO EXECUTADO';

function getTaskStatus(fieldValue: boolean | undefined): TaskStatus {
  if (fieldValue === true) return 'CONCLUÍDO';
  return 'PENDENTE';
}

function getEventColor(type: string): string {
  const meta = EVENT_TYPE_META[type];
  if (!meta) return 'bg-muted';
  return EVENT_CATEGORIES[meta.category].color;
}

function getStatusIndicator(ev: HREvent): { icon: React.ReactNode; className: string } | null {
  const fieldVal = ev.avisoField != null ? ev.avisoFieldValue : ev.vacationField != null ? ev.vacationFieldValue : undefined;
  if (fieldVal === undefined) return null;
  if (fieldVal === true) {
    return { icon: <Check className="w-2.5 h-2.5" />, className: 'text-emerald-600' };
  }
  return { icon: <Clock className="w-2.5 h-2.5" />, className: 'text-amber-500' };
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function buildEvents(
  collaborators: Collaborator[],
  vacations: ScheduledVacation[],
  avisos: AvisoPrevio[],
  compensations: HolidayCompensation[],
): HREvent[] {
  const events: HREvent[] = [];

  for (const c of collaborators) {
    if (c.data_desligamento) {
      events.push({ id: `desl-${c.id}`, date: c.data_desligamento, type: 'desligamento', label: 'Desligamento', collaboratorName: c.collaborator_name, sector: c.sector });
    }
    if (c.status === 'EXPERIENCIA') {
      if (c.inicio_periodo) {
        events.push({ id: `exp-i-${c.id}`, date: c.inicio_periodo, type: 'experiencia_inicio', label: 'Início experiência', collaboratorName: c.collaborator_name, sector: c.sector });
      }
      if (c.fim_periodo) {
        events.push({ id: `exp-f-${c.id}`, date: c.fim_periodo, type: 'experiencia_fim', label: 'Fim experiência', collaboratorName: c.collaborator_name, sector: c.sector });
      }
    }
  }

  for (const v of vacations) {
    if (v.status === 'CANCELADA') continue;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const inicioDate = new Date(v.data_inicio_ferias + 'T00:00:00');
    const fimDate = new Date(v.data_fim_ferias + 'T00:00:00');
    const isPast = today > fimDate;

    events.push({ id: `fer-i-${v.id}`, date: v.data_inicio_ferias, type: 'ferias_inicio', label: 'Início férias', collaboratorName: v.collaborator_name, sector: v.sector });
    events.push({ id: `fer-f-${v.id}`, date: v.data_fim_ferias, type: 'ferias_fim', label: 'Fim férias', collaboratorName: v.collaborator_name, sector: v.sector, observacao: v.observacao });

    // Event 1: Assinar aviso de férias (D-30)
    const avisoFerDate = new Date(inicioDate);
    avisoFerDate.setDate(avisoFerDate.getDate() - 30);
    events.push({
      id: `fer-aviso-${v.id}`, date: toDateStr(avisoFerDate), type: 'ferias_aviso',
      label: `Assinar aviso de férias — ${v.collaborator_name}`, collaboratorName: v.collaborator_name, sector: v.sector,
      observacao: `O aviso de férias deve ser assinado 30 dias antes do início (${v.data_inicio_ferias.split('-').reverse().join('/')})`,
      vacationId: v.id, vacationField: 'aviso_ferias_assinado', vacationFieldValue: v.aviso_ferias_assinado,
    });

    // Event 2: Solicitar docs à contabilidade (D-33)
    const contabFerDate = new Date(avisoFerDate);
    contabFerDate.setDate(contabFerDate.getDate() - 3);
    events.push({
      id: `fer-contab-${v.id}`, date: toDateStr(contabFerDate), type: 'ferias_contabilidade',
      label: `Solicitar aviso e recibo à contabilidade — ${v.collaborator_name}`, collaboratorName: v.collaborator_name, sector: v.sector,
      observacao: `Solicitar à contabilidade 3 dias antes da assinatura do aviso (${toDateStr(avisoFerDate).split('-').reverse().join('/')})`,
      vacationId: v.id, vacationField: 'contabilidade_solicitada', vacationFieldValue: v.contabilidade_solicitada,
    });

    // Event 3: Efetuar pagamento (D-2)
    const pagFerDate = new Date(inicioDate);
    pagFerDate.setDate(pagFerDate.getDate() - 2);
    events.push({
      id: `fer-pgto-${v.id}`, date: toDateStr(pagFerDate), type: 'ferias_pagamento_exec',
      label: `Efetuar pagamento das férias — ${v.collaborator_name}`, collaboratorName: v.collaborator_name, sector: v.sector,
      observacao: `Pagamento deve ser efetuado 2 dias antes do início das férias (${v.data_inicio_ferias.split('-').reverse().join('/')})`,
      vacationId: v.id, vacationField: 'pagamento_efetuado', vacationFieldValue: v.pagamento_efetuado,
    });

    // Event 4: Assinar recibo de pagamento (D-2, mesmo dia do pagamento)
    events.push({
      id: `fer-recibo-${v.id}`, date: toDateStr(pagFerDate), type: 'ferias_recibo',
      label: `Assinar recibo de pagamento — ${v.collaborator_name}`, collaboratorName: v.collaborator_name, sector: v.sector,
      observacao: `Assinar recibo de pagamento no mesmo dia do pagamento das férias`,
      vacationId: v.id, vacationField: 'recibo_assinado', vacationFieldValue: v.recibo_assinado,
    });

    // Event 5: Retorno de férias (data_fim + 1)
    const retornoDate = new Date(fimDate);
    retornoDate.setDate(retornoDate.getDate() + 1);
    events.push({
      id: `fer-retorno-${v.id}`, date: toDateStr(retornoDate), type: 'ferias_retorno',
      label: `Retorno de férias — ${v.collaborator_name}`, collaboratorName: v.collaborator_name, sector: v.sector,
      observacao: `Retorno previsto do colaborador após as férias`,
    });
  }

  for (const a of avisos) {
    events.push({ id: `av-i-${a.id}`, date: a.data_inicio, type: 'aviso_inicio', label: 'Início aviso prévio', collaboratorName: a.collaborator_name, sector: a.sector, observacao: a.observacoes || undefined, avisoId: a.id, avisoDateField: 'data_inicio' });
    events.push({ id: `av-f-${a.id}`, date: a.data_fim, type: 'aviso_fim', label: 'Fim aviso prévio', collaboratorName: a.collaborator_name, sector: a.sector, avisoId: a.id, avisoDateField: 'data_fim' });

    const fimDate = new Date(a.data_fim + 'T00:00:00');

    // Contabilidade: D+1 after last working day
    const contabDate = new Date(fimDate);
    contabDate.setDate(contabDate.getDate() + 1);
    const contabStr = toDateStr(contabDate);
    events.push({
      id: `cont-auto-${a.id}`, date: contabStr, type: 'contabilidade',
      label: `Info contabilidade — ${a.collaborator_name}`, collaboratorName: a.collaborator_name, sector: a.sector,
      observacao: `Enviar informações para contabilidade (D+1 do último dia trabalhado: ${a.data_fim.split('-').reverse().join('/')})`,
      avisoId: a.id, avisoField: 'enviado_contabilidade', avisoFieldValue: a.enviado_contabilidade,
    });

    // Exame demissional: 7 days BEFORE last working day (D-7)
    const exameDate = new Date(fimDate);
    exameDate.setDate(exameDate.getDate() - 7);
    const exameStr = toDateStr(exameDate);
    events.push({
      id: `ex-auto-${a.id}`, date: exameStr, type: 'exame',
      label: `Exame demissional — ${a.collaborator_name}`, collaboratorName: a.collaborator_name, sector: a.sector,
      observacao: `Exame demissional (7 dias antes do último dia trabalhado: ${a.data_fim.split('-').reverse().join('/')})`,
      avisoId: a.id, avisoField: 'exame', avisoFieldValue: a.exame,
    });

    // Pagamento: D+7
    const pagDate = new Date(fimDate);
    pagDate.setDate(pagDate.getDate() + 7);
    const pagStr = toDateStr(pagDate);
    events.push({
      id: `pag-auto-${a.id}`, date: pagStr, type: 'rescisao_pagamento',
      label: `Pagamento verbas rescisórias — ${a.collaborator_name}`, collaboratorName: a.collaborator_name, sector: a.sector,
      observacao: `Prazo para pagamento das verbas rescisórias (D+7 do último dia trabalhado: ${a.data_fim.split('-').reverse().join('/')})`,
      avisoId: a.id, avisoField: 'pago', avisoFieldValue: a.pago,
    });

    // Assinatura: D+8
    const assDate = new Date(fimDate);
    assDate.setDate(assDate.getDate() + 8);
    const assStr = toDateStr(assDate);
    events.push({
      id: `ass-auto-${a.id}`, date: assStr, type: 'rescisao_assinatura',
      label: `Assinatura rescisão — ${a.collaborator_name}`, collaboratorName: a.collaborator_name, sector: a.sector,
      observacao: `Assinatura dos documentos da rescisão com colaborador (D+8 do último dia trabalhado: ${a.data_fim.split('-').reverse().join('/')})`,
      avisoId: a.id, avisoField: 'assinatura', avisoFieldValue: a.assinatura,
    });
  }

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

// Draggable aviso event types
const DRAGGABLE_TYPES = new Set(['exame', 'contabilidade', 'rescisao_pagamento', 'rescisao_assinatura', 'aviso_inicio', 'aviso_fim']);

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
  const [obs, setObs] = useState('');
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const draggedEventRef = useRef<HREvent | null>(null);

  const updateAviso = useUpdateAvisoPrevio();
  const updateVacation = useUpdateScheduledVacation();
  const updateCollaborator = useUpdateCollaborator();
  const { toast } = useToast();

  const allEvents = useMemo(() => buildEvents(collaborators, vacations, avisos, compensations), [collaborators, vacations, avisos, compensations]);

  const filteredEvents = useMemo(() => {
    const activeTypes = new Set<string>();
    for (const cat of activeFilters) {
      for (const t of EVENT_CATEGORIES[cat].types) activeTypes.add(t);
    }
    return allEvents.filter(e => activeTypes.has(e.type));
  }, [allEvents, activeFilters]);

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

  const summary = useMemo(() => {
    const desligamentos = monthEvents.filter(e => e.type === 'desligamento').length;
    const ferias = monthEvents.filter(e => e.type === 'ferias_inicio').length;
    const avisosAtivos = monthEvents.filter(e => e.type === 'aviso_inicio' || e.type === 'aviso_fim').length;
    const eventosRH = monthEvents.filter(e => e.type === 'exame' || e.type === 'contabilidade' || e.type === 'compensacao').length;
    return { desligamentos, ferias, avisosAtivos, eventosRH };
  }, [monthEvents]);

  const cells = getCalendarDays(year, month);
  const todayStr = fmtDate(today.getFullYear(), today.getMonth(), today.getDate());

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

  // ── Drag & Drop ──
  const handleDragStart = useCallback((ev: HREvent, e: React.DragEvent) => {
    if (!ev.avisoId || !DRAGGABLE_TYPES.has(ev.type)) {
      e.preventDefault();
      return;
    }
    draggedEventRef.current = ev;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', ev.id);
  }, []);

  const handleDragOver = useCallback((dateStr: string, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverDate(dateStr);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverDate(null);
  }, []);

  const handleDrop = useCallback(async (newDateStr: string, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverDate(null);
    const ev = draggedEventRef.current;
    draggedEventRef.current = null;

    if (!ev || !ev.avisoId) return;
    if (ev.date === newDateStr) return;

    const aviso = avisos.find(a => a.id === ev.avisoId);
    if (!aviso) return;

    // Validation: don't allow moving before aviso start date for non-start events
    if (ev.type !== 'aviso_inicio') {
      const inicio = new Date(aviso.data_inicio + 'T00:00:00');
      const newDate = new Date(newDateStr + 'T00:00:00');
      if (newDate < inicio) {
        toast({ title: 'Não é possível mover para antes do início do aviso prévio', variant: 'destructive' });
        return;
      }
    }

    // Map event type to the update field
    const updateData: any = { id: ev.avisoId };
    let fieldLabel = '';

    switch (ev.type) {
      case 'aviso_inicio':
        updateData.data_inicio = newDateStr;
        fieldLabel = 'Início do aviso';
        break;
      case 'aviso_fim':
        updateData.data_fim = newDateStr;
        fieldLabel = 'Fim do aviso';
        break;
      case 'exame':
        // Exame is computed from data_fim - 7, so moving exame means adjusting data_fim
        // New data_fim = exame date + 7
        {
          const newExameDate = new Date(newDateStr + 'T00:00:00');
          const newFim = new Date(newExameDate);
          newFim.setDate(newFim.getDate() + 7);
          updateData.data_fim = toDateStr(newFim);
          fieldLabel = 'Exame demissional (data_fim recalculada)';
        }
        break;
      case 'contabilidade':
        // Contabilidade is D+1, so new data_fim = contab date - 1
        {
          const newContabDate = new Date(newDateStr + 'T00:00:00');
          const newFim = new Date(newContabDate);
          newFim.setDate(newFim.getDate() - 1);
          updateData.data_fim = toDateStr(newFim);
          fieldLabel = 'Contabilidade (data_fim recalculada)';
        }
        break;
      case 'rescisao_pagamento':
        // Pagamento is D+7, so new data_fim = pag date - 7
        {
          const newPagDate = new Date(newDateStr + 'T00:00:00');
          const newFim = new Date(newPagDate);
          newFim.setDate(newFim.getDate() - 7);
          updateData.data_fim = toDateStr(newFim);
          fieldLabel = 'Pagamento rescisório (data_fim recalculada)';
        }
        break;
      case 'rescisao_assinatura':
        // Assinatura is D+8, so new data_fim = ass date - 8
        {
          const newAssDate = new Date(newDateStr + 'T00:00:00');
          const newFim = new Date(newAssDate);
          newFim.setDate(newFim.getDate() - 8);
          updateData.data_fim = toDateStr(newFim);
          fieldLabel = 'Assinatura rescisão (data_fim recalculada)';
        }
        break;
      default:
        return;
    }

    try {
      await updateAviso.mutateAsync(updateData);
      toast({
        title: 'Evento reagendado com sucesso',
        description: `${ev.collaboratorName} — ${fieldLabel}: ${newDateStr.split('-').reverse().join('/')}`,
      });
    } catch {
      toast({ title: 'Erro ao reagendar evento', variant: 'destructive' });
    }
  }, [avisos, updateAviso, toast]);

  // ── Status actions ──
  async function handleSetStatus(ev: HREvent, status: TaskStatus) {
    if (!ev.avisoId || !ev.avisoField) return;
    const newVal = status === 'CONCLUÍDO';
    const updates: any = { id: ev.avisoId, [ev.avisoField]: newVal };

    if (ev.avisoField === 'enviado_contabilidade' && newVal) {
      updates.data_envio_contabilidade = new Date().toISOString().slice(0, 10);
    }

    try {
      await updateAviso.mutateAsync(updates);

      // Check auto-discharge
      const aviso = avisos.find(a => a.id === ev.avisoId);
      if (aviso) {
        const updated = { ...aviso, [ev.avisoField!]: newVal };
        const now = new Date(); now.setHours(0, 0, 0, 0);
        const fim = new Date(updated.data_fim + 'T00:00:00');
        if (now >= fim && updated.pago && updated.exame && updated.assinatura) {
          await updateAviso.mutateAsync({ id: aviso.id, status_processo: 'Concluído' });
          const collab = collaborators.find(c => c.id === aviso.collaborator_id);
          if (collab && collab.status !== 'DESLIGADO') {
            await updateCollaborator.mutateAsync({
              id: collab.id,
              collaborator_name: collab.collaborator_name,
              sector: collab.sector,
              tipo_escala: collab.tipo_escala,
              folgas_semanais: collab.folgas_semanais,
              sunday_n: collab.sunday_n,
              status: 'DESLIGADO',
              inicio_na_empresa: collab.inicio_na_empresa,
              data_desligamento: aviso.data_fim,
            });
            toast({ title: `${collab.collaborator_name} desligado automaticamente` });
          }
        }
      }

      toast({ title: status === 'CONCLUÍDO' ? 'Marcado como concluído' : 'Marcado como pendente' });
      setSelectedEvent(null);
    } catch {
      toast({ title: 'Erro ao atualizar', variant: 'destructive' });
    }
  }

  const currentStatus: TaskStatus | null = selectedEvent?.avisoField != null
    ? getTaskStatus(selectedEvent.avisoFieldValue) : null;

  const isDraggable = (ev: HREvent) => !!ev.avisoId && DRAGGABLE_TYPES.has(ev.type);

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

          {/* Drag hint */}
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <GripVertical className="w-3 h-3" /> Arraste eventos de aviso prévio para reagendar
          </p>

          {/* Calendar grid */}
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

              return (
                <div
                  key={i}
                  className={`border-r border-b border-border min-h-[60px] sm:min-h-[80px] p-0.5 transition-colors ${
                    day ? '' : 'bg-muted/30'
                  } ${isToday ? 'bg-primary/5' : ''} ${hasNearEvent ? 'ring-2 ring-inset ring-orange-400/60' : ''} ${
                    isDropTarget ? 'bg-primary/15 ring-2 ring-inset ring-primary/50' : ''
                  }`}
                  onDragOver={day ? (e) => handleDragOver(dateStr, e) : undefined}
                  onDragLeave={day ? handleDragLeave : undefined}
                  onDrop={day ? (e) => handleDrop(dateStr, e) : undefined}
                >
                  {day && (
                    <>
                      <div className={`text-[11px] px-1 ${isToday ? 'font-bold text-primary' : 'text-muted-foreground'}`}>
                        {day}
                      </div>
                      <div className="space-y-0.5 mt-0.5">
                        {dayEvents.slice(0, 3).map(ev => {
                          const statusInd = getStatusIndicator(ev);
                          const meta = EVENT_TYPE_META[ev.type];
                          const canDrag = isDraggable(ev);
                          return (
                            <button
                              key={ev.id}
                              draggable={canDrag}
                              onDragStart={canDrag ? (e) => handleDragStart(ev, e) : undefined}
                              onClick={() => { setSelectedEvent(ev); setObs(''); }}
                              className={`w-full text-left text-[9px] sm:text-[10px] leading-tight px-1 py-0.5 rounded truncate flex items-center gap-0.5 ${getEventColor(ev.type)} ${meta?.category ? EVENT_CATEGORIES[meta.category].textColor : ''} hover:opacity-80 transition-opacity ${canDrag ? 'cursor-grab active:cursor-grabbing' : ''}`}
                              title={`${ev.collaboratorName} — ${meta?.label || ev.label}${ev.avisoField ? ` [${getTaskStatus(ev.avisoFieldValue)}]` : ''}`}
                            >
                              {statusInd && <span className={statusInd.className}>{statusInd.icon}</span>}
                              <span className="truncate">
                                <span className="font-semibold">{ev.collaboratorName}</span>
                                <span className="hidden sm:inline"> · {meta?.shortLabel}</span>
                              </span>
                            </button>
                          );
                        })}
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
              {selectedEvent?.collaboratorName} — {selectedEvent && EVENT_TYPE_META[selectedEvent.type]?.label}
            </DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4 text-sm">
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
                  <span className="text-muted-foreground">Data prevista</span>
                  <p className="font-medium">{selectedEvent.date.split('-').reverse().join('/')}</p>
                </div>
              </div>

              {selectedEvent.observacao && (
                <div>
                  <span className="text-muted-foreground">Observações do evento</span>
                  <p className="mt-1 text-xs">{selectedEvent.observacao}</p>
                </div>
              )}

              {/* Actionable section for aviso prévio tasks */}
              {selectedEvent.avisoField && (
                <div className="border border-border rounded-lg p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs">Status da etapa</span>
                    <StatusBadge status={currentStatus!} />
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {FIELD_LABELS[selectedEvent.avisoField]}
                  </p>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={currentStatus === 'CONCLUÍDO' ? 'default' : 'outline'}
                      className="flex-1 gap-1"
                      onClick={() => handleSetStatus(selectedEvent, 'CONCLUÍDO')}
                      disabled={updateAviso.isPending}
                    >
                      <Check className="w-3.5 h-3.5" />
                      Concluído
                    </Button>
                    <Button
                      size="sm"
                      variant={currentStatus === 'PENDENTE' ? 'secondary' : 'outline'}
                      className="flex-1 gap-1"
                      onClick={() => handleSetStatus(selectedEvent, 'PENDENTE')}
                      disabled={updateAviso.isPending}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      Pendente
                    </Button>
                  </div>
                </div>
              )}

              {/* Drag hint for draggable events */}
              {isDraggable(selectedEvent) && (
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <GripVertical className="w-3 h-3" /> Arraste este evento no calendário para reagendar
                </p>
              )}

              {!selectedEvent.avisoField && (
                <Badge variant="outline" className={`${getEventColor(selectedEvent.type)} ${EVENT_TYPE_META[selectedEvent.type]?.category ? EVENT_CATEGORIES[EVENT_TYPE_META[selectedEvent.type].category].textColor : ''} border-0`}>
                  {EVENT_TYPE_META[selectedEvent.type]?.label}
                </Badge>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function StatusBadge({ status }: { status: TaskStatus }) {
  if (status === 'CONCLUÍDO') {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 gap-1">
        <Check className="w-3 h-3" /> Concluído
      </Badge>
    );
  }
  if (status === 'NÃO EXECUTADO') {
    return (
      <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0 gap-1">
        <X className="w-3 h-3" /> Não executado
      </Badge>
    );
  }
  return (
    <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0 gap-1">
      <Clock className="w-3 h-3" /> Pendente
    </Badge>
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
