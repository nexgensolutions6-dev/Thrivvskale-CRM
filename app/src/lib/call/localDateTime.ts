/**
 * Converts between an ISO instant and the value of an <input type="datetime-local">,
 * which is always in the browser's own timezone. Used by OutcomeSheet.
 */
const pad = (value: number): string => String(value).padStart(2, '0')

export function toLocalInput(iso: string): string {
  const date = new Date(iso)
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  return `${day}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** The ISO instant of a field value, or null when the field is empty or unreadable. */
export function fromLocalInput(value: string): string | null {
  const date = new Date(value)
  return value === '' || Number.isNaN(date.getTime()) ? null : date.toISOString()
}
