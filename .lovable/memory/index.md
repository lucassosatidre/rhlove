# Memory: index.md
Updated: now

Estrela RH - internal HR scheduling app for Pizzaria Estrela da Ilha

## Stack
- React + TypeScript + Tailwind + shadcn/ui
- Lovable Cloud (Supabase) for database
- xlsx for Excel import/export

## Design
- Theme: warm orange primary (hsl 12 80% 50%), dark sidebar
- Font: DM Sans
- Brand: "Estrela RH" with Pizza icon

## Auth
- Supabase Auth with custom `usuarios` table for profiles/roles
- Profiles: admin, gestor, lider, visualizador
- Status: ativo, inativo (inativo blocks login)
- Admin user: admin@estrelarh.com / 123456
- Edge function `create-user` for admin to create users (uses service role)
- Trigger `on_auth_user_created` auto-creates usuarios row
- `is_admin()` security definer function for RLS
- Auto-confirm email enabled, signup disabled (admin creates users)

## Role access
- admin: all pages + user management
- gestor: escala, colaboradores, produtividade, férias, compensações, avisos prévios
- lider: escala, produtividade
- visualizador: escala only (view)

## Database
- `collaborators` table: id, sector, collaborator_name, weekly_day_off, sunday_n, tipo_escala, folgas_semanais, status, inicio_na_empresa, data_desligamento, inicio_periodo, fim_periodo
- `daily_sales` table: date, faturamento_total, pedidos_totais, faturamento_salao, pedidos_salao, faturamento_tele, pedidos_tele
- `freelancers` table: date, sector, quantity
- `scheduled_vacations` table: collaborator_id, collaborator_name, sector, data_inicio_ferias, data_fim_ferias, status, observacao
- `holidays` table: date (unique), name
- `holiday_compensations` table: collaborator_id, holiday_date (unique pair), holiday_name, eligible, status, compensation_date, observacao
- `usuarios` table: id (FK auth.users), nome, email, perfil, status, created_at
- RLS: open policies for data tables (internal app); usuarios has admin-only write RLS

## Key files
- src/contexts/AuthContext.tsx — auth provider, useAuth hook
- src/pages/Login.tsx — login page
- src/pages/GerenciarUsuarios.tsx — admin user management
- supabase/functions/create-user/ — edge function for admin user creation
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
