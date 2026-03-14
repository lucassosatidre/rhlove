Estrela RH - internal HR scheduling app for Pizzaria Estrela da Ilha

## Stack
- React + TypeScript + Tailwind + shadcn/ui
- Lovable Cloud (Supabase) for database
- xlsx for Excel import/export

## Design
- Theme: warm orange primary (hsl 24 90% 50%), dark sidebar
- Font: DM Sans (replaced Inter)
- Brand: "Estrela RH" with custom star logo (src/assets/logo.png)
- Sector colors: Cozinha=black, Salão=red, Tele=green, Diurno=blue (CSS tokens --sector-*)
- Logo also used as favicon (public/favicon.png)

## Database
- `collaborators` table: id, sector, collaborator_name, weekly_day_off, sunday_n, folgas_semanais, tipo_escala, status, inicio_na_empresa, data_desligamento, inicio_periodo, fim_periodo, data_retorno (legacy), data_fim_experiencia (legacy), data_fim_aviso (legacy), created_at, updated_at
- `daily_sales` table: id, date, faturamento_total/salao/tele, pedidos_totais/salao/tele
- `freelancers` table: id, date, sector, quantity (unique on date+sector)
- RLS: open policies (internal app, no auth)

## Key files
- src/lib/scheduleEngine.ts — schedule generation logic
- src/lib/productivityEngine.ts — productivity calculations (includes freelancers)
- src/hooks/useCollaborators.ts — CRUD hooks
- src/hooks/useFreelancers.ts — freelancers CRUD
- src/hooks/useDailySales.ts — sales CRUD
- src/pages/Escala.tsx — schedule views (week, 4-week, 2x2 grid)
- src/pages/Colaboradores.tsx — collaborator CRUD + Excel import/export
- src/pages/Produtividade.tsx — productivity analysis + charts
- src/components/FreesDialog.tsx — freelancer management dialog

## Schedule rules
- Weeks run Monday-Sunday
- 4 weeks generated from first Monday of month grid
- folgas_semanais excludes collaborator on those days
- sunday_n (1-5) determines which Sunday of month they're off
- inicio_na_empresa: collaborator only appears if date >= inicio_na_empresa
- data_desligamento: DESLIGADO collaborator only appears if date <= data_desligamento
- inicio_periodo/fim_periodo: used for FERIAS, AFASTADO, EXPERIENCIA, AVISO_PREVIO date ranges

## Collaborator statuses
- ATIVO, FERIAS, AFASTADO, EXPERIENCIA, AVISO_PREVIO, DESLIGADO

## Sector order (GLOBAL)
1. COZINHA  2. SALÃO  3. TELE - ENTREGA  4. DIURNO

## Productivity indicators (renamed 2026-03-14)
- PCS = Pedidos por Colaborador - Setor (was PPP)
- TCS = Ticket por Colaborador - Setor (was TMP)
- PCT = Pedidos por Colaborador - Time (NEW)
- TCT = Ticket por Colaborador - Time (was TMT)
- ProductivityRow fields: pcs (was ppp), tcs (was tmp)
- Table order per date: COZINHA, SALÃO, TELE, DIURNO, TIME, TCT, PCT
