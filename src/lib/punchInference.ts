/**
 * Punch Inference Engine
 * 
 * Assigns punch types (entrada, saida_intervalo, retorno_intervalo, saida)
 * using historical pattern matching instead of simple chronological ordering.
 */

import type { PunchRecord } from '@/hooks/usePunchRecords';

export interface PunchSlots {
  entrada: string | null;
  saida_intervalo: string | null;
  retorno_intervalo: string | null;
  saida: string | null;
}

const SLOT_KEYS: (keyof PunchSlots)[] = ['entrada', 'saida_intervalo', 'retorno_intervalo', 'saida'];

/** Convert HH:MM to minutes, treating 00:00-02:59 as 24:00-26:59 */
function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h < 3 ? h + 24 : h) * 60 + (m || 0);
}

/**
 * Calculate average punch times from valid historical records.
 * A "valid" record has all 4 punches filled.
 * Returns null if fewer than `minDays` valid records exist.
 */
export function calculatePattern(
  records: PunchRecord[],
  minDays = 5
): Record<keyof PunchSlots, number> | null {
  const valid = records.filter(
    r => r.entrada && r.saida_intervalo && r.retorno_intervalo && r.saida
  );

  if (valid.length < minDays) return null;

  // Take at most 30 most recent
  const recent = valid.slice(0, 30);

  const sums: Record<keyof PunchSlots, number> = {
    entrada: 0, saida_intervalo: 0, retorno_intervalo: 0, saida: 0,
  };

  for (const r of recent) {
    sums.entrada += toMinutes(r.entrada!);
    sums.saida_intervalo += toMinutes(r.saida_intervalo!);
    sums.retorno_intervalo += toMinutes(r.retorno_intervalo!);
    sums.saida += toMinutes(r.saida!);
  }

  const n = recent.length;
  return {
    entrada: sums.entrada / n,
    saida_intervalo: sums.saida_intervalo / n,
    retorno_intervalo: sums.retorno_intervalo / n,
    saida: sums.saida / n,
  };
}

/**
 * Assign punch times to slots using pattern matching.
 * 
 * If 4 punches: sort chronologically (same as before).
 * If <4 punches and pattern available: match each punch to closest slot.
 * Fallback: simple chronological assignment.
 */
export function assignPunchSlots(
  times: string[],
  pattern: Record<keyof PunchSlots, number> | null
): PunchSlots {
  const result: PunchSlots = {
    entrada: null, saida_intervalo: null, retorno_intervalo: null, saida: null,
  };

  if (times.length === 0) return result;

  // Sort times chronologically first (with 03:00 boundary)
  const sorted = [...times].sort((a, b) => toMinutes(a) - toMinutes(b));

  // 4 punches: always assign in order
  if (sorted.length === 4) {
    result.entrada = sorted[0];
    result.saida_intervalo = sorted[1];
    result.retorno_intervalo = sorted[2];
    result.saida = sorted[3];
    return result;
  }

  // If no pattern or insufficient data, fallback to chronological
  if (!pattern) {
    for (let i = 0; i < sorted.length && i < 4; i++) {
      result[SLOT_KEYS[i]] = sorted[i];
    }
    return result;
  }

  // Pattern-based matching: assign each time to the closest unassigned slot
  // Use Hungarian-style greedy assignment (closest match first)
  const timeMins = sorted.map(t => toMinutes(t));
  const availableSlots = [...SLOT_KEYS];
  const assignments: { timeIdx: number; slot: keyof PunchSlots; distance: number }[] = [];

  // Build all possible (time, slot) pairs with distances
  for (let i = 0; i < timeMins.length; i++) {
    for (const slot of SLOT_KEYS) {
      assignments.push({
        timeIdx: i,
        slot,
        distance: Math.abs(timeMins[i] - pattern[slot]),
      });
    }
  }

  // Sort by distance (closest first)
  assignments.sort((a, b) => a.distance - b.distance);

  const assignedTimes = new Set<number>();
  const assignedSlots = new Set<keyof PunchSlots>();

  for (const a of assignments) {
    if (assignedTimes.has(a.timeIdx) || assignedSlots.has(a.slot)) continue;
    result[a.slot] = sorted[a.timeIdx];
    assignedTimes.add(a.timeIdx);
    assignedSlots.add(a.slot);
    if (assignedTimes.size === timeMins.length) break;
  }

  return result;
}

/**
 * High-level function: given raw time strings and historical records,
 * assign them to punch slots.
 */
export function inferPunchSlots(
  rawTimes: (string | null | undefined)[],
  historicalRecords: PunchRecord[]
): PunchSlots {
  const times = rawTimes.filter((t): t is string => !!t && t.trim() !== '');
  const pattern = calculatePattern(historicalRecords);
  return assignPunchSlots(times, pattern);
}
