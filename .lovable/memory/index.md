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
- `collaborators` table: id, collaborator_name, sector, tipo_escala, folgas_semanais (text[]), sunday_n, status, data_retorno, data_fim_experiencia, data_fim_aviso, weekly_day_off (legacy), created_at, updated_at
- RLS: open policies (internal app, no auth)
- Sectors: COZINHA, SALÃO, DIURNO, TELE - ENTREGA
- Status: ATIVO, FERIAS, AFASTADO, EXPERIENCIA, AVISO_PREVIO
- Tipo escala: 6x1, 5x2, 4x3
- Days are uppercase: SEGUNDA, TERCA, QUARTA, QUINTA, SEXTA, SABADO, DOMINGO

## Key files
- src/lib/scheduleEngine.ts — schedule generation with status/folga/alert logic
- src/hooks/useCollaborators.ts — CRUD hooks with DB mapping
- src/pages/Escala.tsx — schedule views (week, 4-week, 2x2 grid)
- src/pages/Colaboradores.tsx — collaborator CRUD + Excel import
- src/types/collaborator.ts — types and constants

## Schedule rules
- Weeks run Monday-Sunday, 4 weeks generated
- Monday header: "Segunda: DD/MM", other days just short name
- FERIAS/AFASTADO: excluded until data_retorno
- AVISO_PREVIO: excluded after data_fim_aviso
- EXPERIENCIA: 7-day alert "(EXPERIÊNCIA VENCENDO)"
- AVISO_PREVIO: 7-day alert "(AVISO TERMINANDO)"
- folgas_semanais: multi-day weekly off
- sunday_n: which Sunday of month is off (all tipos)
