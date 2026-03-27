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

export const SECTORS = ['COZINHA', 'SALÃO', 'TELE - ENTREGA', 'DIURNO', 'ADM'] as const;

export const TIPO_ESCALA = ['6x1', '5x2', '4x3'] as const;
export type TipoEscala = typeof TIPO_ESCALA[number];

export const STATUS_OPTIONS = ['ATIVO', 'FERIAS', 'AFASTADO', 'EXPERIENCIA', 'AVISO_PREVIO', 'DESLIGADO'] as const;
export type CollaboratorStatus = typeof STATUS_OPTIONS[number];

export const STATUS_LABELS: Record<CollaboratorStatus, string> = {
  ATIVO: 'Ativo',
  FERIAS: 'Férias',
  AFASTADO: 'Afastado',
  EXPERIENCIA: 'Experiência',
  AVISO_PREVIO: 'Aviso Prévio',
  DESLIGADO: 'Desligado',
};

export interface Collaborator {
  id: string;
  collaborator_name: string;
  sector: string;
  tipo_escala: TipoEscala;
  folgas_semanais: DayOfWeek[];
  sunday_n: number;
  status: CollaboratorStatus;
  inicio_na_empresa: string | null;
  data_desligamento: string | null;
  inicio_periodo: string | null;
  fim_periodo: string | null;
  pis_matricula: string | null;
  genero: string;
  // legacy fields kept for DB compat
  data_retorno: string | null;
  data_fim_experiencia: string | null;
  data_fim_aviso: string | null;
  weekly_day_off: string;
  created_at: string;
  updated_at: string;
  intervalo_automatico: boolean;
  intervalo_inicio: string | null;
  intervalo_duracao: number | null;
  carga_horaria_diaria: string | null;
}
