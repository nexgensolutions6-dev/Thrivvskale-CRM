import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

/** Every lead-related query lives under this key, so one invalidate refreshes the whole page. */
export const LEADS_KEY = 'leads';

export function useInvalidateLeads() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: [LEADS_KEY] });
}

export function useUsers() {
  return useQuery({ queryKey: ['users'], queryFn: api.users, staleTime: 5 * 60_000 });
}

export function useLeadMeta() {
  return useQuery({ queryKey: [LEADS_KEY, 'meta'], queryFn: api.meta });
}
