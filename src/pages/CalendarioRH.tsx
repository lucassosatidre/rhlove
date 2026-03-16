import { useCollaborators } from '@/hooks/useCollaborators';
import { useScheduledVacations } from '@/hooks/useScheduledVacations';
import { useAvisosPrevios } from '@/hooks/useAvisosPrevios';
import { useHolidayCompensations } from '@/hooks/useHolidayCompensations';
import { Loader2 } from 'lucide-react';
import HRCalendar from '@/components/dashboard/HRCalendar';

export default function CalendarioRH() {
  const { data: collaborators = [], isLoading: l1 } = useCollaborators();
  const { data: vacations = [], isLoading: l2 } = useScheduledVacations();
  const { data: avisos = [], isLoading: l3 } = useAvisosPrevios();
  const { data: compensations = [], isLoading: l4 } = useHolidayCompensations();

  if (l1 || l2 || l3 || l4) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-[1400px] mx-auto animate-fade-in">
      <HRCalendar
        collaborators={collaborators}
        vacations={vacations}
        avisos={avisos}
        compensations={compensations}
      />
    </div>
  );
}
