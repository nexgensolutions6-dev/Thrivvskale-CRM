/**
 * Draws the QR code for a tel: link, for scanning with a phone when the laptop
 * cannot place the call. Always black on white, in forced-colors mode too, or it
 * would not scan. Used by CallCard.
 */
import { qrModules } from '@/lib/call/qrModules'

/** Blank modules around the code, as the QR standard asks. */
const QUIET_ZONE = 4

export function TelQr({ href }: { href: string }) {
  const rows = qrModules(href)
  const size = rows.length + QUIET_ZONE * 2
  return (
    <svg
      role="img"
      aria-label={`QR code for ${href}`}
      viewBox={`0 0 ${size} ${size}`}
      width={264}
      height={264}
      shapeRendering="crispEdges"
      fill="#000000"
      style={{ forcedColorAdjust: 'none' }}
    >
      <rect width={size} height={size} fill="#ffffff" />
      {rows.flatMap((row, y) =>
        row.map((dark, x) =>
          dark ? <rect key={`${x}-${y}`} x={x + QUIET_ZONE} y={y + QUIET_ZONE} width={1} height={1} /> : null,
        ),
      )}
    </svg>
  )
}
