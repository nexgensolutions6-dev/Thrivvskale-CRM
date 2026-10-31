import { Check, X } from 'lucide-react';
import { TEMPERATURES } from '../lib/format';
import type { Temperature } from '../types';

export function QualifiedBadge({ value }: { value: boolean | null }) {
  if (value === null) return <span className="badge badge-unreviewed">Not reviewed</span>;
  return value ? (
    <span className="badge badge-true"><Check size={13} strokeWidth={3} aria-hidden="true" />True lead</span>
  ) : (
    <span className="badge badge-false"><X size={13} strokeWidth={3} aria-hidden="true" />False lead</span>
  );
}

export function TemperatureBadge({ value }: { value: Temperature }) {
  const label = TEMPERATURES.find((t) => t.key === value)?.label;
  return <span className={`badge badge-${value}`}>{label}</span>;
}

export function SourceChip({ value }: { value: string | null }) {
  return value ? <span className="chip">{value}</span> : <span className="muted">—</span>;
}
