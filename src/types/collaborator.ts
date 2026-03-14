export const DAYS_OF_WEEK = [
  'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo',
] as const;

export type DayOfWeek = typeof DAYS_OF_WEEK[number];

export const DAY_LABELS: Record<DayOfWeek, string> = {
  segunda: 'Segunda',
  terca: 'Terça',
  quarta: 'Quarta',
  quinta: 'Quinta',
  sexta: 'Sexta',
  sabado: 'Sábado',
  domingo: 'Domingo',
};

export interface Collaborator {
  id: string;
  sector: string;
  collaborator_name: string;
  weekly_day_off: DayOfWeek;
  sunday_n: number; // 1-5, which Sunday of the month is off
  created_at: string;
  updated_at: string;
}

export const SECTORS = [
  'Cozinha',
  'Salão',
  'Bar',
  'Delivery',
  'Caixa',
  'Limpeza',
  'Gerência',
] as const;
