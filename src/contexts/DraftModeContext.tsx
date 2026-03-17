import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { ScheduleEvent, ScheduleEventInput } from '@/hooks/useScheduleEvents';

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

interface DraftModeContextValue {
  isDraft: boolean;
  setIsDraft: (v: boolean) => void;
  draftEvents: ScheduleEvent[];
  addDraftEvent: (input: ScheduleEventInput) => ScheduleEvent;
  draftFreelancerEntries: DraftFreelancerEntry[];
  addDraftFreelancer: (entry: { date: string; sector: string; name: string }) => void;
  removeDraftFreelancer: (id: string) => void;
  clearDraft: () => void;
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

let draftCounter = 0;

export function DraftModeProvider({ children }: { children: ReactNode }) {
  const [isDraft, setIsDraft] = useState(false);
  const [draftEvents, setDraftEvents] = useState<ScheduleEvent[]>([]);
  const [draftFreelancerEntries, setDraftFreelancerEntries] = useState<DraftFreelancerEntry[]>([]);

  const addDraftEvent = useCallback((input: ScheduleEventInput): ScheduleEvent => {
    const now = new Date().toISOString();
    const event: ScheduleEvent = {
      id: `draft-${++draftCounter}`,
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
  }, []);

  const addDraftFreelancer = useCallback((entry: { date: string; sector: string; name: string }) => {
    const now = new Date().toISOString();
    const fe: DraftFreelancerEntry = {
      id: `draft-free-${++draftCounter}`,
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
  }, []);

  const removeDraftFreelancer = useCallback((id: string) => {
    setDraftFreelancerEntries(prev => prev.filter(f => f.id !== id));
  }, []);

  const clearDraft = useCallback(() => {
    setDraftEvents([]);
    setDraftFreelancerEntries([]);
  }, []);

  const handleSetIsDraft = useCallback((v: boolean) => {
    if (!v) {
      // Clear draft data when turning off
      setDraftEvents([]);
      setDraftFreelancerEntries([]);
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
      clearDraft,
    }}>
      {children}
    </DraftModeContext.Provider>
  );
}
