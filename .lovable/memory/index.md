# Memory: index.md
Updated: now

Estrela RH - internal HR scheduling app for Pizzaria Estrela da Ilha

## Stack
- React + TypeScript + Tailwind + shadcn/ui
- Lovable Cloud (Supabase) for database
- xlsx for Excel import/export
- recharts for charts

## Design
- Theme: warm orange primary (hsl 12 80% 50%), dark sidebar
- Font: Inter
- Brand: "Estrela RH" with Pizza icon

## Database
- `collaborators` table: id, sector, collaborator_name, weekly_day_off, sunday_n, tipo_escala, folgas_semanais, status, data_retorno, data_fim_experiencia, data_fim_aviso, created_at, updated_at
- `daily_sales` table: id, date (unique), faturamento_total, pedidos_totais, faturamento_salao, pedidos_salao, faturamento_tele, pedidos_tele, created_at, updated_at
- RLS: open policies (internal app, no auth)

## Key files
- src/lib/scheduleEngine.ts — schedule generation logic
- src/lib/productivityEngine.ts — productivity calculations (TMP, PPP, TMT)
- src/hooks/useCollaborators.ts — collaborator CRUD hooks
- src/hooks/useDailySales.ts — daily sales CRUD hooks
- src/pages/Escala.tsx — schedule views (week, 4-week, 2x2 grid)
- src/pages/Colaboradores.tsx — collaborator CRUD + Excel import
- src/pages/Produtividade.tsx — productivity dashboard (table + 3 charts + import/export/print)

## Schedule rules
- Weeks run Monday-Sunday
- 4 weeks generated from first Monday of month grid
- folgas_semanais excludes collaborator on those days
- sunday_n (1-5) determines which Sunday of month they're off
- Status FERIAS/AFASTADO: excluded until data_retorno
- Status AVISO_PREVIO: excluded after data_fim_aviso

## Productivity rules
- COZINHA/DIURNO use faturamento_total and pedidos_totais
- SALÃO uses faturamento_salao and pedidos_salao
- TELE-ENTREGA uses faturamento_tele and pedidos_tele
- TMP = vendas / numero_pessoas
- PPP = pedidos / numero_pessoas
- TIME = sum of all sector people
- TMT = faturamento_total / TIME
