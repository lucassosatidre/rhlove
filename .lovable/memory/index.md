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
- `collaborators` table: id, sector, collaborator_name, weekly_day_off, sunday_n, tipo_escala, folgas_semanais, status, inicio_na_empresa, data_desligamento, inicio_periodo, fim_periodo
- `daily_sales` table: date, faturamento_total, pedidos_totais, faturamento_salao, pedidos_salao, faturamento_tele, pedidos_tele
- `freelancers` table: date, sector, quantity
- `scheduled_vacations` table: collaborator_id, collaborator_name, sector, data_inicio_ferias, data_fim_ferias, status, observacao
- `holidays` table: date (unique), name
- `holiday_compensations` table: collaborator_id, holiday_date (unique pair), holiday_name, eligible, status (NAO/SIM/COMPENSADO), compensation_date, observacao
- RLS: open policies (internal app, no auth)

## Key files
- src/lib/scheduleEngine.ts — schedule generation + isCollaboratorScheduledOnDate
- src/lib/productivityEngine.ts — productivity calculations
- src/hooks/useCollaborators.ts — CRUD hooks
- src/hooks/useScheduledVacations.ts — vacation CRUD + isOnScheduledVacation
- src/hooks/useHolidayCompensations.ts — holidays + compensations CRUD
- src/pages/Escala.tsx — schedule views
- src/pages/Colaboradores.tsx — collaborator CRUD + Excel import/export
- src/pages/Produtividade.tsx — productivity indicators PCS, TCS, PCT, TCT
- src/pages/FeriasProgramadas.tsx — scheduled vacations calendar
- src/pages/Compensacoes.tsx — holiday compensation tracking

## Productivity indicators
- PCS = Pedidos por Colaborador - Setor
- TCS = Ticket por Colaborador - Setor
- PCT = Pedidos por Colaborador - Time
- TCT = Ticket por Colaborador - Time
