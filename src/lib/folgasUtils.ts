import type { DayOfWeek } from '@/types/collaborator';

/**
 * Retorna a data de hoje em formato YYYY-MM-DD na timezone LOCAL do usuário
 * (Florianópolis = BRT/UTC-3). NÃO use new Date().toISOString() pra isso —
 * isoString converte pra UTC e à noite no Brasil pode retornar o dia seguinte.
 */
export function todayLocalISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Compara duas listas de folgas semanais como conjuntos (ordem irrelevante).
 */
export function folgasMudaram(
  prevFolgas: DayOfWeek[] | string[],
  prevSundayN: number,
  nextFolgas: DayOfWeek[] | string[],
  nextSundayN: number
): boolean {
  if ((prevSundayN ?? 0) !== (nextSundayN ?? 0)) return true;
  const a = new Set((prevFolgas ?? []).map(String));
  const b = new Set((nextFolgas ?? []).map(String));
  if (a.size !== b.size) return true;
  for (const x of a) if (!b.has(x)) return true;
  return false;
}
