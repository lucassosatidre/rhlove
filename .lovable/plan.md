## Bug

Na página **Escala**, colaboradores com `ponto_online = true` aparecem como FALTA mesmo após terem batido o ponto pelo app. A causa é que `punchSet` (linha 201-211 de `src/pages/Escala.tsx`) é montado apenas a partir de `punch_records` (relógio físico / importação AFD/Excel). As batidas do app vão para `online_punch_records`, então o par `collaborator_id|YYYY-MM-DD` nunca entra no set e a Escala marca FALTA.

Confirmado em produção: Ana Jullia (ponto online) tem 24 batidas em `online_punch_records` entre 20–25/04 e 0 linhas em `punch_records` no mesmo período → grid mostra FALTA todos os dias.

## Correção

Restrita à página `src/pages/Escala.tsx`. Não mexer em Espelho de Ponto, Banco de Horas, Fechamento de Folha, hooks compartilhados.

### 1. Buscar batidas online no mesmo intervalo

Adicionar uma `useQuery` local na página (logo após o hook `usePunchRecords` na linha 74) que carrega `online_punch_records` filtrado por `punch_time` no `dateRange`:

- Query key: `['online_punches_for_schedule', dateRange.start, dateRange.end]`
- Select: `collaborator_id, punch_time` (só o necessário pra montar presença)
- Filtros: `punch_time >= dateRange.start` e `punch_time <= dateRange.end + 1 dia` (para cobrir fuso e a regra de dia útil 03:00–02:59)
- `staleTime`: 30s

### 2. Derivar pares (collaborator_id, dia local) a partir do timestamp

`online_punch_records.punch_time` é `timestamptz`. Converter para a data **local** (Brasília/BRT) em formato `YYYY-MM-DD` antes de inserir no set, usando o mesmo padrão já existente em `src/lib/folgasUtils.ts` (`todayLocalISO`-style). Apenas presença importa — não consolidar horários.

### 3. Unir no `punchSet` (linha 201-211)

Atualizar o `useMemo` para receber também os registros online:

```text
const { punchSet, lastPunchDate } = useMemo(() => {
  const set = new Set<string>();
  let maxDate = '';

  // Ponto físico / AFD / Excel
  for (const p of punchRecords) {
    if (p.entrada) {
      set.add(`${p.collaborator_id}|${p.date}`);
      if (p.date > maxDate) maxDate = p.date;
    }
  }

  // Ponto online — inclui no mesmo set
  for (const op of onlinePunches) {
    const dateKey = toLocalDateKey(op.punch_time); // BRT, YYYY-MM-DD
    set.add(`${op.collaborator_id}|${dateKey}`);
    if (dateKey > maxDate) maxDate = dateKey;
  }

  return { punchSet: set, lastPunchDate: maxDate || null };
}, [punchRecords, onlinePunches]);
```

### 4. `lastPunchDate` continua válido

Como o ponto online também alimenta `maxDate`, o gate `dateKey <= lastPunchDate` (que evita marcar FALTA em dias futuros antes de o relógio ser importado) continua funcionando para os dois casos. Não precisa de tratamento especial.

## Detalhes técnicos

- Arquivo único alterado: `src/pages/Escala.tsx`
- Sem migrations, sem mudança de RLS (a policy "Admin full access online_punch_records" já cobre admins logados)
- Helper `toLocalDateKey(ts: string)` declarado dentro do arquivo (pequeno, ~5 linhas) — não vale criar utilitário compartilhado para uma única chamada
- A chave do set permanece `"collaborator_id|YYYY-MM-DD"` exatamente como hoje
- Nenhuma alteração em `usePunchRecords`, `jornadaEngine`, `bankHoursBalance`, `FechamentoFolha` ou no Espelho de Ponto

## Validação esperada

Após o deploy, abrir Escala em Abril/2026 e verificar que a Ana Jullia (ponto online) deixa de aparecer com badge FALTA nos dias 20, 21, 22, 23, 24 e 25/04 — passa a aparecer normalmente. Colaboradores com ponto físico continuam idênticos.
