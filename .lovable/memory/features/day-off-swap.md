Day-off swap and move logic for Escala page.

## How it works
- `generateSchedule()` in scheduleEngine.ts now accepts `DayOffOverridesMap`
- Overrides are built from TROCA_FOLGA and MUDANCA_FOLGA schedule events via `buildSwapOverrides()`
- `getDisplayName()` checks overrides before fixed day-off rules (folgas_semanais, sunday_n)
- Override addDays → collaborator is OFF; removeDays → collaborator WORKS despite fixed day off

## Event types
- TROCA_FOLGA: swap between two people. original_day = A's day off, swapped_day = B's day off
- MUDANCA_FOLGA: move own day off. original_day = current day off, swapped_day = new day off

## Data model
- Uses schedule_events table with event_type, original_day, swapped_day, week_start, related_collaborator_id
- event_date = week_start for these event types

## Key files
- src/lib/scheduleEngine.ts — DayOffOverride type, getDisplayName with overrides
- src/hooks/useScheduleEvents.ts — buildSwapOverrides(), MUDANCA_FOLGA type
- src/components/schedule/CollaboratorActionMenu.tsx — two-mode dialog (troca/mover)
- src/pages/Escala.tsx — dateRange computed from year/month (not weeks), overrides passed to generateSchedule
