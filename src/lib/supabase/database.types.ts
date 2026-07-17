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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      agent_orchestration_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          failure_code: string | null
          id: string
          idempotency_key: string
          input_kind: string
          input_summary: Json
          locale: string
          outcome: string | null
          routed_intent: string | null
          source_message_id: string
          source_update_id: string
          started_at: string
          status: string
          telegram_account_id: string
          telegram_chat_id: number
          telegram_user_id: number
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          failure_code?: string | null
          id?: string
          idempotency_key: string
          input_kind: string
          input_summary?: Json
          locale: string
          outcome?: string | null
          routed_intent?: string | null
          source_message_id: string
          source_update_id: string
          started_at?: string
          status: string
          telegram_account_id: string
          telegram_chat_id: number
          telegram_user_id: number
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          failure_code?: string | null
          id?: string
          idempotency_key?: string
          input_kind?: string
          input_summary?: Json
          locale?: string
          outcome?: string | null
          routed_intent?: string | null
          source_message_id?: string
          source_update_id?: string
          started_at?: string
          status?: string
          telegram_account_id?: string
          telegram_chat_id?: number
          telegram_user_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_orchestration_runs_telegram_account_id_fkey"
            columns: ["telegram_account_id"]
            isOneToOne: false
            referencedRelation: "telegram_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_orchestration_steps: {
        Row: {
          completed_at: string | null
          created_at: string
          duration_ms: number | null
          error_code: string | null
          id: string
          intent: string
          provider: string | null
          run_id: string
          sequence: number
          started_at: string
          status: string
          step_key: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          id?: string
          intent: string
          provider?: string | null
          run_id: string
          sequence: number
          started_at?: string
          status: string
          step_key: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          id?: string
          intent?: string
          provider?: string | null
          run_id?: string
          sequence?: number
          started_at?: string
          status?: string
          step_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_orchestration_steps_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "agent_orchestration_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_user_id: string | null
          after_summary: Json | null
          before_summary: Json | null
          business_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
          request_id: string | null
          source: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          after_summary?: Json | null
          before_summary?: Json | null
          business_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
          request_id?: string | null
          source?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          after_summary?: Json | null
          before_summary?: Json | null
          business_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
          request_id?: string | null
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_addresses: {
        Row: {
          address_type: string
          business_id: string
          city: string
          country_code: string
          created_at: string
          id: string
          is_primary: boolean
          line1: string
          line2: string | null
          line3: string | null
          postal_code: string | null
          state_code: string | null
          updated_at: string
        }
        Insert: {
          address_type?: string
          business_id: string
          city: string
          country_code?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          line1: string
          line2?: string | null
          line3?: string | null
          postal_code?: string | null
          state_code?: string | null
          updated_at?: string
        }
        Update: {
          address_type?: string
          business_id?: string
          city?: string
          country_code?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          line1?: string
          line2?: string | null
          line3?: string | null
          postal_code?: string | null
          state_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_addresses_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_contacts: {
        Row: {
          business_id: string
          contact_type: string
          created_at: string
          id: string
          is_primary: boolean
          label: string | null
          updated_at: string
          value: string
        }
        Insert: {
          business_id: string
          contact_type: string
          created_at?: string
          id?: string
          is_primary?: boolean
          label?: string | null
          updated_at?: string
          value: string
        }
        Update: {
          business_id?: string
          contact_type?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          label?: string | null
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_contacts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_members: {
        Row: {
          accepted_at: string | null
          business_id: string
          created_at: string
          invited_at: string | null
          invited_by: string | null
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          business_id: string
          created_at?: string
          invited_at?: string | null
          invited_by?: string | null
          role: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          business_id?: string
          created_at?: string
          invited_at?: string | null
          invited_by?: string | null
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      business_registration_identifiers: {
        Row: {
          business_id: string
          created_at: string
          description: string | null
          id: string
          is_primary: boolean
          issuing_country_code: string | null
          scheme: string
          updated_at: string
          value: string
        }
        Insert: {
          business_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_primary?: boolean
          issuing_country_code?: string | null
          scheme: string
          updated_at?: string
          value: string
        }
        Update: {
          business_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_primary?: boolean
          issuing_country_code?: string | null
          scheme?: string
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_registration_identifiers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_settings: {
        Row: {
          business_id: string
          created_at: string
          default_payment_terms_days: number
          invoice_number_next: number
          invoice_number_prefix: string
          settings: Json
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          default_payment_terms_days?: number
          invoice_number_next?: number
          invoice_number_prefix?: string
          settings?: Json
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          default_payment_terms_days?: number
          invoice_number_next?: number
          invoice_number_prefix?: string
          settings?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_settings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_tax_identifiers: {
        Row: {
          business_id: string
          created_at: string
          description: string | null
          id: string
          is_primary: boolean
          issuing_country_code: string | null
          scheme: string
          updated_at: string
          value: string
        }
        Insert: {
          business_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_primary?: boolean
          issuing_country_code?: string | null
          scheme: string
          updated_at?: string
          value: string
        }
        Update: {
          business_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_primary?: boolean
          issuing_country_code?: string | null
          scheme?: string
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_tax_identifiers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          business_activity_description: string | null
          created_at: string
          created_by: string | null
          default_currency: string
          entity_type: string
          id: string
          legal_name: string
          msic_code: string | null
          owner_user_id: string
          preferred_language: string
          timezone: string
          trading_name: string | null
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          business_activity_description?: string | null
          created_at?: string
          created_by?: string | null
          default_currency?: string
          entity_type: string
          id?: string
          legal_name: string
          msic_code?: string | null
          owner_user_id: string
          preferred_language?: string
          timezone?: string
          trading_name?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          business_activity_description?: string | null
          created_at?: string
          created_by?: string | null
          default_currency?: string
          entity_type?: string
          id?: string
          legal_name?: string
          msic_code?: string | null
          owner_user_id?: string
          preferred_language?: string
          timezone?: string
          trading_name?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "businesses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "businesses_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "businesses_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      data_import_batches: {
        Row: {
          business_id: string
          completed_at: string | null
          created_at: string
          id: string
          requested_by: string | null
          source_batch_id: string
          source_kind: string
          status: string
          summary: Json
        }
        Insert: {
          business_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          requested_by?: string | null
          source_batch_id: string
          source_kind: string
          status: string
          summary?: Json
        }
        Update: {
          business_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          requested_by?: string | null
          source_batch_id?: string
          source_kind?: string
          status?: string
          summary?: Json
        }
        Relationships: [
          {
            foreignKeyName: "data_import_batches_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_import_batches_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      e_invoice_cancellation_requests: {
        Row: {
          business_id: string
          completed_at: string | null
          e_invoice_document_id: string
          error_summary: string | null
          id: string
          reason: string
          requested_at: string
          requested_by: string
          status: string
          submission_id: string
        }
        Insert: {
          business_id: string
          completed_at?: string | null
          e_invoice_document_id: string
          error_summary?: string | null
          id?: string
          reason: string
          requested_at: string
          requested_by: string
          status: string
          submission_id: string
        }
        Update: {
          business_id?: string
          completed_at?: string | null
          e_invoice_document_id?: string
          error_summary?: string | null
          id?: string
          reason?: string
          requested_at?: string
          requested_by?: string
          status?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "e_invoice_cancellation_requests_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "e_invoice_cancellation_requests_e_invoice_document_id_fkey"
            columns: ["e_invoice_document_id"]
            isOneToOne: false
            referencedRelation: "e_invoice_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "e_invoice_cancellation_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "e_invoice_cancellation_requests_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "e_invoice_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      e_invoice_documents: {
        Row: {
          active: boolean
          approved_at: string | null
          approved_by: string | null
          business_id: string
          buyer_snapshot: Json
          canonical_document: Json | null
          created_at: string
          document_type: string
          document_version: string
          id: string
          provenance: Json
          readiness_result: Json
          revision: number
          scenario: string
          source_invoice_id: string
          source_invoice_revision: number
          status: string
          submission_eligible: boolean
          supersedes_document_id: string | null
          supplemental_fields: Json
          supplier_snapshot: Json
          updated_at: string
        }
        Insert: {
          active?: boolean
          approved_at?: string | null
          approved_by?: string | null
          business_id: string
          buyer_snapshot: Json
          canonical_document?: Json | null
          created_at?: string
          document_type: string
          document_version?: string
          id?: string
          provenance?: Json
          readiness_result: Json
          revision?: number
          scenario: string
          source_invoice_id: string
          source_invoice_revision: number
          status: string
          submission_eligible?: boolean
          supersedes_document_id?: string | null
          supplemental_fields?: Json
          supplier_snapshot: Json
          updated_at?: string
        }
        Update: {
          active?: boolean
          approved_at?: string | null
          approved_by?: string | null
          business_id?: string
          buyer_snapshot?: Json
          canonical_document?: Json | null
          created_at?: string
          document_type?: string
          document_version?: string
          id?: string
          provenance?: Json
          readiness_result?: Json
          revision?: number
          scenario?: string
          source_invoice_id?: string
          source_invoice_revision?: number
          status?: string
          submission_eligible?: boolean
          supersedes_document_id?: string | null
          supplemental_fields?: Json
          supplier_snapshot?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "e_invoice_documents_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "e_invoice_documents_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "e_invoice_documents_source_invoice_id_fkey"
            columns: ["source_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "e_invoice_documents_supersedes_document_id_fkey"
            columns: ["supersedes_document_id"]
            isOneToOne: false
            referencedRelation: "e_invoice_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      e_invoice_operation_events: {
        Row: {
          action: string
          actor_id: string | null
          business_id: string
          correlation_id: string | null
          details: Json
          environment: string
          id: string
          occurred_at: string
          outcome: string
          reason: string | null
          target_id: string
          target_type: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          business_id: string
          correlation_id?: string | null
          details?: Json
          environment: string
          id?: string
          occurred_at?: string
          outcome: string
          reason?: string | null
          target_id: string
          target_type: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          business_id?: string
          correlation_id?: string | null
          details?: Json
          environment?: string
          id?: string
          occurred_at?: string
          outcome?: string
          reason?: string | null
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "e_invoice_operation_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "e_invoice_operation_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      e_invoice_payload_snapshots: {
        Row: {
          business_id: string
          document_revision: number
          document_version: string
          e_invoice_document_id: string
          format: string
          generated_at: string
          id: string
          mapper_version: string
          payload_size_bytes: number
          reference_data_version: string
          unsigned_payload: string
          unsigned_payload_hash: string
        }
        Insert: {
          business_id: string
          document_revision: number
          document_version: string
          e_invoice_document_id: string
          format: string
          generated_at: string
          id?: string
          mapper_version: string
          payload_size_bytes: number
          reference_data_version: string
          unsigned_payload: string
          unsigned_payload_hash: string
        }
        Update: {
          business_id?: string
          document_revision?: number
          document_version?: string
          e_invoice_document_id?: string
          format?: string
          generated_at?: string
          id?: string
          mapper_version?: string
          payload_size_bytes?: number
          reference_data_version?: string
          unsigned_payload?: string
          unsigned_payload_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "e_invoice_payload_snapshots_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "e_invoice_payload_snapshots_e_invoice_document_id_fkey"
            columns: ["e_invoice_document_id"]
            isOneToOne: false
            referencedRelation: "e_invoice_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      e_invoice_rate_limit_buckets: {
        Row: {
          credential_set_id: string
          endpoint: string
          environment: string
          request_count: number
          window_started_at: string
        }
        Insert: {
          credential_set_id: string
          endpoint: string
          environment: string
          request_count: number
          window_started_at: string
        }
        Update: {
          credential_set_id?: string
          endpoint?: string
          environment?: string
          request_count?: number
          window_started_at?: string
        }
        Relationships: []
      }
      e_invoice_signed_snapshots: {
        Row: {
          business_id: string
          certificate_issuer: string
          certificate_not_after: string
          certificate_serial_number: string
          certificate_subject: string
          certificate_thumbprint: string
          connection_id: string
          created_at: string
          environment: string
          id: string
          implementation_version: string
          signed_payload: string
          signed_payload_hash: string
          signing_algorithm: string
          signing_timestamp: string
          unsigned_payload_hash: string
          unsigned_snapshot_id: string
        }
        Insert: {
          business_id: string
          certificate_issuer: string
          certificate_not_after: string
          certificate_serial_number: string
          certificate_subject: string
          certificate_thumbprint: string
          connection_id: string
          created_at?: string
          environment: string
          id?: string
          implementation_version: string
          signed_payload: string
          signed_payload_hash: string
          signing_algorithm: string
          signing_timestamp: string
          unsigned_payload_hash: string
          unsigned_snapshot_id: string
        }
        Update: {
          business_id?: string
          certificate_issuer?: string
          certificate_not_after?: string
          certificate_serial_number?: string
          certificate_subject?: string
          certificate_thumbprint?: string
          connection_id?: string
          created_at?: string
          environment?: string
          id?: string
          implementation_version?: string
          signed_payload?: string
          signed_payload_hash?: string
          signing_algorithm?: string
          signing_timestamp?: string
          unsigned_payload_hash?: string
          unsigned_snapshot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "e_invoice_signed_snapshots_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "e_invoice_signed_snapshots_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "myinvois_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "e_invoice_signed_snapshots_unsigned_snapshot_id_fkey"
            columns: ["unsigned_snapshot_id"]
            isOneToOne: false
            referencedRelation: "e_invoice_payload_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      e_invoice_status_events: {
        Row: {
          business_id: string
          created_at: string
          details: Json
          e_invoice_document_id: string
          id: string
          occurred_at: string
          source: string
          status: string
          submission_id: string
          validation_result: Json | null
        }
        Insert: {
          business_id: string
          created_at?: string
          details?: Json
          e_invoice_document_id: string
          id?: string
          occurred_at: string
          source: string
          status: string
          submission_id: string
          validation_result?: Json | null
        }
        Update: {
          business_id?: string
          created_at?: string
          details?: Json
          e_invoice_document_id?: string
          id?: string
          occurred_at?: string
          source?: string
          status?: string
          submission_id?: string
          validation_result?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "e_invoice_status_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "e_invoice_status_events_e_invoice_document_id_fkey"
            columns: ["e_invoice_document_id"]
            isOneToOne: false
            referencedRelation: "e_invoice_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "e_invoice_status_events_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "e_invoice_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      e_invoice_submission_documents: {
        Row: {
          accepted: boolean | null
          cancellation_eligible_until: string | null
          created_at: string
          e_invoice_document_id: string
          invoice_code_number: string
          long_id: string | null
          myinvois_uuid: string | null
          payload_snapshot_id: string
          rejection_error: Json | null
          share_url: string | null
          status: string
          submission_id: string
          validation_result: Json | null
        }
        Insert: {
          accepted?: boolean | null
          cancellation_eligible_until?: string | null
          created_at?: string
          e_invoice_document_id: string
          invoice_code_number: string
          long_id?: string | null
          myinvois_uuid?: string | null
          payload_snapshot_id: string
          rejection_error?: Json | null
          share_url?: string | null
          status: string
          submission_id: string
          validation_result?: Json | null
        }
        Update: {
          accepted?: boolean | null
          cancellation_eligible_until?: string | null
          created_at?: string
          e_invoice_document_id?: string
          invoice_code_number?: string
          long_id?: string | null
          myinvois_uuid?: string | null
          payload_snapshot_id?: string
          rejection_error?: Json | null
          share_url?: string | null
          status?: string
          submission_id?: string
          validation_result?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "e_invoice_submission_documents_e_invoice_document_id_fkey"
            columns: ["e_invoice_document_id"]
            isOneToOne: false
            referencedRelation: "e_invoice_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "e_invoice_submission_documents_payload_snapshot_id_fkey"
            columns: ["payload_snapshot_id"]
            isOneToOne: false
            referencedRelation: "e_invoice_payload_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "e_invoice_submission_documents_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "e_invoice_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      e_invoice_submissions: {
        Row: {
          business_id: string
          correlation_id: string | null
          created_at: string
          dead_letter_reason: string | null
          dead_lettered_at: string | null
          environment: string
          error_code: string | null
          error_message: string | null
          http_status: number | null
          id: string
          idempotency_key: string
          last_attempt_at: string | null
          lease_expires_at: string | null
          lease_owner: string | null
          raw_response: Json | null
          request_hash: string
          requested_at: string
          responded_at: string | null
          retry_after: string | null
          retry_count: number
          status: string
          submission_uid: string | null
          worker_failure_count: number
        }
        Insert: {
          business_id: string
          correlation_id?: string | null
          created_at?: string
          dead_letter_reason?: string | null
          dead_lettered_at?: string | null
          environment: string
          error_code?: string | null
          error_message?: string | null
          http_status?: number | null
          id?: string
          idempotency_key: string
          last_attempt_at?: string | null
          lease_expires_at?: string | null
          lease_owner?: string | null
          raw_response?: Json | null
          request_hash: string
          requested_at: string
          responded_at?: string | null
          retry_after?: string | null
          retry_count?: number
          status: string
          submission_uid?: string | null
          worker_failure_count?: number
        }
        Update: {
          business_id?: string
          correlation_id?: string | null
          created_at?: string
          dead_letter_reason?: string | null
          dead_lettered_at?: string | null
          environment?: string
          error_code?: string | null
          error_message?: string | null
          http_status?: number | null
          id?: string
          idempotency_key?: string
          last_attempt_at?: string | null
          lease_expires_at?: string | null
          lease_owner?: string | null
          raw_response?: Json | null
          request_hash?: string
          requested_at?: string
          responded_at?: string | null
          retry_after?: string | null
          retry_count?: number
          status?: string
          submission_uid?: string | null
          worker_failure_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "e_invoice_submissions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      einvoice_submissions: {
        Row: {
          attempt_number: number
          completed_at: string | null
          created_at: string
          environment: string
          error_summary: string | null
          id: string
          invoice_id: string
          long_id: string | null
          myinvois_uuid: string | null
          response_payload: Json | null
          status: string
          submitted_at: string | null
        }
        Insert: {
          attempt_number: number
          completed_at?: string | null
          created_at?: string
          environment: string
          error_summary?: string | null
          id?: string
          invoice_id: string
          long_id?: string | null
          myinvois_uuid?: string | null
          response_payload?: Json | null
          status: string
          submitted_at?: string | null
        }
        Update: {
          attempt_number?: number
          completed_at?: string | null
          created_at?: string
          environment?: string
          error_summary?: string | null
          id?: string
          invoice_id?: string
          long_id?: string | null
          myinvois_uuid?: string | null
          response_payload?: Json | null
          status?: string
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "einvoice_submissions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      einvoice_validation_results: {
        Row: {
          code: string
          created_at: string
          field_path: string | null
          id: string
          invoice_id: string
          message: string
          severity: string
          source: string
          submission_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          field_path?: string | null
          id?: string
          invoice_id: string
          message: string
          severity: string
          source: string
          submission_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          field_path?: string | null
          id?: string
          invoice_id?: string
          message?: string
          severity?: string
          source?: string
          submission_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "einvoice_validation_results_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "einvoice_validation_results_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "einvoice_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_files: {
        Row: {
          business_id: string
          captured_at: string
          checksum_sha256: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deletion_requested_at: string | null
          deletion_requested_by: string | null
          failure_reason: string | null
          id: string
          mime_type: string | null
          original_filename: string | null
          processing_status: string
          raw_text: string | null
          retention_delete_after: string | null
          size_bytes: number | null
          source_message_reference: string | null
          source_type: string
          storage_bucket: string | null
          storage_deleted_at: string | null
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          captured_at?: string
          checksum_sha256?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deletion_requested_at?: string | null
          deletion_requested_by?: string | null
          failure_reason?: string | null
          id?: string
          mime_type?: string | null
          original_filename?: string | null
          processing_status?: string
          raw_text?: string | null
          retention_delete_after?: string | null
          size_bytes?: number | null
          source_message_reference?: string | null
          source_type: string
          storage_bucket?: string | null
          storage_deleted_at?: string | null
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          captured_at?: string
          checksum_sha256?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deletion_requested_at?: string | null
          deletion_requested_by?: string | null
          failure_reason?: string | null
          id?: string
          mime_type?: string | null
          original_filename?: string | null
          processing_status?: string
          raw_text?: string | null
          retention_delete_after?: string | null
          size_bytes?: number | null
          source_message_reference?: string | null
          source_type?: string
          storage_bucket?: string | null
          storage_deleted_at?: string | null
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_files_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_files_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_files_deletion_requested_by_fkey"
            columns: ["deletion_requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      extraction_field_results: {
        Row: {
          confidence: number | null
          evidence: Json
          extracted_value: Json | null
          extraction_run_id: string
          field_path: string
          id: string
          reviewed_value: Json | null
          status: string
        }
        Insert: {
          confidence?: number | null
          evidence?: Json
          extracted_value?: Json | null
          extraction_run_id: string
          field_path: string
          id?: string
          reviewed_value?: Json | null
          status?: string
        }
        Update: {
          confidence?: number | null
          evidence?: Json
          extracted_value?: Json | null
          extraction_run_id?: string
          field_path?: string
          id?: string
          reviewed_value?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "extraction_field_results_extraction_run_id_fkey"
            columns: ["extraction_run_id"]
            isOneToOne: false
            referencedRelation: "extraction_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      extraction_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          evidence_file_id: string
          failure_reason: string | null
          id: string
          model_name: string
          overall_confidence: number | null
          pipeline_version: string
          provider: string
          raw_provider_result: Json
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_notes: string | null
          started_at: string
          status: string
          structured_output: Json | null
          superseded_by_run_id: string | null
          updated_at: string
          warnings: Json
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          evidence_file_id: string
          failure_reason?: string | null
          id?: string
          model_name: string
          overall_confidence?: number | null
          pipeline_version: string
          provider: string
          raw_provider_result?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          started_at?: string
          status: string
          structured_output?: Json | null
          superseded_by_run_id?: string | null
          updated_at?: string
          warnings?: Json
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          evidence_file_id?: string
          failure_reason?: string | null
          id?: string
          model_name?: string
          overall_confidence?: number | null
          pipeline_version?: string
          provider?: string
          raw_provider_result?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          started_at?: string
          status?: string
          structured_output?: Json | null
          superseded_by_run_id?: string | null
          updated_at?: string
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "extraction_runs_evidence_file_id_fkey"
            columns: ["evidence_file_id"]
            isOneToOne: false
            referencedRelation: "evidence_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extraction_runs_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extraction_runs_superseded_by_run_id_fkey"
            columns: ["superseded_by_run_id"]
            isOneToOne: false
            referencedRelation: "extraction_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      idempotency_keys: {
        Row: {
          business_id: string
          created_at: string
          expires_at: string
          id: string
          key: string
          operation: string
          request_hash: string | null
          response_body: Json | null
          response_status: number | null
        }
        Insert: {
          business_id: string
          created_at?: string
          expires_at: string
          id?: string
          key: string
          operation: string
          request_hash?: string | null
          response_body?: Json | null
          response_status?: number | null
        }
        Update: {
          business_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          key?: string
          operation?: string
          request_hash?: string | null
          response_body?: Json | null
          response_status?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "idempotency_keys_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_events: {
        Row: {
          aggregate_id: string
          aggregate_type: string
          attempts: number
          available_at: string
          business_id: string
          created_at: string
          event_type: string
          id: string
          last_error: string | null
          payload: Json
          processed_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          aggregate_id: string
          aggregate_type: string
          attempts?: number
          available_at?: string
          business_id: string
          created_at?: string
          event_type: string
          id?: string
          last_error?: string | null
          payload: Json
          processed_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          aggregate_id?: string
          aggregate_type?: string
          attempts?: number
          available_at?: string
          business_id?: string
          created_at?: string
          event_type?: string
          id?: string
          last_error?: string | null
          payload?: Json
          processed_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          charge_minor: number
          classification_code: string | null
          country_of_origin: string | null
          description: string
          discount_minor: number
          exemption_reason: string | null
          id: string
          invoice_id: string
          item_metadata: Json
          line_number: number
          product_service_id: string | null
          quantity: number
          subtotal_minor: number
          tariff_code: string | null
          tax_minor: number
          tax_rate: number
          tax_type_code: string
          total_minor: number
          unit_code: string | null
          unit_price_minor: number
        }
        Insert: {
          charge_minor?: number
          classification_code?: string | null
          country_of_origin?: string | null
          description: string
          discount_minor?: number
          exemption_reason?: string | null
          id?: string
          invoice_id: string
          item_metadata?: Json
          line_number: number
          product_service_id?: string | null
          quantity: number
          subtotal_minor: number
          tariff_code?: string | null
          tax_minor?: number
          tax_rate: number
          tax_type_code: string
          total_minor: number
          unit_code?: string | null
          unit_price_minor: number
        }
        Update: {
          charge_minor?: number
          classification_code?: string | null
          country_of_origin?: string | null
          description?: string
          discount_minor?: number
          exemption_reason?: string | null
          id?: string
          invoice_id?: string
          item_metadata?: Json
          line_number?: number
          product_service_id?: string | null
          quantity?: number
          subtotal_minor?: number
          tariff_code?: string | null
          tax_minor?: number
          tax_rate?: number
          tax_type_code?: string
          total_minor?: number
          unit_code?: string | null
          unit_price_minor?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_product_service_id_fkey"
            columns: ["product_service_id"]
            isOneToOne: false
            referencedRelation: "products_services"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payment_reversals: {
        Row: {
          amount_minor: number
          id: string
          invoice_payment_id: string
          reason: string
          reversed_at: string
          reversed_by: string | null
        }
        Insert: {
          amount_minor: number
          id?: string
          invoice_payment_id: string
          reason: string
          reversed_at?: string
          reversed_by?: string | null
        }
        Update: {
          amount_minor?: number
          id?: string
          invoice_payment_id?: string
          reason?: string
          reversed_at?: string
          reversed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payment_reversals_invoice_payment_id_fkey"
            columns: ["invoice_payment_id"]
            isOneToOne: false
            referencedRelation: "invoice_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payment_reversals_reversed_by_fkey"
            columns: ["reversed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payments: {
        Row: {
          amount_minor: number
          created_at: string
          currency: string
          external_reference: string | null
          id: string
          invoice_id: string
          notes: string | null
          paid_at: string
          payment_method_code: string | null
          transaction_id: string | null
        }
        Insert: {
          amount_minor: number
          created_at?: string
          currency: string
          external_reference?: string | null
          id?: string
          invoice_id: string
          notes?: string | null
          paid_at: string
          payment_method_code?: string | null
          transaction_id?: string | null
        }
        Update: {
          amount_minor?: number
          created_at?: string
          currency?: string
          external_reference?: string | null
          id?: string
          invoice_id?: string
          notes?: string | null
          paid_at?: string
          payment_method_code?: string | null
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_sequences: {
        Row: {
          business_id: string
          fiscal_period: string
          next_value: number
          prefix: string
        }
        Insert: {
          business_id: string
          fiscal_period?: string
          next_value?: number
          prefix?: string
        }
        Update: {
          business_id?: string
          fiscal_period?: string
          next_value?: number
          prefix?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_sequences_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: string | null
          id: string
          invoice_id: string
          reason: string | null
          to_status: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          invoice_id: string
          reason?: string | null
          to_status: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          invoice_id?: string
          reason?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_status_history_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid_minor: number
          bank_account_identifier: string | null
          billing_period_end: string | null
          billing_period_start: string | null
          business_id: string
          charge_minor: number
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string | null
          customer_snapshot: Json
          discount_minor: number
          document_allowances: Json
          document_charges: Json
          document_references: Json
          document_type: string
          due_date: string | null
          exchange_rate: number | null
          id: string
          invoice_number: string
          invoice_purpose: string | null
          issue_date: string
          issue_time: string | null
          issued_at: string | null
          notes: string | null
          payment_mode_code: string | null
          payment_reference: string | null
          payment_terms: string | null
          prepaid_minor: number
          prepayment_date: string | null
          prepayment_reference: string | null
          prepayment_time: string | null
          rounding_minor: number
          shipping_recipient_party_id: string | null
          status: string
          subtotal_minor: number
          supplemental_fields: Json
          supplier_snapshot: Json
          tax_currency: string | null
          tax_minor: number
          total_minor: number
          updated_at: string
          updated_by: string | null
          version: number
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount_paid_minor?: number
          bank_account_identifier?: string | null
          billing_period_end?: string | null
          billing_period_start?: string | null
          business_id: string
          charge_minor?: number
          created_at?: string
          created_by?: string | null
          currency: string
          customer_id?: string | null
          customer_snapshot?: Json
          discount_minor?: number
          document_allowances?: Json
          document_charges?: Json
          document_references?: Json
          document_type?: string
          due_date?: string | null
          exchange_rate?: number | null
          id?: string
          invoice_number: string
          invoice_purpose?: string | null
          issue_date: string
          issue_time?: string | null
          issued_at?: string | null
          notes?: string | null
          payment_mode_code?: string | null
          payment_reference?: string | null
          payment_terms?: string | null
          prepaid_minor?: number
          prepayment_date?: string | null
          prepayment_reference?: string | null
          prepayment_time?: string | null
          rounding_minor?: number
          shipping_recipient_party_id?: string | null
          status: string
          subtotal_minor: number
          supplemental_fields?: Json
          supplier_snapshot?: Json
          tax_currency?: string | null
          tax_minor?: number
          total_minor: number
          updated_at?: string
          updated_by?: string | null
          version?: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount_paid_minor?: number
          bank_account_identifier?: string | null
          billing_period_end?: string | null
          billing_period_start?: string | null
          business_id?: string
          charge_minor?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          customer_snapshot?: Json
          discount_minor?: number
          document_allowances?: Json
          document_charges?: Json
          document_references?: Json
          document_type?: string
          due_date?: string | null
          exchange_rate?: number | null
          id?: string
          invoice_number?: string
          invoice_purpose?: string | null
          issue_date?: string
          issue_time?: string | null
          issued_at?: string | null
          notes?: string | null
          payment_mode_code?: string | null
          payment_reference?: string | null
          payment_terms?: string | null
          prepaid_minor?: number
          prepayment_date?: string | null
          prepayment_reference?: string | null
          prepayment_time?: string | null
          rounding_minor?: number
          shipping_recipient_party_id?: string | null
          status?: string
          subtotal_minor?: number
          supplemental_fields?: Json
          supplier_snapshot?: Json
          tax_currency?: string | null
          tax_minor?: number
          total_minor?: number
          updated_at?: string
          updated_by?: string | null
          version?: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_shipping_recipient_party_id_fkey"
            columns: ["shipping_recipient_party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      myinvois_connections: {
        Row: {
          auth_mode: string
          business_id: string
          certificate_issuer: string | null
          certificate_not_after: string | null
          certificate_not_before: string | null
          certificate_serial_number: string | null
          certificate_subject: string | null
          certificate_thumbprint: string | null
          client_id_secret_ref: string
          client_secret_secret_ref: string
          created_at: string
          credential_set_id: string
          document_version: string
          enabled: boolean
          environment: string
          id: string
          onbehalfof_value: string | null
          production_activated_at: string | null
          production_activated_by: string | null
          production_activation_reason: string | null
          production_disabled_at: string | null
          production_disabled_by: string | null
          sandbox_verified_at: string | null
          sandbox_verified_by: string | null
          signing_certificate_chain_secret_ref: string | null
          signing_certificate_secret_ref: string | null
          signing_key_passphrase_secret_ref: string | null
          signing_private_key_secret_ref: string | null
          taxpayer_registration_scheme: string | null
          taxpayer_registration_value: string | null
          taxpayer_tin: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          auth_mode: string
          business_id: string
          certificate_issuer?: string | null
          certificate_not_after?: string | null
          certificate_not_before?: string | null
          certificate_serial_number?: string | null
          certificate_subject?: string | null
          certificate_thumbprint?: string | null
          client_id_secret_ref: string
          client_secret_secret_ref: string
          created_at?: string
          credential_set_id: string
          document_version?: string
          enabled?: boolean
          environment: string
          id?: string
          onbehalfof_value?: string | null
          production_activated_at?: string | null
          production_activated_by?: string | null
          production_activation_reason?: string | null
          production_disabled_at?: string | null
          production_disabled_by?: string | null
          sandbox_verified_at?: string | null
          sandbox_verified_by?: string | null
          signing_certificate_chain_secret_ref?: string | null
          signing_certificate_secret_ref?: string | null
          signing_key_passphrase_secret_ref?: string | null
          signing_private_key_secret_ref?: string | null
          taxpayer_registration_scheme?: string | null
          taxpayer_registration_value?: string | null
          taxpayer_tin: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          auth_mode?: string
          business_id?: string
          certificate_issuer?: string | null
          certificate_not_after?: string | null
          certificate_not_before?: string | null
          certificate_serial_number?: string | null
          certificate_subject?: string | null
          certificate_thumbprint?: string | null
          client_id_secret_ref?: string
          client_secret_secret_ref?: string
          created_at?: string
          credential_set_id?: string
          document_version?: string
          enabled?: boolean
          environment?: string
          id?: string
          onbehalfof_value?: string | null
          production_activated_at?: string | null
          production_activated_by?: string | null
          production_activation_reason?: string | null
          production_disabled_at?: string | null
          production_disabled_by?: string | null
          sandbox_verified_at?: string | null
          sandbox_verified_by?: string | null
          signing_certificate_chain_secret_ref?: string | null
          signing_certificate_secret_ref?: string | null
          signing_key_passphrase_secret_ref?: string | null
          signing_private_key_secret_ref?: string | null
          taxpayer_registration_scheme?: string | null
          taxpayer_registration_value?: string | null
          taxpayer_tin?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "myinvois_connections_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "myinvois_connections_production_activated_by_fkey"
            columns: ["production_activated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "myinvois_connections_production_disabled_by_fkey"
            columns: ["production_disabled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "myinvois_connections_sandbox_verified_by_fkey"
            columns: ["sandbox_verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "myinvois_connections_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      parties: {
        Row: {
          business_id: string
          created_at: string
          created_by: string | null
          default_currency: string | null
          default_payment_terms_days: number | null
          email: string | null
          id: string
          kind: string
          legal_name: string
          phone: string | null
          roles: string[]
          trading_name: string | null
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          business_id: string
          created_at?: string
          created_by?: string | null
          default_currency?: string | null
          default_payment_terms_days?: number | null
          email?: string | null
          id?: string
          kind: string
          legal_name: string
          phone?: string | null
          roles: string[]
          trading_name?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          business_id?: string
          created_at?: string
          created_by?: string | null
          default_currency?: string | null
          default_payment_terms_days?: number | null
          email?: string | null
          id?: string
          kind?: string
          legal_name?: string
          phone?: string | null
          roles?: string[]
          trading_name?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "parties_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parties_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parties_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      party_addresses: {
        Row: {
          address_type: string
          city: string
          country_code: string
          created_at: string
          id: string
          is_primary: boolean
          line1: string
          line2: string | null
          line3: string | null
          party_id: string
          postal_code: string | null
          state_code: string | null
          updated_at: string
        }
        Insert: {
          address_type: string
          city: string
          country_code?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          line1: string
          line2?: string | null
          line3?: string | null
          party_id: string
          postal_code?: string | null
          state_code?: string | null
          updated_at?: string
        }
        Update: {
          address_type?: string
          city?: string
          country_code?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          line1?: string
          line2?: string | null
          line3?: string | null
          party_id?: string
          postal_code?: string | null
          state_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_addresses_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      party_registration_identifiers: {
        Row: {
          description: string | null
          id: string
          issuing_country_code: string | null
          party_id: string
          scheme: string
          value: string
        }
        Insert: {
          description?: string | null
          id?: string
          issuing_country_code?: string | null
          party_id: string
          scheme: string
          value: string
        }
        Update: {
          description?: string | null
          id?: string
          issuing_country_code?: string | null
          party_id?: string
          scheme?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_registration_identifiers_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      party_tax_identifiers: {
        Row: {
          description: string | null
          id: string
          issuing_country_code: string | null
          party_id: string
          scheme: string
          value: string
        }
        Insert: {
          description?: string | null
          id?: string
          issuing_country_code?: string | null
          party_id: string
          scheme: string
          value: string
        }
        Update: {
          description?: string | null
          id?: string
          issuing_country_code?: string | null
          party_id?: string
          scheme?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_tax_identifiers_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_reminders: {
        Row: {
          business_id: string
          channel: string
          created_at: string
          id: string
          idempotency_key: string | null
          invoice_id: string | null
          message_snapshot: string
          recipient_party_id: string | null
          scheduled_for: string
          status: string
          updated_at: string
        }
        Insert: {
          business_id: string
          channel: string
          created_at?: string
          id?: string
          idempotency_key?: string | null
          invoice_id?: string | null
          message_snapshot: string
          recipient_party_id?: string | null
          scheduled_for: string
          status?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          channel?: string
          created_at?: string
          id?: string
          idempotency_key?: string | null
          invoice_id?: string | null
          message_snapshot?: string
          recipient_party_id?: string | null
          scheduled_for?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_reminders_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reminders_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reminders_recipient_party_id_fkey"
            columns: ["recipient_party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      products_services: {
        Row: {
          business_id: string
          classification_code: string | null
          created_at: string
          currency: string
          default_unit_price_minor: number | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          sku: string | null
          tax_rate: number | null
          tax_type_code: string | null
          unit_code: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          classification_code?: string | null
          created_at?: string
          currency?: string
          default_unit_price_minor?: number | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sku?: string | null
          tax_rate?: number | null
          tax_type_code?: string | null
          unit_code?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          classification_code?: string | null
          created_at?: string
          currency?: string
          default_unit_price_minor?: number | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sku?: string | null
          tax_rate?: number | null
          tax_type_code?: string | null
          unit_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_services_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          preferred_language: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          preferred_language?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          preferred_language?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      reminder_deliveries: {
        Row: {
          attempt_number: number
          attempted_at: string
          id: string
          provider_response: Json | null
          reminder_id: string
          status: string
        }
        Insert: {
          attempt_number: number
          attempted_at?: string
          id?: string
          provider_response?: Json | null
          reminder_id: string
          status: string
        }
        Update: {
          attempt_number?: number
          attempted_at?: string
          id?: string
          provider_response?: Json | null
          reminder_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminder_deliveries_reminder_id_fkey"
            columns: ["reminder_id"]
            isOneToOne: false
            referencedRelation: "payment_reminders"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          business_id: string
          color: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          business_id: string
          color?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          business_id?: string
          color?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_accounts: {
        Row: {
          business_id: string | null
          created_at: string
          id: string
          link_token_expires_at: string | null
          link_token_hash: string | null
          linked_at: string | null
          telegram_chat_id: number
          telegram_user_id: number
          unlinked_at: string | null
          updated_at: string
          user_id: string | null
          username: string | null
        }
        Insert: {
          business_id?: string | null
          created_at?: string
          id?: string
          link_token_expires_at?: string | null
          link_token_hash?: string | null
          linked_at?: string | null
          telegram_chat_id: number
          telegram_user_id: number
          unlinked_at?: string | null
          updated_at?: string
          user_id?: string | null
          username?: string | null
        }
        Update: {
          business_id?: string | null
          created_at?: string
          id?: string
          link_token_expires_at?: string | null
          link_token_hash?: string | null
          linked_at?: string | null
          telegram_chat_id?: number
          telegram_user_id?: number
          unlinked_at?: string | null
          updated_at?: string
          user_id?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telegram_accounts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telegram_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_conversation_states: {
        Row: {
          collected_values: Json
          created_at: string
          current_action_id: string | null
          draft: Json
          draft_id: string
          expires_at: string
          id: string
          inline_message_id: number | null
          mode: string
          requested_field: string | null
          telegram_account_id: string
          updated_at: string
          version: number
          workflow_id: string
          workflow_status: string
          workflow_type: string
          workflow_version: number
        }
        Insert: {
          collected_values?: Json
          created_at?: string
          current_action_id?: string | null
          draft: Json
          draft_id: string
          expires_at: string
          id?: string
          inline_message_id?: number | null
          mode: string
          requested_field?: string | null
          telegram_account_id: string
          updated_at?: string
          version?: number
          workflow_id: string
          workflow_status: string
          workflow_type: string
          workflow_version: number
        }
        Update: {
          collected_values?: Json
          created_at?: string
          current_action_id?: string | null
          draft?: Json
          draft_id?: string
          expires_at?: string
          id?: string
          inline_message_id?: number | null
          mode?: string
          requested_field?: string | null
          telegram_account_id?: string
          updated_at?: string
          version?: number
          workflow_id?: string
          workflow_status?: string
          workflow_type?: string
          workflow_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "telegram_conversation_states_telegram_account_id_fkey"
            columns: ["telegram_account_id"]
            isOneToOne: true
            referencedRelation: "telegram_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_link_codes: {
        Row: {
          business_id: string
          code_hash: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          business_id: string
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          business_id?: string
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_link_codes_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telegram_link_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_user_preferences: {
        Row: {
          created_at: string
          language: string
          preferences: Json
          telegram_account_id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          language?: string
          preferences?: Json
          telegram_account_id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          language?: string
          preferences?: Json
          telegram_account_id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_user_preferences_telegram_account_id_fkey"
            columns: ["telegram_account_id"]
            isOneToOne: true
            referencedRelation: "telegram_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_evidence_links: {
        Row: {
          evidence_file_id: string
          extraction_run_id: string | null
          notes: string | null
          relationship: string
          transaction_id: string
        }
        Insert: {
          evidence_file_id: string
          extraction_run_id?: string | null
          notes?: string | null
          relationship: string
          transaction_id: string
        }
        Update: {
          evidence_file_id?: string
          extraction_run_id?: string | null
          notes?: string | null
          relationship?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_evidence_links_evidence_file_id_fkey"
            columns: ["evidence_file_id"]
            isOneToOne: false
            referencedRelation: "evidence_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_evidence_links_extraction_run_id_fkey"
            columns: ["extraction_run_id"]
            isOneToOne: false
            referencedRelation: "extraction_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_evidence_links_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_line_items: {
        Row: {
          charge_minor: number
          classification_code: string | null
          country_of_origin: string | null
          description: string
          discount_minor: number
          id: string
          line_number: number
          product_service_id: string | null
          quantity: number
          subtotal_minor: number
          tariff_code: string | null
          tax_minor: number
          tax_rate: number
          tax_type_code: string
          total_minor: number
          transaction_id: string
          unit_code: string
          unit_price_minor: number
        }
        Insert: {
          charge_minor?: number
          classification_code?: string | null
          country_of_origin?: string | null
          description: string
          discount_minor?: number
          id?: string
          line_number: number
          product_service_id?: string | null
          quantity: number
          subtotal_minor: number
          tariff_code?: string | null
          tax_minor?: number
          tax_rate: number
          tax_type_code: string
          total_minor: number
          transaction_id: string
          unit_code: string
          unit_price_minor: number
        }
        Update: {
          charge_minor?: number
          classification_code?: string | null
          country_of_origin?: string | null
          description?: string
          discount_minor?: number
          id?: string
          line_number?: number
          product_service_id?: string | null
          quantity?: number
          subtotal_minor?: number
          tariff_code?: string | null
          tax_minor?: number
          tax_rate?: number
          tax_type_code?: string
          total_minor?: number
          transaction_id?: string
          unit_code?: string
          unit_price_minor?: number
        }
        Relationships: [
          {
            foreignKeyName: "transaction_line_items_product_service_id_fkey"
            columns: ["product_service_id"]
            isOneToOne: false
            referencedRelation: "products_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_line_items_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: string | null
          id: string
          reason: string | null
          to_status: string
          transaction_id: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          reason?: string | null
          to_status: string
          transaction_id: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          reason?: string | null
          to_status?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_status_history_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_tags: {
        Row: {
          tag_id: string
          transaction_id: string
        }
        Insert: {
          tag_id: string
          transaction_id: string
        }
        Update: {
          tag_id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_tags_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          accounting_date: string
          business_id: string
          category_code: string
          confidence_score: number | null
          confirmation: Json | null
          confirmation_notes: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          counterparty_id: string | null
          counterparty_name_snapshot: string | null
          created_at: string
          created_by: string | null
          currency: string
          description: string
          direction: string
          discount_minor: number
          e_invoice_treatment: string
          exchange_rate_to_myr: number | null
          external_key: string | null
          id: string
          lifecycle: string
          lines: Json
          notes: string | null
          occurred_at: string
          payment_method_code: string | null
          payment_status: string
          source_links: Json
          source_provenance: string
          subtotal_minor: number
          tax_minor: number
          total_minor: number
          totals: Json
          transaction_date: string
          transaction_type: string
          updated_at: string
          updated_by: string | null
          version: number
          void_metadata: Json | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          accounting_date: string
          business_id: string
          category_code: string
          confidence_score?: number | null
          confirmation?: Json | null
          confirmation_notes?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          counterparty_id?: string | null
          counterparty_name_snapshot?: string | null
          created_at?: string
          created_by?: string | null
          currency: string
          description: string
          direction: string
          discount_minor?: number
          e_invoice_treatment: string
          exchange_rate_to_myr?: number | null
          external_key?: string | null
          id?: string
          lifecycle: string
          lines?: Json
          notes?: string | null
          occurred_at?: string
          payment_method_code?: string | null
          payment_status: string
          source_links?: Json
          source_provenance?: string
          subtotal_minor?: number
          tax_minor?: number
          total_minor?: number
          totals?: Json
          transaction_date: string
          transaction_type?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
          void_metadata?: Json | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          accounting_date?: string
          business_id?: string
          category_code?: string
          confidence_score?: number | null
          confirmation?: Json | null
          confirmation_notes?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          counterparty_id?: string | null
          counterparty_name_snapshot?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string
          direction?: string
          discount_minor?: number
          e_invoice_treatment?: string
          exchange_rate_to_myr?: number | null
          external_key?: string | null
          id?: string
          lifecycle?: string
          lines?: Json
          notes?: string | null
          occurred_at?: string
          payment_method_code?: string | null
          payment_status?: string
          source_links?: Json
          source_provenance?: string
          subtotal_minor?: number
          tax_minor?: number
          total_minor?: number
          totals?: Json
          transaction_date?: string
          transaction_type?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
          void_metadata?: Json | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_counterparty_id_fkey"
            columns: ["counterparty_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_conversation_turns: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          turn_index: number
          updated_at: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          turn_index: number
          updated_at?: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          turn_index?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_conversation_turns_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "voice_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_conversations: {
        Row: {
          business_id: string
          created_at: string
          ended_at: string | null
          id: string
          provider_conversation_id: string
          retention_delete_after: string
          started_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          ended_at?: string | null
          id?: string
          provider_conversation_id: string
          retention_delete_after?: string
          started_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          provider_conversation_id?: string
          retention_delete_after?: string
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_conversations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_e_invoice_document: {
        Args: {
          p_business_id: string
          p_document_id: string
          p_expected_revision: number
          p_readiness_result: Json
        }
        Returns: {
          active: boolean
          approved_at: string | null
          approved_by: string | null
          business_id: string
          buyer_snapshot: Json
          canonical_document: Json | null
          created_at: string
          document_type: string
          document_version: string
          id: string
          provenance: Json
          readiness_result: Json
          revision: number
          scenario: string
          source_invoice_id: string
          source_invoice_revision: number
          status: string
          submission_eligible: boolean
          supersedes_document_id: string | null
          supplemental_fields: Json
          supplier_snapshot: Json
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "e_invoice_documents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      can_access_evidence_object: {
        Args: { p_object_name: string }
        Returns: boolean
      }
      can_delete_evidence_object: {
        Args: { p_object_name: string }
        Returns: boolean
      }
      can_manage_business: { Args: { p_business_id: string }; Returns: boolean }
      can_upload_evidence_object: {
        Args: { p_object_name: string }
        Returns: boolean
      }
      can_write_evidence: {
        Args: { p_evidence_file_id: string }
        Returns: boolean
      }
      can_write_invoice: { Args: { p_invoice_id: string }; Returns: boolean }
      can_write_party: { Args: { p_party_id: string }; Returns: boolean }
      can_write_reminder: { Args: { p_reminder_id: string }; Returns: boolean }
      can_write_transaction: {
        Args: { p_transaction_id: string }
        Returns: boolean
      }
      claim_due_e_invoice_submissions: {
        Args: {
          p_at: string
          p_lease_seconds?: number
          p_limit: number
          p_worker_id: string
        }
        Returns: {
          business_id: string
          correlation_id: string | null
          created_at: string
          dead_letter_reason: string | null
          dead_lettered_at: string | null
          environment: string
          error_code: string | null
          error_message: string | null
          http_status: number | null
          id: string
          idempotency_key: string
          last_attempt_at: string | null
          lease_expires_at: string | null
          lease_owner: string | null
          raw_response: Json | null
          request_hash: string
          requested_at: string
          responded_at: string | null
          retry_after: string | null
          retry_count: number
          status: string
          submission_uid: string | null
          worker_failure_count: number
        }[]
        SetofOptions: {
          from: "*"
          to: "e_invoice_submissions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_e_invoice_cancellation: {
        Args: {
          p_business_id: string
          p_document_id: string
          p_reason: string
          p_requested_at: string
          p_submission_id: string
        }
        Returns: boolean
      }
      claim_reminder_delivery: {
        Args: { p_reminder_id: string }
        Returns: boolean
      }
      complete_reminder_delivery: {
        Args: {
          p_provider_response?: Json
          p_reminder_id: string
          p_sent: boolean
        }
        Returns: undefined
      }
      confirm_telegram_transaction: {
        Args: {
          p_account_id: string
          p_draft_id: string
          p_idempotency_key: string
          p_transaction: Json
        }
        Returns: Json
      }
      consume_telegram_link_code: {
        Args: {
          p_code_hash: string
          p_is_private_chat: boolean
          p_telegram_chat_id: number
          p_telegram_user_id: number
          p_username: string
        }
        Returns: string
      }
      create_business: {
        Args: {
          p_business_activity_description?: string
          p_entity_type?: string
          p_legal_name: string
          p_msic_code?: string
          p_preferred_language?: string
          p_primary_address?: Json
          p_primary_email?: string
          p_primary_phone?: string
          p_registration_country_code?: string
          p_registration_scheme?: string
          p_registration_value?: string
          p_sst_registration?: string
          p_tin?: string
          p_tourism_tax_registration?: string
          p_trading_name?: string
        }
        Returns: {
          business_activity_description: string | null
          created_at: string
          created_by: string | null
          default_currency: string
          entity_type: string
          id: string
          legal_name: string
          msic_code: string | null
          owner_user_id: string
          preferred_language: string
          timezone: string
          trading_name: string | null
          updated_at: string
          updated_by: string | null
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "businesses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_e_invoice_pending_submission: {
        Args: {
          p_business_id: string
          p_documents: Json
          p_environment: string
          p_idempotency_key: string
          p_request_hash: string
          p_requested_at: string
        }
        Returns: Json
      }
      create_e_invoice_revision: {
        Args: { p_business_id: string; p_document_id: string }
        Returns: {
          active: boolean
          approved_at: string | null
          approved_by: string | null
          business_id: string
          buyer_snapshot: Json
          canonical_document: Json | null
          created_at: string
          document_type: string
          document_version: string
          id: string
          provenance: Json
          readiness_result: Json
          revision: number
          scenario: string
          source_invoice_id: string
          source_invoice_revision: number
          status: string
          submission_eligible: boolean
          supersedes_document_id: string | null
          supplemental_fields: Json
          supplier_snapshot: Json
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "e_invoice_documents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_timestamp_utc: { Args: never; Returns: string }
      fail_e_invoice_cancellation: {
        Args: {
          p_business_id: string
          p_document_id: string
          p_failed_at: string
          p_reason: string
          p_submission_id: string
        }
        Returns: undefined
      }
      has_business_role: {
        Args: { p_business_id: string; p_roles: string[] }
        Returns: boolean
      }
      invoice_audit_event: {
        Args: {
          p_action: string
          p_before?: Json
          p_invoice: Database["public"]["Tables"]["invoices"]["Row"]
          p_metadata?: Json
        }
        Returns: undefined
      }
      is_business_member: { Args: { p_business_id: string }; Returns: boolean }
      is_evidence_member: {
        Args: { p_evidence_file_id: string }
        Returns: boolean
      }
      is_invoice_member: { Args: { p_invoice_id: string }; Returns: boolean }
      is_party_member: { Args: { p_party_id: string }; Returns: boolean }
      is_reminder_member: { Args: { p_reminder_id: string }; Returns: boolean }
      is_telegram_member: {
        Args: { p_telegram_account_id: string }
        Returns: boolean
      }
      is_transaction_member: {
        Args: { p_transaction_id: string }
        Returns: boolean
      }
      issue_invoice: {
        Args: {
          p_fiscal_period?: string
          p_invoice_id: string
          p_prefix?: string
        }
        Returns: {
          amount_paid_minor: number
          bank_account_identifier: string | null
          billing_period_end: string | null
          billing_period_start: string | null
          business_id: string
          charge_minor: number
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string | null
          customer_snapshot: Json
          discount_minor: number
          document_allowances: Json
          document_charges: Json
          document_references: Json
          document_type: string
          due_date: string | null
          exchange_rate: number | null
          id: string
          invoice_number: string
          invoice_purpose: string | null
          issue_date: string
          issue_time: string | null
          issued_at: string | null
          notes: string | null
          payment_mode_code: string | null
          payment_reference: string | null
          payment_terms: string | null
          prepaid_minor: number
          prepayment_date: string | null
          prepayment_reference: string | null
          prepayment_time: string | null
          rounding_minor: number
          shipping_recipient_party_id: string | null
          status: string
          subtotal_minor: number
          supplemental_fields: Json
          supplier_snapshot: Json
          tax_currency: string | null
          tax_minor: number
          total_minor: number
          updated_at: string
          updated_by: string | null
          version: number
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "invoices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mark_e_invoice_sandbox_verified: {
        Args: { p_business_id: string; p_reason: string }
        Returns: undefined
      }
      mark_overdue_invoices: {
        Args: { p_business_id?: string }
        Returns: number
      }
      reconcile_e_invoice_submission: {
        Args: {
          p_business_id: string
          p_reconciliation: Json
          p_submission_id: string
        }
        Returns: undefined
      }
      record_e_invoice_cancellation: {
        Args: {
          p_business_id: string
          p_cancelled_at: string
          p_correlation_id: string
          p_document_id: string
          p_raw_response: Json
          p_reason: string
          p_submission_id: string
        }
        Returns: undefined
      }
      record_e_invoice_submission_response: {
        Args: {
          p_business_id: string
          p_response: Json
          p_submission_id: string
        }
        Returns: undefined
      }
      record_e_invoice_worker_failure: {
        Args: {
          p_at: string
          p_business_id: string
          p_reason: string
          p_submission_id: string
          p_worker_id: string
        }
        Returns: undefined
      }
      record_e_invoice_worker_success: {
        Args: {
          p_business_id: string
          p_submission_id: string
          p_worker_id: string
        }
        Returns: undefined
      }
      record_invoice_payment: {
        Args: {
          p_amount_minor: number
          p_currency: string
          p_invoice_id: string
          p_method?: string
          p_paid_at: string
          p_reference?: string
          p_transaction_id?: string
        }
        Returns: {
          amount_minor: number
          created_at: string
          currency: string
          external_reference: string | null
          id: string
          invoice_id: string
          notes: string | null
          paid_at: string
          payment_method_code: string | null
          transaction_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "invoice_payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reserve_e_invoice_provider_call: {
        Args: {
          p_at: string
          p_business_id: string
          p_credential_set_id: string
          p_endpoint: string
          p_environment: string
          p_limit: number
        }
        Returns: boolean
      }
      reverse_invoice_payment: {
        Args: { p_payment_id: string; p_reason: string }
        Returns: {
          amount_paid_minor: number
          bank_account_identifier: string | null
          billing_period_end: string | null
          billing_period_start: string | null
          business_id: string
          charge_minor: number
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string | null
          customer_snapshot: Json
          discount_minor: number
          document_allowances: Json
          document_charges: Json
          document_references: Json
          document_type: string
          due_date: string | null
          exchange_rate: number | null
          id: string
          invoice_number: string
          invoice_purpose: string | null
          issue_date: string
          issue_time: string | null
          issued_at: string | null
          notes: string | null
          payment_mode_code: string | null
          payment_reference: string | null
          payment_terms: string | null
          prepaid_minor: number
          prepayment_date: string | null
          prepayment_reference: string | null
          prepayment_time: string | null
          rounding_minor: number
          shipping_recipient_party_id: string | null
          status: string
          subtotal_minor: number
          supplemental_fields: Json
          supplier_snapshot: Json
          tax_currency: string | null
          tax_minor: number
          total_minor: number
          updated_at: string
          updated_by: string | null
          version: number
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "invoices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_e_invoice_supplemental_fields: {
        Args: {
          p_business_id: string
          p_document_id: string
          p_expected_revision: number
          p_supplemental_fields: Json
        }
        Returns: {
          active: boolean
          approved_at: string | null
          approved_by: string | null
          business_id: string
          buyer_snapshot: Json
          canonical_document: Json | null
          created_at: string
          document_type: string
          document_version: string
          id: string
          provenance: Json
          readiness_result: Json
          revision: number
          scenario: string
          source_invoice_id: string
          source_invoice_revision: number
          status: string
          submission_eligible: boolean
          supersedes_document_id: string | null
          supplemental_fields: Json
          supplier_snapshot: Json
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "e_invoice_documents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_invoice_compliance_details: {
        Args: {
          p_business_id: string
          p_buyer_snapshot: Json
          p_document: Json
          p_invoice_id: string
          p_supplemental_fields?: Json
          p_supplier_snapshot: Json
        }
        Returns: {
          amount_paid_minor: number
          bank_account_identifier: string | null
          billing_period_end: string | null
          billing_period_start: string | null
          business_id: string
          charge_minor: number
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string | null
          customer_snapshot: Json
          discount_minor: number
          document_allowances: Json
          document_charges: Json
          document_references: Json
          document_type: string
          due_date: string | null
          exchange_rate: number | null
          id: string
          invoice_number: string
          invoice_purpose: string | null
          issue_date: string
          issue_time: string | null
          issued_at: string | null
          notes: string | null
          payment_mode_code: string | null
          payment_reference: string | null
          payment_terms: string | null
          prepaid_minor: number
          prepayment_date: string | null
          prepayment_reference: string | null
          prepayment_time: string | null
          rounding_minor: number
          shipping_recipient_party_id: string | null
          status: string
          subtotal_minor: number
          supplemental_fields: Json
          supplier_snapshot: Json
          tax_currency: string | null
          tax_minor: number
          total_minor: number
          updated_at: string
          updated_by: string | null
          version: number
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "invoices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_invoice_draft: {
        Args: {
          p_business_id: string
          p_invoice?: Json
          p_invoice_id?: string
          p_items?: Json
        }
        Returns: {
          amount_paid_minor: number
          bank_account_identifier: string | null
          billing_period_end: string | null
          billing_period_start: string | null
          business_id: string
          charge_minor: number
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string | null
          customer_snapshot: Json
          discount_minor: number
          document_allowances: Json
          document_charges: Json
          document_references: Json
          document_type: string
          due_date: string | null
          exchange_rate: number | null
          id: string
          invoice_number: string
          invoice_purpose: string | null
          issue_date: string
          issue_time: string | null
          issued_at: string | null
          notes: string | null
          payment_mode_code: string | null
          payment_reference: string | null
          payment_terms: string | null
          prepaid_minor: number
          prepayment_date: string | null
          prepayment_reference: string | null
          prepayment_time: string | null
          rounding_minor: number
          shipping_recipient_party_id: string | null
          status: string
          subtotal_minor: number
          supplemental_fields: Json
          supplier_snapshot: Json
          tax_currency: string | null
          tax_minor: number
          total_minor: number
          updated_at: string
          updated_by: string | null
          version: number
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "invoices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_e_invoice_production_activation: {
        Args: { p_business_id: string; p_enabled: boolean; p_reason: string }
        Returns: undefined
      }
      storage_object_bucket_matches_entity: {
        Args: { p_bucket_id: string; p_object_name: string }
        Returns: boolean
      }
      storage_object_has_business_path: {
        Args: { p_business_id: string; p_object_name: string }
        Returns: boolean
      }
      update_business_compliance_profile: {
        Args: {
          p_business_activity_description: string
          p_business_id: string
          p_msic_code: string
          p_primary_address: Json
          p_primary_phone: string
        }
        Returns: {
          business_activity_description: string | null
          created_at: string
          created_by: string | null
          default_currency: string
          entity_type: string
          id: string
          legal_name: string
          msic_code: string | null
          owner_user_id: string
          preferred_language: string
          timezone: string
          trading_name: string | null
          updated_at: string
          updated_by: string | null
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "businesses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_invoice_prepayment: {
        Args: {
          p_business_id: string
          p_invoice_id: string
          p_prepaid_minor: number
        }
        Returns: {
          amount_paid_minor: number
          bank_account_identifier: string | null
          billing_period_end: string | null
          billing_period_start: string | null
          business_id: string
          charge_minor: number
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string | null
          customer_snapshot: Json
          discount_minor: number
          document_allowances: Json
          document_charges: Json
          document_references: Json
          document_type: string
          due_date: string | null
          exchange_rate: number | null
          id: string
          invoice_number: string
          invoice_purpose: string | null
          issue_date: string
          issue_time: string | null
          issued_at: string | null
          notes: string | null
          payment_mode_code: string | null
          payment_reference: string | null
          payment_terms: string | null
          prepaid_minor: number
          prepayment_date: string | null
          prepayment_reference: string | null
          prepayment_time: string | null
          rounding_minor: number
          shipping_recipient_party_id: string | null
          status: string
          subtotal_minor: number
          supplemental_fields: Json
          supplier_snapshot: Json
          tax_currency: string | null
          tax_minor: number
          total_minor: number
          updated_at: string
          updated_by: string | null
          version: number
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "invoices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_business_member: {
        Args: {
          p_business_id: string
          p_role: string
          p_status?: string
          p_user_id: string
        }
        Returns: {
          accepted_at: string | null
          business_id: string
          created_at: string
          invited_at: string | null
          invited_by: string | null
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "business_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      void_invoice: {
        Args: { p_cancelled?: boolean; p_invoice_id: string; p_reason: string }
        Returns: {
          amount_paid_minor: number
          bank_account_identifier: string | null
          billing_period_end: string | null
          billing_period_start: string | null
          business_id: string
          charge_minor: number
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string | null
          customer_snapshot: Json
          discount_minor: number
          document_allowances: Json
          document_charges: Json
          document_references: Json
          document_type: string
          due_date: string | null
          exchange_rate: number | null
          id: string
          invoice_number: string
          invoice_purpose: string | null
          issue_date: string
          issue_time: string | null
          issued_at: string | null
          notes: string | null
          payment_mode_code: string | null
          payment_reference: string | null
          payment_terms: string | null
          prepaid_minor: number
          prepayment_date: string | null
          prepayment_reference: string | null
          prepayment_time: string | null
          rounding_minor: number
          shipping_recipient_party_id: string | null
          status: string
          subtotal_minor: number
          supplemental_fields: Json
          supplier_snapshot: Json
          tax_currency: string | null
          tax_minor: number
          total_minor: number
          updated_at: string
          updated_by: string | null
          version: number
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "invoices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      void_telegram_transaction: {
        Args: {
          p_account_id: string
          p_reason: string
          p_transaction_id: string
        }
        Returns: undefined
      }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
