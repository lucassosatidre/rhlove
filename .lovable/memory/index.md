# Memory: index.md
Updated: now

Estrela RH - internal HR scheduling app for Pizzaria Estrela da Ilha

## Stack
- React + TypeScript + Tailwind + shadcn/ui
- Lovable Cloud (Supabase) for database
- xlsx for Excel import/export

## Design
- Theme: warm orange primary (hsl 12 80% 50%), dark sidebar
- Font: Inter
- Brand: "Estrela RH" with Pizza icon

## Database
- `collaborators` table: id, sector, collaborator_name, weekly_day_off, sunday_n, tipo_escala, folgas_semanais, status, inicio_na_empresa, data_desligamento, inicio_periodo, fim_periodo, data_retorno, data_fim_experiencia, data_fim_aviso
- `daily_sales` table: date, faturamento_total, pedidos_totais, faturamento_salao, pedidos_salao, faturamento_tele, pedidos_tele
- `freelancers` table: date, sector, quantity
- `scheduled_vacations` table: collaborator_id, collaborator_name, sector, data_inicio_ferias, data_fim_ferias, status, observacao
- RLS: open policies (internal app, no auth)

## Key files
- src/lib/scheduleEngine.ts — schedule generation logic (accepts scheduledVacations)
- src/lib/productivityEngine.ts — productivity calculations (accepts scheduledVacations)
- src/hooks/useCollaborators.ts — CRUD hooks
- src/hooks/useScheduledVacations.ts — vacation CRUD + isOnScheduledVacation helper
- src/pages/Escala.tsx — schedule views (week, 4-week, 2x2 grid)
- src/pages/Colaboradores.tsx — collaborator CRUD + Excel import/export
- src/pages/Produtividade.tsx — productivity indicators PCS, TCS, PCT, TCT
- src/pages/FeriasProgramadas.tsx — scheduled vacations calendar

## Schedule rules
- Weeks run Monday-Sunday
- 4 weeks generated from first Monday of month grid
- folgas_semanais excludes collaborator on those days
- sunday_n (1-5) determines which Sunday of month they're off
- Scheduled vacations exclude collaborator during vacation period

## Productivity indicators
- PCS = Pedidos por Colaborador - Setor (was PPP)
- TCS = Ticket por Colaborador - Setor (was TMP)
- PCT = Pedidos por Colaborador - Time
- TCT = Ticket por Colaborador - Time (was TMT)
