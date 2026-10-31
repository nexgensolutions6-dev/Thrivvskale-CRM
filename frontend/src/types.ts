export type Stage = 'new' | 'contacted' | 'meeting_scheduled' | 'proposal_sent' | 'won' | 'lost';
export type Temperature = 'hot' | 'warm' | 'cold';
export type QualifiedFilter = 'true' | 'false' | 'unreviewed';
export type SortField = 'name' | 'company' | 'source' | 'assigned' | 'next_follow_up' | 'created_at';
export type SortOrder = 'asc' | 'desc';

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'owner' | 'rep';
}

export interface Lead {
  id: number;
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
  qualified: boolean | null;
  temperature: Temperature;
  stage: Stage;
  assigned_to_id: number | null;
  assigned_to_name: string | null;
  next_follow_up: string | null;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: number;
  kind: 'note' | 'system';
  body: string;
  user_name: string | null;
  created_at: string;
}

export interface LeadDetail extends Lead {
  activities: Activity[];
}

export interface LeadInput {
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
  qualified: boolean | null;
  temperature: Temperature;
  stage: Stage;
  assigned_to_id: number | null;
  next_follow_up: string | null;
}

export interface LeadFilters {
  q?: string;
  temperature?: Temperature;
  source?: string;
  qualified?: QualifiedFilter;
  assigned_to?: string;
}

export interface LeadList {
  items: Lead[];
  total: number;
  page: number;
  page_size: number;
}

export interface BulkChanges {
  stage?: Stage;
  temperature?: Temperature;
  assigned_to_id?: number | null;
}

export interface ImportResult {
  created: number;
  duplicates: number;
  failed: number;
  errors: { row: number; message: string }[];
}
