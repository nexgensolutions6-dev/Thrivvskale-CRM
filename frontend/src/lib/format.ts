import type { Lead, Stage, Temperature } from '../types';

export const STAGES: { key: Stage; label: string }[] = [
  { key: 'new', label: 'New' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'meeting_scheduled', label: 'Meeting scheduled' },
  { key: 'proposal_sent', label: 'Proposal sent' },
  { key: 'won', label: 'Won' },
  { key: 'lost', label: 'Lost' },
];

export const TEMPERATURES: { key: Temperature; label: string }[] = [
  { key: 'hot', label: 'Hot' },
  { key: 'warm', label: 'Warm' },
  { key: 'cold', label: 'Cold' },
];

export const stageLabel = (stage: Stage) => STAGES.find((s) => s.key === stage)?.label ?? stage;

export const isClosed = (stage: Stage) => stage === 'won' || stage === 'lost';

export const firstName = (name: string | null) => name?.split(' ')[0] ?? 'Unassigned';

export const initials = (name: string) =>
  name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

const LOCALE = 'en-IN';

const formatTime = (date: Date) =>
  date.toLocaleTimeString(LOCALE, { hour: 'numeric', minute: '2-digit', hour12: true });

export function formatDateTime(iso: string) {
  const date = new Date(iso);
  const day = date.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
  return `${day}, ${formatTime(date)}`;
}

export function endOfToday() {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date;
}

const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

export type FollowUpTone = 'today' | 'overdue' | 'plain';

export function followUp(lead: Pick<Lead, 'stage' | 'next_follow_up'>): {
  label: string;
  tone: FollowUpTone;
  title?: string;
} {
  if (isClosed(lead.stage)) return { label: '—', tone: 'plain' };
  if (!lead.next_follow_up) return { label: 'Not set', tone: 'plain' };

  const date = new Date(lead.next_follow_up);
  const now = new Date();
  const title = formatDateTime(lead.next_follow_up);
  if (date < now) return { label: 'Overdue', tone: 'overdue', title };
  if (isSameDay(date, now)) return { label: `Today, ${formatTime(date)}`, tone: 'today', title };

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (isSameDay(date, tomorrow)) return { label: 'Tomorrow', tone: 'plain', title };

  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  if (date.getFullYear() !== now.getFullYear()) options.year = 'numeric';
  return { label: date.toLocaleDateString(LOCALE, options), tone: 'plain', title };
}

/** Value for <input type="datetime-local">, which works in local time without an offset. */
export function toLocalInput(iso: string | null) {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

export const fromLocalInput = (value: string) => (value ? new Date(value).toISOString() : null);
