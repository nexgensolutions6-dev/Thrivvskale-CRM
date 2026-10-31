import type {
  BulkChanges,
  ImportResult,
  Lead,
  LeadDetail,
  LeadFilters,
  LeadInput,
  LeadList,
  SortField,
  SortOrder,
  User,
} from '../types';

const BASE_URL = `${import.meta.env.VITE_API_URL ?? ''}/api`;
const TOKEN_KEY = 'crm_token';

export const SESSION_EXPIRED_EVENT = 'crm:session-expired';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // storage blocked: the session just won't survive a reload
  }
}

async function errorMessage(res: Response): Promise<string> {
  try {
    const { detail } = await res.json();
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg).replace(/^Value error, /, '');
  } catch {
    // not JSON
  }
  return 'Something went wrong. Please try again.';
}

async function send(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (typeof init.body === 'string') headers.set('Content-Type', 'application/json');

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection.');
  }
  if (res.status === 401 && token) {
    setToken(null);
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }
  if (!res.ok) throw new ApiError(res.status, await errorMessage(res));
  return res;
}

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await send(path, init);
  return res.status === 204 ? (undefined as T) : res.json();
}

function post<T>(path: string, body: unknown): Promise<T> {
  return json<T>(path, { method: 'POST', body: JSON.stringify(body) });
}

function query(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

export interface ListParams extends LeadFilters {
  stage?: string;
  sort?: SortField;
  order?: SortOrder;
  page?: number;
  page_size?: number;
}

export const api = {
  login: (email: string, password: string) =>
    post<{ access_token: string; user: User }>('/auth/login', { email, password }),
  me: () => json<User>('/auth/me'),
  users: () => json<User[]>('/users'),

  leads: (params: ListParams) => json<LeadList>(`/leads${query(params)}`),
  lead: (id: number) => json<LeadDetail>(`/leads/${id}`),
  meta: () => json<{ sources: string[] }>('/leads/meta'),
  reminders: (until: Date) => json<Lead[]>(`/leads/reminders${query({ until: until.toISOString() })}`),

  createLead: (input: LeadInput) => post<Lead>('/leads', input),
  updateLead: (id: number, changes: Partial<LeadInput>) =>
    json<Lead>(`/leads/${id}`, { method: 'PATCH', body: JSON.stringify(changes) }),
  deleteLead: (id: number) => json<void>(`/leads/${id}`, { method: 'DELETE' }),
  addNote: (id: number, body: string) => post<LeadDetail>(`/leads/${id}/notes`, { body }),

  bulkUpdate: (ids: number[], changes: BulkChanges) =>
    post<{ affected: number }>('/leads/bulk', { ids, changes }),
  bulkDelete: (ids: number[]) => post<{ affected: number }>('/leads/bulk-delete', { ids }),

  importLeads: (file: File) => {
    const body = new FormData();
    body.append('file', file);
    return json<ImportResult>('/leads/import', { method: 'POST', body });
  },
  exportLeads: async (params: ListParams) => {
    const res = await send(`/leads/export${query(params)}`);
    return res.blob();
  },
};
