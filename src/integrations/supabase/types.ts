export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      avisos_previos: {
        Row: {
          assinatura: boolean
          collaborator_id: string
          collaborator_name: string
          created_at: string
          data_envio_contabilidade: string | null
          data_fim: string
          data_inicio: string
          data_pagamento: string | null
          enviado_contabilidade: boolean
          exame: boolean
          id: string
          observacoes: string | null
          opcao: string
          pago: boolean
          sector: string
          status_processo: string
          updated_at: string
        }
        Insert: {
          assinatura?: boolean
          collaborator_id: string
          collaborator_name: string
          created_at?: string
          data_envio_contabilidade?: string | null
          data_fim: string
          data_inicio: string
          data_pagamento?: string | null
          enviado_contabilidade?: boolean
          exame?: boolean
          id?: string
          observacoes?: string | null
          opcao?: string
          pago?: boolean
          sector: string
          status_processo?: string
          updated_at?: string
        }
        Update: {
          assinatura?: boolean
          collaborator_id?: string
          collaborator_name?: string
          created_at?: string
          data_envio_contabilidade?: string | null
          data_fim?: string
          data_inicio?: string
          data_pagamento?: string | null
          enviado_contabilidade?: boolean
          exame?: boolean
          id?: string
          observacoes?: string | null
          opcao?: string
          pago?: boolean
          sector?: string
          status_processo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "avisos_previos_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
        ]
      }
      collaborators: {
        Row: {
          collaborator_name: string
          created_at: string
          data_desligamento: string | null
          data_fim_aviso: string | null
          data_fim_experiencia: string | null
          data_retorno: string | null
          fim_periodo: string | null
          folgas_semanais: string[]
          id: string
          inicio_na_empresa: string | null
          inicio_periodo: string | null
          sector: string
          status: string
          sunday_n: number
          tipo_escala: string
          updated_at: string
          weekly_day_off: string
        }
        Insert: {
          collaborator_name: string
          created_at?: string
          data_desligamento?: string | null
          data_fim_aviso?: string | null
          data_fim_experiencia?: string | null
          data_retorno?: string | null
          fim_periodo?: string | null
          folgas_semanais?: string[]
          id?: string
          inicio_na_empresa?: string | null
          inicio_periodo?: string | null
          sector: string
          status?: string
          sunday_n?: number
          tipo_escala?: string
          updated_at?: string
          weekly_day_off?: string
        }
        Update: {
          collaborator_name?: string
          created_at?: string
          data_desligamento?: string | null
          data_fim_aviso?: string | null
          data_fim_experiencia?: string | null
          data_retorno?: string | null
          fim_periodo?: string | null
          folgas_semanais?: string[]
          id?: string
          inicio_na_empresa?: string | null
          inicio_periodo?: string | null
          sector?: string
          status?: string
          sunday_n?: number
          tipo_escala?: string
          updated_at?: string
          weekly_day_off?: string
        }
        Relationships: []
      }
      daily_sales: {
        Row: {
          created_at: string
          date: string
          faturamento_salao: number
          faturamento_tele: number
          faturamento_total: number
          id: string
          pedidos_salao: number
          pedidos_tele: number
          pedidos_totais: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          faturamento_salao?: number
          faturamento_tele?: number
          faturamento_total?: number
          id?: string
          pedidos_salao?: number
          pedidos_tele?: number
          pedidos_totais?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          faturamento_salao?: number
          faturamento_tele?: number
          faturamento_total?: number
          id?: string
          pedidos_salao?: number
          pedidos_tele?: number
          pedidos_totais?: number
          updated_at?: string
        }
        Relationships: []
      }
      freelancer_entries: {
        Row: {
          created_at: string
          date: string
          id: string
          name: string
          sector: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          name: string
          sector: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          name?: string
          sector?: string
          updated_at?: string
        }
        Relationships: []
      }
      freelancers: {
        Row: {
          created_at: string
          date: string
          id: string
          quantity: number
          sector: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          quantity?: number
          sector: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          quantity?: number
          sector?: string
          updated_at?: string
        }
        Relationships: []
      }
      holiday_compensations: {
        Row: {
          collaborator_id: string
          collaborator_name: string
          compensation_date: string | null
          created_at: string
          eligible: boolean
          holiday_date: string
          holiday_name: string
          id: string
          observacao: string | null
          sector: string
          status: string
          updated_at: string
        }
        Insert: {
          collaborator_id: string
          collaborator_name: string
          compensation_date?: string | null
          created_at?: string
          eligible?: boolean
          holiday_date: string
          holiday_name: string
          id?: string
          observacao?: string | null
          sector: string
          status?: string
          updated_at?: string
        }
        Update: {
          collaborator_id?: string
          collaborator_name?: string
          compensation_date?: string | null
          created_at?: string
          eligible?: boolean
          holiday_date?: string
          holiday_name?: string
          id?: string
          observacao?: string | null
          sector?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "holiday_compensations_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
        ]
      }
      holidays: {
        Row: {
          created_at: string
          date: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      hr_event_completions: {
        Row: {
          concluded_at: string | null
          concluded_by: string | null
          conclusion_note: string | null
          created_at: string
          event_key: string
          id: string
          original_date: string | null
          override_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          concluded_at?: string | null
          concluded_by?: string | null
          conclusion_note?: string | null
          created_at?: string
          event_key: string
          id?: string
          original_date?: string | null
          override_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          concluded_at?: string | null
          concluded_by?: string | null
          conclusion_note?: string | null
          created_at?: string
          event_key?: string
          id?: string
          original_date?: string | null
          override_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      hr_reminders: {
        Row: {
          collaborator_id: string | null
          collaborator_name: string | null
          concluded_at: string | null
          concluded_by: string | null
          conclusion_note: string | null
          created_at: string
          created_by: string | null
          description: string | null
          event_date: string
          event_time: string | null
          id: string
          postponed_to: string | null
          priority: string
          recurrence: string
          reminder_type: string
          responsible: string | null
          sector: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          collaborator_id?: string | null
          collaborator_name?: string | null
          concluded_at?: string | null
          concluded_by?: string | null
          conclusion_note?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_date: string
          event_time?: string | null
          id?: string
          postponed_to?: string | null
          priority?: string
          recurrence?: string
          reminder_type?: string
          responsible?: string | null
          sector?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          collaborator_id?: string | null
          collaborator_name?: string | null
          concluded_at?: string | null
          concluded_by?: string | null
          conclusion_note?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_date?: string
          event_time?: string | null
          id?: string
          postponed_to?: string | null
          priority?: string
          recurrence?: string
          reminder_type?: string
          responsible?: string | null
          sector?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_reminders_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_vacations: {
        Row: {
          aviso_ferias_assinado: boolean
          collaborator_id: string
          collaborator_name: string
          contabilidade_solicitada: boolean
          created_at: string
          data_fim_ferias: string
          data_inicio_ferias: string
          data_pagamento_ferias: string | null
          id: string
          observacao: string | null
          pagamento_efetuado: boolean
          recibo_assinado: boolean
          sector: string
          status: string
          updated_at: string
        }
        Insert: {
          aviso_ferias_assinado?: boolean
          collaborator_id: string
          collaborator_name: string
          contabilidade_solicitada?: boolean
          created_at?: string
          data_fim_ferias: string
          data_inicio_ferias: string
          data_pagamento_ferias?: string | null
          id?: string
          observacao?: string | null
          pagamento_efetuado?: boolean
          recibo_assinado?: boolean
          sector: string
          status?: string
          updated_at?: string
        }
        Update: {
          aviso_ferias_assinado?: boolean
          collaborator_id?: string
          collaborator_name?: string
          contabilidade_solicitada?: boolean
          created_at?: string
          data_fim_ferias?: string
          data_inicio_ferias?: string
          data_pagamento_ferias?: string | null
          id?: string
          observacao?: string | null
          pagamento_efetuado?: boolean
          recibo_assinado?: boolean
          sector?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_vacations_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios: {
        Row: {
          created_at: string
          email: string
          id: string
          nome: string
          perfil: string
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          nome: string
          perfil?: string
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          nome?: string
          perfil?: string
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
