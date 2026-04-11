

# Plano: Verificar e corrigir taxa de serviço no sync Saipos

## Problema atual
1. A Edge Function `sync-saipos-sales` está **quebrada** — variáveis `supabaseUrl`, `serviceKey`, `body` e `mode` são declaradas duas vezes (linhas 158-162 e 183-188), causando `BOOT_ERROR`
2. Não sabemos se `total_amount` inclui a taxa de serviço para vendas tipo 3

## Etapas

### 1. Corrigir a Edge Function (bug de variáveis duplicadas)
Remover as declarações duplicadas nas linhas 183-188. Mover a lógica do `save-token` para depois da criação do client, ou reorganizar o fluxo para evitar duplicação.

### 2. Adicionar modo "sample" à Edge Function
Novo modo que busca 5 vendas tipo 3 (Salão) da API e retorna o JSON **completo** (sem filtrar campos), para inspecionar todos os campos disponíveis — incluindo `total_service_charge_amount`, `table_order`, etc.

### 3. Deploy + chamar modo "sample"
Fazer deploy da function corrigida e chamar com `{"mode": "sample"}` para obter um exemplo real de venda tipo 3.

### 4. Ajustar cálculo se necessário
Se confirmarmos que `total_amount` não inclui a taxa de serviço:
- Na Edge Function: somar `total_service_charge_amount` (ou campo equivalente) ao `total_amount` para vendas tipo 3
- No `SaiposSyncButton.tsx` (frontend): aplicar a mesma lógica na função `aggregateByDay`
- Re-sincronizar os dados existentes com backfill

## Arquivos modificados
- `supabase/functions/sync-saipos-sales/index.ts` — corrigir duplicatas + modo sample + lógica taxa de serviço
- `src/components/productivity/SaiposSyncButton.tsx` — mesma correção na aggregação do frontend

## Detalhe técnico
```text
Antes:  amount = sale.total_amount
Depois: amount = sale.total_amount + (sale.id_sale_type === 3 ? (sale.table_order?.total_service_charge_amount || 0) : 0)
```
O campo exato será confirmado após inspecionar a resposta da API no passo 3.

