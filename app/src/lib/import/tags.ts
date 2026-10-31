/**
 * The Tags column of the lead CSV ("Interiors & Modular;Priority A;High intent").
 * Called by mapLeadRow.
 */
export function splitTags(text: string): string[] {
  return text
    .split(';')
    .map((tag) => tag.trim())
    .filter((tag) => tag !== '')
}
