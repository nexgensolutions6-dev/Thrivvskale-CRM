/**
 * Splits a long list into slices. Called by the import modules that look rows
 * up with `.in(...)`: one request with hundreds of values makes a URL too long.
 */
export function inChunks<T>(items: readonly T[], size = 100): T[][] {
  const chunks: T[][] = []
  for (let start = 0; start < items.length; start += size) {
    chunks.push(items.slice(start, start + size))
  }
  return chunks
}
