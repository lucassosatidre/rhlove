# Histórico de folgas semanais — Infraestrutura (Prompt 1/4)

Objetivo: criar a base de dados, tipos e hooks para suportar histórico de folgas com "vigente a partir de", **sem alterar nenhum comportamento atual**. O `scheduleEngine` continua lendo `collaborators.folgas_semanais` e `collaborators.sunday_n` como hoje. As próximas etapas (engine, UI de diálogo, timeline) virão em prompts separados.

## Escopo

1. Migration SQL: tabela, índice, função e RLS
2. Backfill dos 35 colaboradores existentes
3. Tipos TypeScript
4. Hook utilitário (esqueleto, não consumido em UI)

## 1. Migration

### 1.1 Tabela `collaborator_folgas_history`

```sql
CREATE TABLE public.collaborator_folgas_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collaborator_id uuid NOT NULL REFERENCES public.collaborators(id) ON DELETE CASCADE,
  folgas_semanais text[] NOT NULL,
  sunday_n integer NOT NULL DEFAULT 0,
  vigente_desde date NOT NULL,
  motivo text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT folgas_history_unique_date UNIQUE (collaborator_id, vigente_desde)
);
```

### 1.2 Índice

```sql
CREATE INDEX idx_folgas_hist_lookup
  ON public.collaborator_folgas_history (collaborator_id, vigente_desde DESC);
```

### 1.3 Função `get_folgas_at`

SQL puro (inlinable, melhor performance em chamadas em loop):

```sql
CREATE OR REPLACE FUNCTION public.get_folgas_at(
  p_collaborator_id uuid,
  p_date date
)
RETURNS TABLE (folgas_semanais text[], sunday_n integer)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT folgas_semanais, sunday_n
  FROM public.collaborator_folgas_history
  WHERE collaborator_id = p_collaborator_id
    AND vigente_desde <= p_date
  ORDER BY vigente_desde DESC
  LIMIT 1;
$$;
```

### 1.4 RLS

As policies atuais de `collaborators` são todas `public` com `USING (true)` / `WITH CHECK (true)` (sem restrição de role). Replicar exatamente o mesmo padrão:

```sql
ALTER TABLE public.collaborator_folgas_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view collaborator_folgas_history"
  ON public.collaborator_folgas_history FOR SELECT TO public USING (true);

CREATE POLICY "Anyone can insert collaborator_folgas_history"
  ON public.collaborator_folgas_history FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Anyone can update collaborator_folgas_history"
  ON public.collaborator_folgas_history FOR UPDATE TO public USING (true);

CREATE POLICY "Anyone can delete collaborator_folgas_history"
  ON public.collaborator_folgas_history FOR DELETE TO public USING (true);
```

Observação: o prompt original sugeria restringir a admin/gestor, mas `collaborators` hoje é totalmente aberta. Para manter consistência ("replicar EXATAMENTE o padrão de `collaborators`"), seguimos o mesmo modelo aberto. Endurecer pode virar tarefa separada de segurança aplicada às duas tabelas em conjunto.

### 1.5 Backfill

```sql
INSERT INTO public.collaborator_folgas_history (
  collaborator_id, folgas_semanais, sunday_n, vigente_desde, motivo
)
SELECT
  id,
  folgas_semanais,
  COALESCE(sunday_n, 0),
  COALESCE(inicio_na_empresa, '2020-01-01'::date),
  'Backfill inicial'
FROM public.collaborators
ON CONFLICT (collaborator_id, vigente_desde) DO NOTHING;
```

Esperado: **35 linhas inseridas** (todos os colaboradores têm `inicio_na_empresa` e `folgas_semanais` preenchidos).

## 2. Tipos TypeScript

Em `src/types/collaborator.ts`, adicionar ao final:

```ts
export type CollaboratorFolgasHistoryEntry = {
  id: string;
  collaborator_id: string;
  folgas_semanais: string[];
  sunday_n: number;
  vigente_desde: string; // ISO YYYY-MM-DD
  motivo: string | null;
  created_at: string;
  created_by: string | null;
};

export type FolgasAtDate = {
  folgas_semanais: string[];
  sunday_n: number;
};
```

## 3. Hook `src/hooks/useCollaboratorFolgasHistory.ts`

Esqueleto (não consumido em nenhum componente nesta etapa):

- `useFolgasHistory(collaboratorId)` — `useQuery` com key `['folgas-history', collaboratorId]`, retorna lista ordenada por `vigente_desde DESC`.
- `useAddFolgasHistoryEntry()` — `useMutation` que faz `INSERT` em `collaborator_folgas_history` e invalida a query acima.
- `useDeleteFolgasHistoryEntry()` — `useMutation` que deleta por `id` e invalida.
- `getFolgasAt(collaboratorId, date)` — helper async via `supabase.rpc('get_folgas_at', { p_collaborator_id, p_date })`, retorna `FolgasAtDate | null`.

## 4. Validações ao final

Reportar:
- Linhas inseridas no backfill (esperado: 35).
- Resultado de `SELECT collaborator_id, folgas_semanais, sunday_n, vigente_desde FROM collaborator_folgas_history ORDER BY created_at DESC LIMIT 5;`
- Lista das 4 policies criadas.
- Confirmação de que nenhum arquivo de UI ou `scheduleEngine.ts` foi alterado.

## 5. O que NÃO será alterado

- `src/lib/scheduleEngine.ts` e qualquer leitor atual de folgas
- `src/pages/Colaboradores.tsx` e formulários de cadastro
- Colunas `folgas_semanais` e `sunday_n` em `collaborators` (continuam sendo fonte da folga "atual")
- Nenhuma UI de timeline ou diálogo de "vigente a partir de"
