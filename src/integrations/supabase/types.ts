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
      afastamentos: {
        Row: {
          collaborator_id: string
          collaborator_name: string
          created_at: string
          created_by: string | null
          data_fim: string
          data_inicio: string
          id: string
          motivo: string
          observacao: string | null
          sector: string
          updated_at: string
        }
        Insert: {
          collaborator_id: string
          collaborator_name: string
          created_at?: string
          created_by?: string | null
          data_fim: string
          data_inicio: string
          id?: string
          motivo?: string
          observacao?: string | null
          sector: string
          updated_at?: string
        }
        Update: {
          collaborator_id?: string
          collaborator_name?: string
          created_at?: string
          created_by?: string | null
          data_fim?: string
          data_inicio?: string
          id?: string
          motivo?: string
          observacao?: string | null
          sector?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "afastamentos_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
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
      bank_hours_balance: {
        Row: {
          accumulated_balance: number
          collaborator_id: string
          created_at: string
          id: string
          month: number
          updated_at: string
          year: number
        }
        Insert: {
          accumulated_balance?: number
          collaborator_id: string
          created_at?: string
          id?: string
          month: number
          updated_at?: string
          year: number
        }
        Update: {
          accumulated_balance?: number
          collaborator_id?: string
          created_at?: string
          id?: string
          month?: number
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "bank_hours_balance_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_hours_folgas: {
        Row: {
          collaborator_id: string
          created_at: string
          created_by: string | null
          folga_date: string
          hours_debited: number
          id: string
          reason: string | null
          updated_at: string
        }
        Insert: {
          collaborator_id: string
          created_at?: string
          created_by?: string | null
          folga_date: string
          hours_debited?: number
          id?: string
          reason?: string | null
          updated_at?: string
        }
        Update: {
          collaborator_id?: string
          created_at?: string
          created_by?: string | null
          folga_date?: string
          hours_debited?: number
          id?: string
          reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_hours_folgas_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_hours_transactions: {
        Row: {
          balance_after_minutes: number
          collaborator_id: string
          created_at: string
          created_by: string | null
          credit_minutes: number
          debit_minutes: number
          description: string | null
          id: string
          reference_month: number | null
          reference_year: number | null
          semester_start: string
          transaction_date: string
          type: string
          updated_at: string
        }
        Insert: {
          balance_after_minutes?: number
          collaborator_id: string
          created_at?: string
          created_by?: string | null
          credit_minutes?: number
          debit_minutes?: number
          description?: string | null
          id?: string
          reference_month?: number | null
          reference_year?: number | null
          semester_start: string
          transaction_date: string
          type?: string
          updated_at?: string
        }
        Update: {
          balance_after_minutes?: number
          collaborator_id?: string
          created_at?: string
          created_by?: string | null
          credit_minutes?: number
          debit_minutes?: number
          description?: string | null
          id?: string
          reference_month?: number | null
          reference_year?: number | null
          semester_start?: string
          transaction_date?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_hours_transactions_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
        ]
      }
      bonus_10_config: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          month: number
          receita_taxa_servico: number
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          month: number
          receita_taxa_servico?: number
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          month?: number
          receita_taxa_servico?: number
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      bonus_10_monthly: {
        Row: {
          carga_horaria: number | null
          collaborator_id: string
          created_at: string
          created_by: string | null
          funcao: string | null
          id: string
          month: number
          pontos: number | null
          pontos_override: number | null
          updated_at: string
          valor_bonus: number | null
          valor_ponto: number | null
          year: number
        }
        Insert: {
          carga_horaria?: number | null
          collaborator_id: string
          created_at?: string
          created_by?: string | null
          funcao?: string | null
          id?: string
          month: number
          pontos?: number | null
          pontos_override?: number | null
          updated_at?: string
          valor_bonus?: number | null
          valor_ponto?: number | null
          year: number
        }
        Update: {
          carga_horaria?: number | null
          collaborator_id?: string
          created_at?: string
          created_by?: string | null
          funcao?: string | null
          id?: string
          month?: number
          pontos?: number | null
          pontos_override?: number | null
          updated_at?: string
          valor_bonus?: number | null
          valor_ponto?: number | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "bonus_10_monthly_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
        ]
      }
      bonus_funcao_pontos: {
        Row: {
          carga_horaria: number
          created_at: string
          funcao: string
          id: string
          pontos: number
          updated_at: string
        }
        Insert: {
          carga_horaria: number
          created_at?: string
          funcao: string
          id?: string
          pontos: number
          updated_at?: string
        }
        Update: {
          carga_horaria?: number
          created_at?: string
          funcao?: string
          id?: string
          pontos?: number
          updated_at?: string
        }
        Relationships: []
      }
      checkouts: {
        Row: {
          audio_path: string | null
          checkout_date: string
          checkout_time: string
          collaborator_name: string
          created_at: string
          duration_seconds: number
          id: string
          transcription: string | null
          transcription_status: string
          updated_at: string
          usuario_id: string
        }
        Insert: {
          audio_path?: string | null
          checkout_date?: string
          checkout_time?: string
          collaborator_name: string
          created_at?: string
          duration_seconds?: number
          id?: string
          transcription?: string | null
          transcription_status?: string
          updated_at?: string
          usuario_id: string
        }
        Update: {
          audio_path?: string | null
          checkout_date?: string
          checkout_time?: string
          collaborator_name?: string
          created_at?: string
          duration_seconds?: number
          id?: string
          transcription?: string | null
          transcription_status?: string
          updated_at?: string
          usuario_id?: string
        }
        Relationships: []
      }
      collaborators: {
        Row: {
          aviso_previo_reducao: number | null
          carga_horaria_diaria: string | null
          carga_horaria_mensal: number | null
          collaborator_name: string
          controla_ponto: boolean
          cpf: string | null
          created_at: string
          data_desligamento: string | null
          data_fim_aviso: string | null
          data_fim_experiencia: string | null
          data_retorno: string | null
          display_name: string | null
          fim_periodo: string | null
          folgas_semanais: string[]
          funcao: string | null
          genero: string
          horario_entrada: string | null
          horario_saida: string | null
          id: string
          inicio_na_empresa: string | null
          inicio_periodo: string | null
          intervalo_automatico: boolean
          intervalo_duracao: number | null
          intervalo_inicio: string | null
          jornadas_especiais: Json | null
          matricula: string | null
          pis_matricula: string | null
          ponto_online: boolean
          salario_base: number | null
          sector: string
          status: string
          sunday_n: number
          tipo_escala: string
          updated_at: string
          vt_ativo: boolean
          vt_dias_mes: number | null
          vt_passagens_dia: number
          weekly_day_off: string
        }
        Insert: {
          aviso_previo_reducao?: number | null
          carga_horaria_diaria?: string | null
          carga_horaria_mensal?: number | null
          collaborator_name: string
          controla_ponto?: boolean
          cpf?: string | null
          created_at?: string
          data_desligamento?: string | null
          data_fim_aviso?: string | null
          data_fim_experiencia?: string | null
          data_retorno?: string | null
          display_name?: string | null
          fim_periodo?: string | null
          folgas_semanais?: string[]
          funcao?: string | null
          genero?: string
          horario_entrada?: string | null
          horario_saida?: string | null
          id?: string
          inicio_na_empresa?: string | null
          inicio_periodo?: string | null
          intervalo_automatico?: boolean
          intervalo_duracao?: number | null
          intervalo_inicio?: string | null
          jornadas_especiais?: Json | null
          matricula?: string | null
          pis_matricula?: string | null
          ponto_online?: boolean
          salario_base?: number | null
          sector: string
          status?: string
          sunday_n?: number
          tipo_escala?: string
          updated_at?: string
          vt_ativo?: boolean
          vt_dias_mes?: number | null
          vt_passagens_dia?: number
          weekly_day_off?: string
        }
        Update: {
          aviso_previo_reducao?: number | null
          carga_horaria_diaria?: string | null
          carga_horaria_mensal?: number | null
          collaborator_name?: string
          controla_ponto?: boolean
          cpf?: string | null
          created_at?: string
          data_desligamento?: string | null
          data_fim_aviso?: string | null
          data_fim_experiencia?: string | null
          data_retorno?: string | null
          display_name?: string | null
          fim_periodo?: string | null
          folgas_semanais?: string[]
          funcao?: string | null
          genero?: string
          horario_entrada?: string | null
          horario_saida?: string | null
          id?: string
          inicio_na_empresa?: string | null
          inicio_periodo?: string | null
          intervalo_automatico?: boolean
          intervalo_duracao?: number | null
          intervalo_inicio?: string | null
          jornadas_especiais?: Json | null
          matricula?: string | null
          pis_matricula?: string | null
          ponto_online?: boolean
          salario_base?: number | null
          sector?: string
          status?: string
          sunday_n?: number
          tipo_escala?: string
          updated_at?: string
          vt_ativo?: boolean
          vt_dias_mes?: number | null
          vt_passagens_dia?: number
          weekly_day_off?: string
        }
        Relationships: []
      }
      compras_insumos: {
        Row: {
          collaborator_name: string
          created_at: string
          id: string
          item_name: string
          observation: string | null
          priority: string
          status: string
          stock_quantity: string
          updated_at: string
          usuario_id: string
        }
        Insert: {
          collaborator_name: string
          created_at?: string
          id?: string
          item_name: string
          observation?: string | null
          priority?: string
          status?: string
          stock_quantity?: string
          updated_at?: string
          usuario_id: string
        }
        Update: {
          collaborator_name?: string
          created_at?: string
          id?: string
          item_name?: string
          observation?: string | null
          priority?: string
          status?: string
          stock_quantity?: string
          updated_at?: string
          usuario_id?: string
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
      demand_comments: {
        Row: {
          comment: string
          created_at: string
          demand_id: string
          id: string
          user_id: string
        }
        Insert: {
          comment: string
          created_at?: string
          demand_id: string
          id?: string
          user_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          demand_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "demand_comments_demand_id_fkey"
            columns: ["demand_id"]
            isOneToOne: false
            referencedRelation: "demands"
            referencedColumns: ["id"]
          },
        ]
      }
      demand_status_history: {
        Row: {
          changed_by: string
          created_at: string
          demand_id: string
          id: string
          new_status: string
          old_status: string | null
        }
        Insert: {
          changed_by: string
          created_at?: string
          demand_id: string
          id?: string
          new_status: string
          old_status?: string | null
        }
        Update: {
          changed_by?: string
          created_at?: string
          demand_id?: string
          id?: string
          new_status?: string
          old_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demand_status_history_demand_id_fkey"
            columns: ["demand_id"]
            isOneToOne: false
            referencedRelation: "demands"
            referencedColumns: ["id"]
          },
        ]
      }
      demands: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          item_name: string | null
          observation: string | null
          photos: string[]
          priority: string
          sector: string | null
          status: string
          stock_quantity: string | null
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          item_name?: string | null
          observation?: string | null
          photos?: string[]
          priority?: string
          sector?: string | null
          status?: string
          stock_quantity?: string | null
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          item_name?: string | null
          observation?: string | null
          photos?: string[]
          priority?: string
          sector?: string | null
          status?: string
          stock_quantity?: string | null
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      freelancer_entries: {
        Row: {
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          created_by: string | null
          date: string
          id: string
          name: string
          observation: string | null
          origin: string
          sector: string
          status: string
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          id?: string
          name: string
          observation?: string | null
          origin?: string
          sector: string
          status?: string
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          name?: string
          observation?: string | null
          origin?: string
          sector?: string
          status?: string
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
      manutencoes: {
        Row: {
          collaborator_name: string
          created_at: string
          description: string
          id: string
          observation: string | null
          photo_paths: string[]
          priority: string
          sector: string | null
          status: string
          updated_at: string
          usuario_id: string
        }
        Insert: {
          collaborator_name: string
          created_at?: string
          description: string
          id?: string
          observation?: string | null
          photo_paths?: string[]
          priority?: string
          sector?: string | null
          status?: string
          updated_at?: string
          usuario_id: string
        }
        Update: {
          collaborator_name?: string
          created_at?: string
          description?: string
          id?: string
          observation?: string | null
          photo_paths?: string[]
          priority?: string
          sector?: string | null
          status?: string
          updated_at?: string
          usuario_id?: string
        }
        Relationships: []
      }
      online_punch_records: {
        Row: {
          collaborator_id: string
          created_at: string
          created_by: string
          device_ip: string | null
          device_user_agent: string | null
          id: string
          notes: string | null
          punch_time: string
        }
        Insert: {
          collaborator_id: string
          created_at?: string
          created_by: string
          device_ip?: string | null
          device_user_agent?: string | null
          id?: string
          notes?: string | null
          punch_time?: string
        }
        Update: {
          collaborator_id?: string
          created_at?: string
          created_by?: string
          device_ip?: string | null
          device_user_agent?: string | null
          id?: string
          notes?: string | null
          punch_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "online_punch_records_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_closings: {
        Row: {
          created_at: string
          data_snapshot: Json | null
          id: string
          month: number
          processed_at: string | null
          processed_by: string | null
          status: string
          template_file_name: string | null
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          data_snapshot?: Json | null
          id?: string
          month: number
          processed_at?: string | null
          processed_by?: string | null
          status?: string
          template_file_name?: string | null
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          data_snapshot?: Json | null
          id?: string
          month?: number
          processed_at?: string | null
          processed_by?: string | null
          status?: string
          template_file_name?: string | null
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      punch_records: {
        Row: {
          adjusted_at: string | null
          adjusted_by: string | null
          adjustment_reason: string | null
          collaborator_id: string
          collaborator_name: string
          created_at: string
          date: string
          entrada: string | null
          id: string
          retorno_intervalo: string | null
          saida: string | null
          saida_intervalo: string | null
          updated_at: string
        }
        Insert: {
          adjusted_at?: string | null
          adjusted_by?: string | null
          adjustment_reason?: string | null
          collaborator_id: string
          collaborator_name: string
          created_at?: string
          date: string
          entrada?: string | null
          id?: string
          retorno_intervalo?: string | null
          saida?: string | null
          saida_intervalo?: string | null
          updated_at?: string
        }
        Update: {
          adjusted_at?: string | null
          adjusted_by?: string | null
          adjustment_reason?: string | null
          collaborator_id?: string
          collaborator_name?: string
          created_at?: string
          date?: string
          entrada?: string | null
          id?: string
          retorno_intervalo?: string | null
          saida?: string | null
          saida_intervalo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "punch_records_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
        ]
      }
      saipos_sync_log: {
        Row: {
          created_at: string
          error_message: string | null
          faturamento_total: number
          id: string
          mode: string
          pedidos_totais: number
          status: string
          sync_date: string
          total_sales: number
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          faturamento_total?: number
          id?: string
          mode?: string
          pedidos_totais?: number
          status?: string
          sync_date: string
          total_sales?: number
        }
        Update: {
          created_at?: string
          error_message?: string | null
          faturamento_total?: number
          id?: string
          mode?: string
          pedidos_totais?: number
          status?: string
          sync_date?: string
          total_sales?: number
        }
        Relationships: []
      }
      schedule_events: {
        Row: {
          collaborator_id: string
          collaborator_name: string
          created_at: string
          created_by: string | null
          event_date: string
          event_date_end: string | null
          event_type: string
          holiday_compensation_id: string | null
          id: string
          observation: string | null
          original_day: string | null
          related_collaborator_id: string | null
          related_collaborator_name: string | null
          reverted_at: string | null
          reverted_by: string | null
          reverted_reason: string | null
          status: string
          swapped_day: string | null
          updated_at: string
          week_start: string | null
        }
        Insert: {
          collaborator_id: string
          collaborator_name: string
          created_at?: string
          created_by?: string | null
          event_date: string
          event_date_end?: string | null
          event_type: string
          holiday_compensation_id?: string | null
          id?: string
          observation?: string | null
          original_day?: string | null
          related_collaborator_id?: string | null
          related_collaborator_name?: string | null
          reverted_at?: string | null
          reverted_by?: string | null
          reverted_reason?: string | null
          status?: string
          swapped_day?: string | null
          updated_at?: string
          week_start?: string | null
        }
        Update: {
          collaborator_id?: string
          collaborator_name?: string
          created_at?: string
          created_by?: string | null
          event_date?: string
          event_date_end?: string | null
          event_type?: string
          holiday_compensation_id?: string | null
          id?: string
          observation?: string | null
          original_day?: string | null
          related_collaborator_id?: string | null
          related_collaborator_name?: string | null
          reverted_at?: string | null
          reverted_by?: string | null
          reverted_reason?: string | null
          status?: string
          swapped_day?: string | null
          updated_at?: string
          week_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_events_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_events_holiday_compensation_id_fkey"
            columns: ["holiday_compensation_id"]
            isOneToOne: false
            referencedRelation: "holiday_compensations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_events_related_collaborator_id_fkey"
            columns: ["related_collaborator_id"]
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
      sunday_tracking: {
        Row: {
          collaborator_id: string
          consecutive_sundays_from_previous: number
          created_at: string
          id: string
          month: number
          updated_at: string
          year: number
        }
        Insert: {
          collaborator_id: string
          consecutive_sundays_from_previous?: number
          created_at?: string
          id?: string
          month: number
          updated_at?: string
          year: number
        }
        Update: {
          collaborator_id?: string
          consecutive_sundays_from_previous?: number
          created_at?: string
          id?: string
          month?: number
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "sunday_tracking_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          comment: string
          created_at: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          comment: string
          created_at?: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_status_history: {
        Row: {
          changed_by: string
          created_at: string
          id: string
          new_status: string
          old_status: string | null
          task_id: string
        }
        Insert: {
          changed_by: string
          created_at?: string
          id?: string
          new_status: string
          old_status?: string | null
          task_id: string
        }
        Update: {
          changed_by?: string
          created_at?: string
          id?: string
          new_status?: string
          old_status?: string | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_status_history_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string
          category: string
          created_at: string
          created_by: string
          description: string | null
          due_date: string
          id: string
          priority: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to: string
          category?: string
          created_at?: string
          created_by: string
          description?: string | null
          due_date: string
          id?: string
          priority?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string
          category?: string
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string
          id?: string
          priority?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      usuarios: {
        Row: {
          collaborator_id: string | null
          created_at: string
          email: string
          id: string
          nome: string
          perfil: string
          status: string
        }
        Insert: {
          collaborator_id?: string | null
          created_at?: string
          email: string
          id: string
          nome: string
          perfil?: string
          status?: string
        }
        Update: {
          collaborator_id?: string | null
          created_at?: string
          email?: string
          id?: string
          nome?: string
          perfil?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
        ]
      }
      vt_config: {
        Row: {
          id: string
          updated_at: string
          updated_by: string | null
          valor_passagem: number
        }
        Insert: {
          id?: string
          updated_at?: string
          updated_by?: string | null
          valor_passagem?: number
        }
        Update: {
          id?: string
          updated_at?: string
          updated_by?: string | null
          valor_passagem?: number
        }
        Relationships: []
      }
      vt_monthly: {
        Row: {
          collaborator_id: string
          created_at: string
          created_by: string | null
          custo_empresa: number | null
          desconto_folha: number | null
          id: string
          month: number
          recarga_integral: number | null
          recarga_necessaria: number | null
          saldo_cartao: number | null
          updated_at: string
          year: number
        }
        Insert: {
          collaborator_id: string
          created_at?: string
          created_by?: string | null
          custo_empresa?: number | null
          desconto_folha?: number | null
          id?: string
          month: number
          recarga_integral?: number | null
          recarga_necessaria?: number | null
          saldo_cartao?: number | null
          updated_at?: string
          year: number
        }
        Update: {
          collaborator_id?: string
          created_at?: string
          created_by?: string | null
          custo_empresa?: number | null
          desconto_folha?: number | null
          id?: string
          month?: number
          recarga_integral?: number | null
          recarga_necessaria?: number | null
          saldo_cartao?: number | null
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "vt_monthly_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auto_finalize_vacation_status: { Args: never; Returns: undefined }
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
