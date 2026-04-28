## Diagnóstico final

Em 14/04/2026 o total de 6 pessoas na cozinha está **correto** segundo a regra que você confirmou: só desconta quando há FALTA/ATESTADO/COMPENSAÇÃO **lançada manualmente**, ou quando o colaborador controla ponto e não bateu (sem justificativa).

- LUCAS GRINGO tem `controla_ponto = false` → não pode ser inferido como falta.
- Nenhuma FALTA manual foi lançada para ele em 14/04 (verificado em `schedule_events` e `afastamentos`).
- O motor de Produtividade está certo: 6 pessoas (11 ativos − 3 folgas semanais de terça − Diego com FALTA manual − DINHO em férias).

O problema é só visual: a grade da Escala mostra o badge "FALTA" indevidamente na linha do Lucas. Causa raiz: existem **4 colaboradores ativos com `display_name = "Lucas"`** (LUCAS GRINGO/cozinha, Lucas Souza/salão, Lucas Menezes/ADM, Lucas Tidre/ADM). O lookup `collabByName[displayName]` na Escala usa apenas o nome curto como chave, então um sobrescreve o outro. Quando a célula da cozinha pergunta "quem é o Lucas?", a grade entrega um Lucas de outro setor (que controla ponto e não bateu) → badge "FALTA" aparece em cima do GRINGO.

## Correção

### 1. `src/pages/Escala.tsx` — lookup com escopo de setor

- Trocar `collabByName: Record<displayName, Collaborator>` por um lookup que considera o **setor da célula** atual: `collabByNameAndSector[`${displayName}|${sector}`]`.
- Manter o lookup por nome simples como fallback **apenas quando não houver colisão** para aquele nome.
- Nos três pontos onde a célula é resolvida (linhas ~541, ~598, ~1015), passar o `sector` da coluna/linha atual para o lookup.

Resultado: a célula da cozinha resolve para LUCAS GRINGO (controla_ponto=false), o badge "FALTA" desaparece, contagem visual passa a bater com o motor de Produtividade.

### 2. (Opcional) Aviso de colisão no console em dev

Logar uma vez quando dois colaboradores ativos compartilharem `display_name`, para que o admin saiba que precisa diferenciar (ex.: "Lucas G.", "Lucas S.").

### Não vamos mexer

- `productivityEngine.ts` — já está correto.
- Banco de dados — sem migrations.
- Regra de inferência de FALTA — mantida exatamente como está (só infere para quem controla ponto, e só se não houver justificativa).

### Validação após o fix

Abrir 14/04 na Escala da cozinha:
- 5 cozinheiros presentes (Cicero, Davi, Elionel, Javier, Sheyla)
- Diego: badge "faltou" (FALTA manual) — riscado
- Lucas: presente, **sem** badge FALTA
- DINHO: ausente (em férias)
- Total esperado na Produtividade: 6 ✅
