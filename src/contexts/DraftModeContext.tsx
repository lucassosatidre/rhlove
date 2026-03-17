import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { ScheduleEvent, ScheduleEventInput } from '@/hooks/useScheduleEvents';
import type { DailySalesInput } from '@/hooks/useDailySales';

interface DraftFreelancerEntry {
  id: string;
  name: string;
  date: string;
  sector: string;
  status: 'ATIVO';
  origin: string;
  observation: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
}

export interface DraftSalesEntry {
  date: string;
  faturamento_total: number;
  pedidos_totais: number;
  faturamento_salao: number;
  pedidos_salao: number;
  faturamento_tele: number;
  pedidos_tele: number;
}

interface DraftModeContextValue {
  isDraft: boolean;
  setIsDraft: (v: boolean) => void;
  draftEvents: ScheduleEvent[];
  addDraftEvent: (input: ScheduleEventInput) => ScheduleEvent;
  draftFreelancerEntries: DraftFreelancerEntry[];
  addDraftFreelancer: (entry: { date: string; sector: string; name: string }) => void;
  removeDraftFreelancer: (id: string) => void;
  draftSales: Record<string, DraftSalesEntry>;
  upsertDraftSales: (entry: DraftSalesEntry) => void;
  clearDraft: () => void;
}

const STORAGE_KEY = 'estrela-rh-draft';

interface DraftStorageData {
  events: ScheduleEvent[];
  freelancers: DraftFreelancerEntry[];
  sales: Record<string, DraftSalesEntry>;
  counter: number;
}

function loadFromStorage(): DraftStorageData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { events: [], freelancers: [], sales: {}, counter: 0 };
}

function saveToStorage(data: DraftStorageData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

function clearStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

const DraftModeContext = createContext<DraftModeContextValue | null>(null);

export function useDraftMode() {
  const ctx = useContext(DraftModeContext);
  if (!ctx) throw new Error('useDraftMode must be used within DraftModeProvider');
  return ctx;
}

export function useDraftModeOptional() {
  return useContext(DraftModeContext);
}

export function DraftModeProvider({ children }: { children: ReactNode }) {
  const initial = loadFromStorage();
  const [isDraft, setIsDraft] = useState(initial.events.length > 0 || initial.freelancers.length > 0 || Object.keys(initial.sales).length > 0);
  const [draftEvents, setDraftEvents] = useState<ScheduleEvent[]>(initial.events);
  const [draftFreelancerEntries, setDraftFreelancerEntries] = useState<DraftFreelancerEntry[]>(initial.freelancers);
  const [draftSales, setDraftSales] = useState<Record<string, DraftSalesEntry>>(initial.sales);
  const [counter, setCounter] = useState(initial.counter);

  // Persist to localStorage on changes
  useEffect(() => {
    saveToStorage({ events: draftEvents, freelancers: draftFreelancerEntries, sales: draftSales, counter });
  }, [draftEvents, draftFreelancerEntries, draftSales, counter]);

  const addDraftEvent = useCallback((input: ScheduleEventInput): ScheduleEvent => {
    const now = new Date().toISOString();
    const newCounter = counter + 1;
    setCounter(newCounter);
    const event: ScheduleEvent = {
      id: `draft-${newCounter}`,
      collaborator_id: input.collaborator_id,
      collaborator_name: input.collaborator_name,
      event_type: input.event_type,
      event_date: input.event_date,
      event_date_end: input.event_date_end ?? null,
      observation: input.observation ?? '',
      related_collaborator_id: input.related_collaborator_id ?? null,
      related_collaborator_name: input.related_collaborator_name ?? null,
      original_day: input.original_day ?? null,
      swapped_day: input.swapped_day ?? null,
      week_start: input.week_start ?? null,
      holiday_compensation_id: input.holiday_compensation_id ?? null,
      created_by: input.created_by ?? null,
      created_at: now,
      updated_at: now,
      status: 'ATIVO',
      reverted_at: null,
      reverted_by: null,
      reverted_reason: null,
    };
    setDraftEvents(prev => [...prev, event]);
    return event;
  }, [counter]);

  const addDraftFreelancer = useCallback((entry: { date: string; sector: string; name: string }) => {
    const now = new Date().toISOString();
    const newCounter = counter + 1;
    setCounter(newCounter);
    const fe: DraftFreelancerEntry = {
      id: `draft-free-${newCounter}`,
      name: entry.name,
      date: entry.date,
      sector: entry.sector,
      status: 'ATIVO',
      origin: 'ESCALA',
      observation: null,
      created_at: now,
      updated_at: now,
      created_by: null,
      cancelled_at: null,
      cancelled_by: null,
    };
    setDraftFreelancerEntries(prev => [...prev, fe]);
  }, [counter]);

  const removeDraftFreelancer = useCallback((id: string) => {
    setDraftFreelancerEntries(prev => prev.filter(f => f.id !== id));
  }, []);

  const upsertDraftSales = useCallback((entry: DraftSalesEntry) => {
    setDraftSales(prev => ({ ...prev, [entry.date]: entry }));
  }, []);

  const clearDraft = useCallback(() => {
    setDraftEvents([]);
    setDraftFreelancerEntries([]);
    setDraftSales({});
    setCounter(0);
    clearStorage();
  }, []);

  const handleSetIsDraft = useCallback((v: boolean) => {
    if (!v) {
      setDraftEvents([]);
      setDraftFreelancerEntries([]);
      setDraftSales({});
      setCounter(0);
      clearStorage();
    }
    setIsDraft(v);
  }, []);

  return (
    <DraftModeContext.Provider value={{
      isDraft,
      setIsDraft: handleSetIsDraft,
      draftEvents,
      addDraftEvent,
      draftFreelancerEntries,
      addDraftFreelancer,
      removeDraftFreelancer,
      draftSales,
      upsertDraftSales,
      clearDraft,
    }}>
      {children}
    </DraftModeContext.Provider>
  );
}
