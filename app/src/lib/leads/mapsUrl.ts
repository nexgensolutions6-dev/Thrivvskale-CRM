/**
 * The Google Maps search link for a lead (name, area, city), shown as the Maps
 * button in the lead header. Pure. Called by LeadHeader.
 */
export function mapsUrl(place: { name: string; area: string | null; city: string | null }): string {
  const query = [place.name, place.area, place.city]
    .map((part) => part?.trim() ?? '')
    .filter((part) => part !== '')
    .join(', ')
  const url = new URL('https://www.google.com/maps/search/')
  url.searchParams.set('api', '1')
  url.searchParams.set('query', query)
  return url.href
}
