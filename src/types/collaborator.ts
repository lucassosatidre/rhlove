export const DAYS_OF_WEEK = [
  'SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO', 'DOMINGO',
] as const;

export type DayOfWeek = typeof DAYS_OF_WEEK[number];

export const DAY_LABELS: Record<DayOfWeek, string> = {
  SEGUNDA: 'Segunda',
  TERCA: 'Terça',
  QUARTA: 'Quarta',
  QUINTA: 'Quinta',
  SEXTA: 'Sexta',
  SABADO: 'Sábado',
  DOMINGO: 'Domingo',
};

export const SECTORS = ['COZINHA', 'SALÃO', 'DIURNO', 'TELE - ENTREGA'] as const;

export const TIPO_ESCALA = ['6x1', '5x2', '4x3'] as const;
export type TipoEscala = typeof TIPO_ESCALA[number];

export const STATUS_OPTIONS = ['ATIVO', 'FERIAS', 'AFASTADO', 'EXPERIENCIA', 'AVISO_PREVIO'] as const;
export type CollaboratorStatus = typeof STATUS_OPTIONS[number];

export const STATUS_LABELS: Record<CollaboratorStatus, string> = {
  ATIVO: 'Ativo',
  FERIAS: 'Férias',
  AFASTADO: 'Afastado',
  EXPERIENCIA: 'Experiência',
  AVISO_PREVIO: 'Aviso Prévio',
};

export interface Collaborator {
  id: string;
  collaborator_name: string;
  sector: string;
  tipo_escala: TipoEscala;
  folgas_semanais: DayOfWeek[];
  sunday_n: number;
  status: CollaboratorStatus;
  data_retorno: string | null;
  data_fim_experiencia: string | null;
  data_fim_aviso: string | null;
  weekly_day_off: string; // legacy, kept for DB compat
  created_at: string;
  updated_at: string;
}
