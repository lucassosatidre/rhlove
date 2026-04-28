## Objetivo

Recuperar os dados de faturamento dos dias **11, 18 e 19/04/2026** que estão quebrados (zerados ou subdimensionados) e adicionar uma proteção contra novas falhas silenciosas do sync do Saipos.

## Diagnóstico

| Data | Faturamento atual | Pedidos | Diagnóstico |
|------|-------------------|---------|-------------|
| 11/04 (sáb) | R$ 8.957,44 | 75 | Sincronizado em 12/04 às **08:00** — provavelmente antes do Saipos consolidar o turno (que vai até 03:00). Sábado normal faz R$ 25k+ |
| 18/04 (sáb) | R$ 0,00 | 0 | Cron diário falhou. Backfill manual em 20/04 pegou 0 vendas da API |
| 19/04 (dom) | R$ 0,00 | 0 | Mesma causa do 18/04 |

Os 3 dias têm o mesmo padrão: o sync rodou cedo demais ou falhou, gravou valores incompletos/zerados com `status: success`, e ninguém percebeu.

## Etapas

### 1. Re-rodar backfill dos 3 dias

Chamar a edge function `sync-saipos-sales` via curl com:
```json
{ "mode": "backfill", "start_date": "2026-04-11", "end_date": "2026-04-11" }
```
e depois:
```json
{ "mode": "backfill", "start_date": "2026-04-18", "end_date": "2026-04-19" }
```

O upsert (`onConflict: "date"`) sobrescreve os valores atuais. Como hoje (28/04) já passou tempo suficiente, o Saipos deve ter os dados consolidados.

### 2. Verificar resultado e reportar

Rodar SELECT em `daily_sales` pros 3 dias e comparar com os valores antigos. Se algum continuar zerado/baixo, é sinal que o problema está no PDV (turno não fechado no Saipos) e a Luana precisa abrir manualmente no Saipos.

### 3. Adicionar proteção: detectar "0 vendas suspeito"

Editar `supabase/functions/sync-saipos-sales/index.ts` na parte que insere em `saipos_sync_log`:

```typescript
const isSuspiciousZero = t.total_sales === 0;
const finalStatus = upsertErr 
  ? 'error' 
  : (isSuspiciousZero ? 'warning' : 'success');

await supabase.from("saipos_sync_log").insert({
  // ...
  status: finalStatus,
  error_message: upsertErr?.message 
    || (isSuspiciousZero ? 'Zero vendas retornadas pela API — verificar manualmente' : null),
});
```

Pizzaria abre todos os dias, então 0 vendas = sempre suspeito.

### 4. Mudar horário do cron diário

O sync `yesterday` está rodando às 08:00, mas o turno do Saipos vai até 03:00 da madrugada. Risco de pegar dados parciais se o sync rodar antes da última venda da madrugada ser registrada. Mover pra rodar mais tarde (ex: às 12:00) dá margem de segurança.

Investigar via `cron.job` qual é o agendamento atual e ajustar pra rodar ao meio-dia em vez de 8h.

## Fora de escopo

- Não mexer na lógica de cálculo de faturamento (taxa de serviço já está em outro plano)
- Não criar UI nova de alerta — `status: warning` no log basta pra detectar via query
- Não mexer no botão de sync do Dashboard

## Entregáveis

1. Valores corretos de 11, 18 e 19/04 em `daily_sales` (ou diagnóstico claro se a API ainda devolver zero/parcial)
2. Edge function com detecção de "0 vendas suspeito" → `status: warning`
3. Cron movido pra horário seguro (após consolidação do turno)
