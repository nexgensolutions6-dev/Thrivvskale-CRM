
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "activities": {
                  Row: {
                    "body": string | null,"client_id": string,"company_id": string,"contact_id": string | null,"contact_point_id": string | null,"created_at": string,"id": string,"metadata": NonNullable<Json>,"occurred_at": string,"type": Database["public"]['Enums']["activity_type"],"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"client_id"?: string,"company_id": string,"contact_id"?: string | null,"contact_point_id"?: string | null,"created_at"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"occurred_at"?: string,"type": Database["public"]['Enums']["activity_type"],"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "body"?: string | null,"client_id"?: string,"company_id"?: string,"contact_id"?: string | null,"contact_point_id"?: string | null,"created_at"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"occurred_at"?: string,"type"?: Database["public"]['Enums']["activity_type"],"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "activities_workspace_id_company_id_fkey"
      columns: ["workspace_id","company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["workspace_id","id"]
    },{
      foreignKeyName: "activities_workspace_id_contact_id_fkey"
      columns: ["workspace_id","contact_id"]
isOneToOne: false
      referencedRelation: "contacts"
      referencedColumns: ["workspace_id","id"]
    },{
      foreignKeyName: "activities_workspace_id_contact_point_id_fkey"
      columns: ["workspace_id","contact_point_id"]
isOneToOne: false
      referencedRelation: "contact_points"
      referencedColumns: ["workspace_id","id"]
    },{
      foreignKeyName: "activities_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"calls": {
                  Row: {
                    "activity_id": string,"created_at": string,"duration_is_estimate": boolean,"duration_seconds": number | null,"id": string,"lost_reason": string | null,"mix_used": (Database["public"]['Enums']["lang_code"])[],"objection_ids": (string)[],"opener_id": string | null,"outcome": Database["public"]['Enums']["call_outcome"],"updated_at": string,"who_answered": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activity_id": string,"created_at"?: string,"duration_is_estimate"?: boolean,"duration_seconds"?: number | null,"id"?: string,"lost_reason"?: string | null,"mix_used"?: (Database["public"]['Enums']["lang_code"])[],"objection_ids"?: (string)[],"opener_id"?: string | null,"outcome": Database["public"]['Enums']["call_outcome"],"updated_at"?: string,"who_answered"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "activity_id"?: string,"created_at"?: string,"duration_is_estimate"?: boolean,"duration_seconds"?: number | null,"id"?: string,"lost_reason"?: string | null,"mix_used"?: (Database["public"]['Enums']["lang_code"])[],"objection_ids"?: (string)[],"opener_id"?: string | null,"outcome"?: Database["public"]['Enums']["call_outcome"],"updated_at"?: string,"who_answered"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "calls_workspace_id_activity_id_fkey"
      columns: ["workspace_id","activity_id"]
isOneToOne: false
      referencedRelation: "activities"
      referencedColumns: ["workspace_id","id"]
    },{
      foreignKeyName: "calls_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "calls_workspace_id_opener_id_fkey"
      columns: ["workspace_id","opener_id"]
isOneToOne: false
      referencedRelation: "content_variants"
      referencedColumns: ["workspace_id","id"]
    }
                  ]
                },"companies": {
                  Row: {
                    "area": string | null,"base_score": number,"city": string | null,"country": string | null,"created_at": string,"description": string | null,"dnd": boolean,"entry_offer": string | null,"google_rating": number | null,"google_reviews": number | null,"gstin": string | null,"id": string,"intent_signal": string | null,"last_contacted_at": string | null,"long_term_opportunity": string | null,"name": string,"needs_number": boolean,"next_action_at": string | null,"pan": string | null,"parent_company_id": string | null,"pincode": string | null,"priority": Database["public"]['Enums']["priority"] | null,"problem_evidence": string | null,"score": number,"source": string | null,"stage": string,"state": string | null,"tags": (string)[],"tier": Database["public"]['Enums']["tier"],"updated_at": string,"vertical": string | null,"website_invalid": boolean,"website_status": string | null,"website_url": string | null,"workspace_id": string,"wrong_number": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "area"?: string | null,"base_score"?: number,"city"?: string | null,"country"?: string | null,"created_at"?: string,"description"?: string | null,"dnd"?: boolean,"entry_offer"?: string | null,"google_rating"?: number | null,"google_reviews"?: number | null,"gstin"?: string | null,"id"?: string,"intent_signal"?: string | null,"last_contacted_at"?: string | null,"long_term_opportunity"?: string | null,"name": string,"needs_number"?: boolean,"next_action_at"?: string | null,"pan"?: string | null,"parent_company_id"?: string | null,"pincode"?: string | null,"priority"?: Database["public"]['Enums']["priority"] | null,"problem_evidence"?: string | null,"score"?: number,"source"?: string | null,"stage"?: string,"state"?: string | null,"tags"?: (string)[],"tier"?: Database["public"]['Enums']["tier"],"updated_at"?: string,"vertical"?: string | null,"website_invalid"?: boolean,"website_status"?: string | null,"website_url"?: string | null,"workspace_id": string,"wrong_number"?: boolean
                  }
                  Update: {
                    "area"?: string | null,"base_score"?: number,"city"?: string | null,"country"?: string | null,"created_at"?: string,"description"?: string | null,"dnd"?: boolean,"entry_offer"?: string | null,"google_rating"?: number | null,"google_reviews"?: number | null,"gstin"?: string | null,"id"?: string,"intent_signal"?: string | null,"last_contacted_at"?: string | null,"long_term_opportunity"?: string | null,"name"?: string,"needs_number"?: boolean,"next_action_at"?: string | null,"pan"?: string | null,"parent_company_id"?: string | null,"pincode"?: string | null,"priority"?: Database["public"]['Enums']["priority"] | null,"problem_evidence"?: string | null,"score"?: number,"source"?: string | null,"stage"?: string,"state"?: string | null,"tags"?: (string)[],"tier"?: Database["public"]['Enums']["tier"],"updated_at"?: string,"vertical"?: string | null,"website_invalid"?: boolean,"website_status"?: string | null,"website_url"?: string | null,"workspace_id"?: string,"wrong_number"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "companies_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "companies_workspace_id_parent_company_id_fkey"
      columns: ["workspace_id","parent_company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["workspace_id","id"]
    }
                  ]
                },"consent_log": {
                  Row: {
                    "at": string,"contact_point_id": string | null,"created_at": string,"event": Database["public"]['Enums']["consent_event"],"id": string,"note": string | null,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "at"?: string,"contact_point_id"?: string | null,"created_at"?: string,"event": Database["public"]['Enums']["consent_event"],"id"?: string,"note"?: string | null,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "at"?: string,"contact_point_id"?: string | null,"created_at"?: string,"event"?: Database["public"]['Enums']["consent_event"],"id"?: string,"note"?: string | null,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "consent_log_workspace_id_contact_point_id_fkey"
      columns: ["workspace_id","contact_point_id"]
isOneToOne: false
      referencedRelation: "contact_points"
      referencedColumns: ["workspace_id","id"]
    },{
      foreignKeyName: "consent_log_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"contact_points": {
                  Row: {
                    "company_id": string,"contact_id": string | null,"created_at": string,"e164": string,"id": string,"kind": Database["public"]['Enums']["phone_kind"],"preferred_for_calls": boolean,"preferred_for_whatsapp": boolean,"updated_at": string,"visibility": Database["public"]['Enums']["visibility"],"wa_status": Database["public"]['Enums']["wa_status"],"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "company_id": string,"contact_id"?: string | null,"created_at"?: string,"e164": string,"id"?: string,"kind": Database["public"]['Enums']["phone_kind"],"preferred_for_calls"?: boolean,"preferred_for_whatsapp"?: boolean,"updated_at"?: string,"visibility"?: Database["public"]['Enums']["visibility"],"wa_status"?: Database["public"]['Enums']["wa_status"],"workspace_id": string
                  }
                  Update: {
                    "company_id"?: string,"contact_id"?: string | null,"created_at"?: string,"e164"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["phone_kind"],"preferred_for_calls"?: boolean,"preferred_for_whatsapp"?: boolean,"updated_at"?: string,"visibility"?: Database["public"]['Enums']["visibility"],"wa_status"?: Database["public"]['Enums']["wa_status"],"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "contact_points_workspace_id_company_id_fkey"
      columns: ["workspace_id","company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["workspace_id","id"]
    },{
      foreignKeyName: "contact_points_workspace_id_contact_id_fkey"
      columns: ["workspace_id","contact_id"]
isOneToOne: false
      referencedRelation: "contacts"
      referencedColumns: ["workspace_id","id"]
    },{
      foreignKeyName: "contact_points_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"contacts": {
                  Row: {
                    "company_id": string,"created_at": string,"id": string,"languages": (Database["public"]['Enums']["lang_code"])[],"mix_profile": string | null,"name": string | null,"name_latin": string | null,"notes": string | null,"register": Database["public"]['Enums']["register"] | null,"role": Database["public"]['Enums']["contact_role"],"script_pref": Database["public"]['Enums']["script"] | null,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "company_id": string,"created_at"?: string,"id"?: string,"languages"?: (Database["public"]['Enums']["lang_code"])[],"mix_profile"?: string | null,"name"?: string | null,"name_latin"?: string | null,"notes"?: string | null,"register"?: Database["public"]['Enums']["register"] | null,"role"?: Database["public"]['Enums']["contact_role"],"script_pref"?: Database["public"]['Enums']["script"] | null,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "company_id"?: string,"created_at"?: string,"id"?: string,"languages"?: (Database["public"]['Enums']["lang_code"])[],"mix_profile"?: string | null,"name"?: string | null,"name_latin"?: string | null,"notes"?: string | null,"register"?: Database["public"]['Enums']["register"] | null,"role"?: Database["public"]['Enums']["contact_role"],"script_pref"?: Database["public"]['Enums']["script"] | null,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "contacts_workspace_id_company_id_fkey"
      columns: ["workspace_id","company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["workspace_id","id"]
    },{
      foreignKeyName: "contacts_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"content_variants": {
                  Row: {
                    "body": string,"company_id": string | null,"created_at": string,"id": string,"kind": Database["public"]['Enums']["content_kind"],"mix": string,"outcome_counts": NonNullable<Json>,"parent_variant_id": string | null,"register": Database["public"]['Enums']["register"] | null,"script": Database["public"]['Enums']["script"],"seed_key": string | null,"source": Database["public"]['Enums']["content_source"],"stage": string | null,"title": string | null,"updated_at": string,"usage_count": number,"vertical": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"company_id"?: string | null,"created_at"?: string,"id"?: string,"kind": Database["public"]['Enums']["content_kind"],"mix"?: string,"outcome_counts"?: NonNullable<Json>,"parent_variant_id"?: string | null,"register"?: Database["public"]['Enums']["register"] | null,"script"?: Database["public"]['Enums']["script"],"seed_key"?: string | null,"source"?: Database["public"]['Enums']["content_source"],"stage"?: string | null,"title"?: string | null,"updated_at"?: string,"usage_count"?: number,"vertical"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "body"?: string,"company_id"?: string | null,"created_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["content_kind"],"mix"?: string,"outcome_counts"?: NonNullable<Json>,"parent_variant_id"?: string | null,"register"?: Database["public"]['Enums']["register"] | null,"script"?: Database["public"]['Enums']["script"],"seed_key"?: string | null,"source"?: Database["public"]['Enums']["content_source"],"stage"?: string | null,"title"?: string | null,"updated_at"?: string,"usage_count"?: number,"vertical"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "content_variants_company_fkey"
      columns: ["workspace_id","company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["workspace_id","id"]
    },{
      foreignKeyName: "content_variants_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "content_variants_workspace_id_parent_variant_id_fkey"
      columns: ["workspace_id","parent_variant_id"]
isOneToOne: false
      referencedRelation: "content_variants"
      referencedColumns: ["workspace_id","id"]
    }
                  ]
                },"holidays": {
                  Row: {
                    "created_at": string,"date": string,"id": string,"kind": Database["public"]['Enums']["holiday_kind"],"name": string,"region": string | null,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"date": string,"id"?: string,"kind"?: Database["public"]['Enums']["holiday_kind"],"name": string,"region"?: string | null,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"date"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["holiday_kind"],"name"?: string,"region"?: string | null,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "holidays_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"import_batches": {
                  Row: {
                    "created_at": string,"file_name": string,"id": string,"row_count": number,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"file_name": string,"id"?: string,"row_count"?: number,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"file_name"?: string,"id"?: string,"row_count"?: number,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "import_batches_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"import_rows": {
                  Row: {
                    "batch_id": string,"company_id": string | null,"created_at": string,"error": string | null,"id": string,"raw": NonNullable<Json>,"row_number": number,"status": Database["public"]['Enums']["import_row_status"],"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "batch_id": string,"company_id"?: string | null,"created_at"?: string,"error"?: string | null,"id"?: string,"raw": NonNullable<Json>,"row_number": number,"status"?: Database["public"]['Enums']["import_row_status"],"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "batch_id"?: string,"company_id"?: string | null,"created_at"?: string,"error"?: string | null,"id"?: string,"raw"?: NonNullable<Json>,"row_number"?: number,"status"?: Database["public"]['Enums']["import_row_status"],"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "import_rows_workspace_id_batch_id_fkey"
      columns: ["workspace_id","batch_id"]
isOneToOne: false
      referencedRelation: "import_batches"
      referencedColumns: ["workspace_id","id"]
    },{
      foreignKeyName: "import_rows_workspace_id_company_id_fkey"
      columns: ["workspace_id","company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["workspace_id","id"]
    },{
      foreignKeyName: "import_rows_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"members": {
                  Row: {
                    "created_at": string,"id": string,"role": Database["public"]['Enums']["member_role"],"updated_at": string,"user_id": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"role"?: Database["public"]['Enums']["member_role"],"updated_at"?: string,"user_id": string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"role"?: Database["public"]['Enums']["member_role"],"updated_at"?: string,"user_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "members_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"objections": {
                  Row: {
                    "created_at": string,"id": string,"mix": string | null,"seed_key": string | null,"suggested_response_id": string | null,"text": string,"updated_at": string,"vertical": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"mix"?: string | null,"seed_key"?: string | null,"suggested_response_id"?: string | null,"text": string,"updated_at"?: string,"vertical"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"mix"?: string | null,"seed_key"?: string | null,"suggested_response_id"?: string | null,"text"?: string,"updated_at"?: string,"vertical"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "objections_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "objections_workspace_id_suggested_response_id_fkey"
      columns: ["workspace_id","suggested_response_id"]
isOneToOne: false
      referencedRelation: "content_variants"
      referencedColumns: ["workspace_id","id"]
    }
                  ]
                },"pain_points": {
                  Row: {
                    "activity_id": string | null,"company_id": string,"created_at": string,"current_tool": string | null,"frequency": string | null,"id": string,"impact_type": Database["public"]['Enums']["impact_type"] | null,"process_category": string | null,"quote": string | null,"quote_en": string | null,"severity": number | null,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activity_id"?: string | null,"company_id": string,"created_at"?: string,"current_tool"?: string | null,"frequency"?: string | null,"id"?: string,"impact_type"?: Database["public"]['Enums']["impact_type"] | null,"process_category"?: string | null,"quote"?: string | null,"quote_en"?: string | null,"severity"?: number | null,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "activity_id"?: string | null,"company_id"?: string,"created_at"?: string,"current_tool"?: string | null,"frequency"?: string | null,"id"?: string,"impact_type"?: Database["public"]['Enums']["impact_type"] | null,"process_category"?: string | null,"quote"?: string | null,"quote_en"?: string | null,"severity"?: number | null,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pain_points_workspace_id_activity_id_fkey"
      columns: ["workspace_id","activity_id"]
isOneToOne: false
      referencedRelation: "activities"
      referencedColumns: ["workspace_id","id"]
    },{
      foreignKeyName: "pain_points_workspace_id_company_id_fkey"
      columns: ["workspace_id","company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["workspace_id","id"]
    },{
      foreignKeyName: "pain_points_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"playbooks": {
                  Row: {
                    "created_at": string,"deliverables": NonNullable<Json>,"discovery_questions": NonNullable<Json>,"id": string,"pitch": string,"pricing_guidance": string,"service_key": string,"title": string,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"deliverables"?: NonNullable<Json>,"discovery_questions"?: NonNullable<Json>,"id"?: string,"pitch": string,"pricing_guidance"?: string,"service_key": string,"title": string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"deliverables"?: NonNullable<Json>,"discovery_questions"?: NonNullable<Json>,"id"?: string,"pitch"?: string,"pricing_guidance"?: string,"service_key"?: string,"title"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "playbooks_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"targets": {
                  Row: {
                    "connects": number,"conversations": number,"created_at": string,"dials": number,"effective_from": string,"id": string,"meetings_booked": number,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "connects"?: number,"conversations"?: number,"created_at"?: string,"dials"?: number,"effective_from"?: string,"id"?: string,"meetings_booked"?: number,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "connects"?: number,"conversations"?: number,"created_at"?: string,"dials"?: number,"effective_from"?: string,"id"?: string,"meetings_booked"?: number,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "targets_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"tasks": {
                  Row: {
                    "company_id": string | null,"created_at": string,"done_at": string | null,"due_at": string | null,"id": string,"title": string,"type": Database["public"]['Enums']["task_type"],"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "company_id"?: string | null,"created_at"?: string,"done_at"?: string | null,"due_at"?: string | null,"id"?: string,"title": string,"type"?: Database["public"]['Enums']["task_type"],"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "company_id"?: string | null,"created_at"?: string,"done_at"?: string | null,"due_at"?: string | null,"id"?: string,"title"?: string,"type"?: Database["public"]['Enums']["task_type"],"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tasks_workspace_id_company_id_fkey"
      columns: ["workspace_id","company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["workspace_id","id"]
    },{
      foreignKeyName: "tasks_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"vertical_defaults": {
                  Row: {
                    "created_at": string,"entry_offer": string | null,"id": string,"long_term_opportunity": string | null,"updated_at": string,"vertical": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"entry_offer"?: string | null,"id"?: string,"long_term_opportunity"?: string | null,"updated_at"?: string,"vertical": string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"entry_offer"?: string | null,"id"?: string,"long_term_opportunity"?: string | null,"updated_at"?: string,"vertical"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "vertical_defaults_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"workspaces": {
                  Row: {
                    "created_at": string,"default_language_mix": (Database["public"]['Enums']["lang_code"])[],"gst_registered": boolean,"gstin": string | null,"home_state": string | null,"id": string,"name": string,"timezone": string,"updated_at": string,"working_days": (number)[]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"default_language_mix"?: (Database["public"]['Enums']["lang_code"])[],"gst_registered"?: boolean,"gstin"?: string | null,"home_state"?: string | null,"id"?: string,"name": string,"timezone"?: string,"updated_at"?: string,"working_days"?: (number)[]
                  }
                  Update: {
                    "created_at"?: string,"default_language_mix"?: (Database["public"]['Enums']["lang_code"])[],"gst_registered"?: boolean,"gstin"?: string | null,"home_state"?: string | null,"id"?: string,"name"?: string,"timezone"?: string,"updated_at"?: string,"working_days"?: (number)[]
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "scoreboard_daily": {
                  Row: {
                    "connects": number | null,"conversations": number | null,"day": string | null,"dials": number | null,"meetings_booked": number | null,"talk_seconds": number | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "calls_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "is_member":
{ Args: { "ws": string }; Returns: boolean
                           },
"is_member_of_object_folder":
{ Args: { "object_name": string }; Returns: boolean
                           },
"log_call":
{ Args: { "p_client_id": string,"p_company_id": string,"p_contact_id"?: string,"p_contact_point_id": string,"p_duration_is_estimate": boolean,"p_duration_seconds"?: number,"p_lost_reason"?: string,"p_mix_used"?: (Database["public"]['Enums']["lang_code"])[],"p_next_action"?: Json,"p_next_mix_profile"?: string,"p_objection_ids"?: (string)[],"p_occurred_at"?: string,"p_opener_id"?: string,"p_outcome": Database["public"]['Enums']["call_outcome"],"p_pain_point"?: Json,"p_workspace_id": string }; Returns: {
              "call_id": string,"duplicate": boolean
            }[]
                           },
"search_leads":
{ Args: { "lim"?: number,"q": string,"ws": string }; Returns: {
              "area": string | null,
"base_score": number,
"city": string | null,
"country": string | null,
"created_at": string,
"description": string | null,
"dnd": boolean,
"entry_offer": string | null,
"google_rating": number | null,
"google_reviews": number | null,
"gstin": string | null,
"id": string,
"intent_signal": string | null,
"last_contacted_at": string | null,
"long_term_opportunity": string | null,
"name": string,
"needs_number": boolean,
"next_action_at": string | null,
"pan": string | null,
"parent_company_id": string | null,
"pincode": string | null,
"priority": Database["public"]['Enums']["priority"] | null,
"problem_evidence": string | null,
"score": number,
"source": string | null,
"stage": string,
"state": string | null,
"tags": (string)[],
"tier": Database["public"]['Enums']["tier"],
"updated_at": string,
"vertical": string | null,
"website_invalid": boolean,
"website_status": string | null,
"website_url": string | null,
"workspace_id": string,
"wrong_number": boolean
            }[]
                          SetofOptions: {
        from: "*"
        to: "companies"
        isOneToOne: false
        isSetofReturn: true
      } },
"search_match_score":
{ Args: { "hay": string,"needle": string }; Returns: number
                           }
          }
          Enums: {
            "activity_type": "call"|"whatsapp"|"note"|"voice_note"|"status_change"|"task_done"|"quote_sent"|"invoice_sent"|"site_recheck","call_outcome": "no_answer"|"busy"|"wrong_number"|"callback"|"gatekeeper"|"interested"|"not_interested"|"meeting_booked","consent_event": "opted_out"|"consented"|"erased"|"exported","contact_role": "owner"|"decision_maker"|"manager"|"gatekeeper"|"other","content_kind": "opener"|"template"|"script"|"objection_response","content_source": "manual"|"ai_draft"|"ai_approved","holiday_kind": "public"|"festival"|"local","impact_type": "time"|"money"|"manpower","import_row_status": "pending"|"imported"|"skipped"|"failed","lang_code": "te"|"hi"|"kn"|"ta"|"ml"|"mr"|"ur"|"en","member_role": "owner","phone_kind": "business"|"personal"|"landline","priority": "A"|"B"|"C","register": "formal"|"casual","script": "latin"|"native","task_type": "callback"|"todo"|"demo"|"site_visit","tier": "core"|"exploratory","visibility": "owner_only"|"workspace","wa_status": "verified"|"unconfirmed"|"landline"|"none"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "activity_type": ["call", "whatsapp", "note", "voice_note", "status_change", "task_done", "quote_sent", "invoice_sent", "site_recheck"],"call_outcome": ["no_answer", "busy", "wrong_number", "callback", "gatekeeper", "interested", "not_interested", "meeting_booked"],"consent_event": ["opted_out", "consented", "erased", "exported"],"contact_role": ["owner", "decision_maker", "manager", "gatekeeper", "other"],"content_kind": ["opener", "template", "script", "objection_response"],"content_source": ["manual", "ai_draft", "ai_approved"],"holiday_kind": ["public", "festival", "local"],"impact_type": ["time", "money", "manpower"],"import_row_status": ["pending", "imported", "skipped", "failed"],"lang_code": ["te", "hi", "kn", "ta", "ml", "mr", "ur", "en"],"member_role": ["owner"],"phone_kind": ["business", "personal", "landline"],"priority": ["A", "B", "C"],"register": ["formal", "casual"],"script": ["latin", "native"],"task_type": ["callback", "todo", "demo", "site_visit"],"tier": ["core", "exploratory"],"visibility": ["owner_only", "workspace"],"wa_status": ["verified", "unconfirmed", "landline", "none"]
          }
        }
} as const
