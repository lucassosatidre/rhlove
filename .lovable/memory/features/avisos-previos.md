Avisos Prévios feature - tracks employee termination notices with checklist, auto-discharge logic, and dashboard integration.

## Database
- `avisos_previos` table: collaborator_id (FK), collaborator_name, sector, opcao, data_inicio, data_fim, data_pagamento, pago, exame, assinatura, enviado_contabilidade, data_envio_contabilidade, observacoes, status_processo
- RLS: open policies (internal app)

## Key files
- src/hooks/useAvisosPrevios.ts — CRUD hooks + checklist/alert helpers
- src/pages/AvisosPrevios.tsx — full page with table, expandable checklist, summary cards, filters, alerts
- Route: /avisos-previos (admin, gestor)

## Logic
- Auto-discharge: when pago+exame+assinatura all true AND date past data_fim → collaborator status → DESLIGADO
- Checklist: 9 items derived from fields, pendências count shown
- Alerts integrated into Dashboard via computeAvisosAlerts()
