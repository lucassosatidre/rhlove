# Memory: index.md
Updated: now

RH Love - HR management platform by Propósito Soluções. Current client: Pizzaria Estrela da Ilha.

## Identity hierarchy
- Product: RH Love
- Developer: Propósito Soluções
- Client: Pizzaria Estrela da Ilha (hardcoded for now, multi-tenant ready structure)
- Icon: src/assets/rh-love-icon.png (heart+people, orange gradient)

## Stack
- React + TypeScript + Tailwind + shadcn/ui
- Lovable Cloud (Supabase) for database
- xlsx for Excel import/export

## Design
- Theme: warm orange primary (hsl 12 80% 50%), dark sidebar
- Font: Inter
- Brand: "RH Love" with heart+people icon

## Database
- `collaborators` table: id, sector, collaborator_name, weekly_day_off, sunday_n, created_at, updated_at
- RLS: open policies (internal app, no auth)

## Key files
- src/lib/scheduleEngine.ts — schedule generation logic
- src/hooks/useCollaborators.ts — CRUD hooks
- src/pages/Escala.tsx — schedule views (week, 4-week, 2x2 grid)
- src/pages/Colaboradores.tsx — collaborator CRUD + Excel import

## Schedule rules
- Weeks run Monday-Sunday
- 4 weeks generated from first Monday of month grid
- weekly_day_off excludes collaborator on that day
- sunday_n (1-5) determines which Sunday of month they're off
