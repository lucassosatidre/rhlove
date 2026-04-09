

# Integração Automática Saipos → daily_sales

## Resumo
Criar uma Edge Function que busca dados de vendas da API do Saipos e alimenta automaticamente a tabela `daily_sales`. Configurar execução diária via cron e rodar backfill inicial de 23/03 a 09/04/2026.

## Etapas

### 1. Criar tabela `saipos_sync_log` (migração)
Nova tabela para registrar cada sincronização:
- `id` uuid PK
- `sync_date` date — dia sincronizado
- `mode` text — "yesterday" ou "backfill"
- `total_sales` integer
- `faturamento_total` numeric
- `pedidos_totais` integer
- `status` text — "success" / "error"
- `error_message` text nullable
- `created_at` timestamptz default now()

RLS: admin pode inserir/atualizar/deletar, authenticated pode visualizar.

Adicionar constraint UNIQUE na coluna `date` da tabela `daily_sales` (necessário para upsert confiável via SQL).

### 2. Criar Edge Function `sync-saipos-sales`
Arquivo: `supabase/functions/sync-saipos-sales/index.ts`

Lógica principal:
- Recebe body JSON com `mode` ("yesterday" ou "backfill") e opcionais `start_date`/`end_date`
- **yesterday**: calcula data de ontem (BRT = UTC-3)
- **backfill**: divide range em blocos de 14 dias
- Para cada bloco, chama `GET https://data.saipos.io/v1/search_sales` com os query params especificados, usando `SAIPOS_API_TOKEN` como Bearer token
- Pagina com `p_offset` se retornar exatamente 1000 registros
- Filtra `canceled = "N"`, agrupa por `shift_date`:
  - `id_sale_type = 3` → salão
  - `id_sale_type IN (1, 2, 4)` → tele
  - Usa `total_amount` como valor
- Faz upsert na `daily_sales` via supabaseAdmin (service_role)
- Insere log por dia na `saipos_sync_log`
- Retorna resumo JSON com dias processados

### 3. Configurar pg_cron
Habilitar extensões `pg_cron` e `pg_net` (migração).

Agendar job diário às 08:00 UTC (05:00 BRT) que chama a Edge Function com `{"mode": "yesterday"}` usando `net.http_post`.

### 4. Executar backfill inicial
Após deploy, chamar a function com:
```json
{"mode": "backfill", "start_date": "2026-03-23", "end_date": "2026-04-09"}
```

## Detalhes Técnicos

**Edge Function — fluxo de dados:**
```text
Saipos API → fetch com paginação → agrupa por shift_date
  → para cada dia:
      filtra canceled="N"
      soma por id_sale_type (3=salão, 1/2/4=tele)
      → upsert daily_sales
      → insert saipos_sync_log
```

**Autenticação da API Saipos:** Header `Authorization: Bearer ${SAIPOS_API_TOKEN}` (secret já configurado).

**Supabase Admin Client:** Criado com `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` para operações de banco sem RLS.

**CORS:** Headers padrão incluídos para permitir chamadas do frontend (botão manual de sync futuro).

**Arquivos modificados/criados:**
- `supabase/functions/sync-saipos-sales/index.ts` (novo)
- 1 migração: tabela `saipos_sync_log` + unique constraint em `daily_sales.date` + pg_cron/pg_net
- 1 insert SQL: job do cron

