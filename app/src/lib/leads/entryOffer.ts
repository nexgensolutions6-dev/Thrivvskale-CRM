/**
 * Which entry offer a lead shows: the company's own, else its vertical's
 * default. The import stores null for a company on the default (see
 * verticalDefaults), so null here means "use the default". Pure. Called by
 * loadLead.
 */
export function resolveEntryOffer(companyOffer: string | null, verticalDefault: string | null): string | null {
  const own = companyOffer?.trim()
  if (own) return own
  return verticalDefault?.trim() || null
}
