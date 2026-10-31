/**
 * Encodes text as a QR code and returns its grid of dark (true) and light cells.
 * Wraps the qrcode-generator library so the rest of the app never sees its API.
 * Pure. Used by TelQr, which draws the grid.
 */
import qrcode from 'qrcode-generator'

/** 0 lets the library pick the smallest QR version that fits. */
const AUTO_VERSION = 0
const ERROR_CORRECTION = 'M'

export function qrModules(text: string): boolean[][] {
  const qr = qrcode(AUTO_VERSION, ERROR_CORRECTION)
  qr.addData(text)
  qr.make()
  const size = qr.getModuleCount()
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, column) => qr.isDark(row, column)),
  )
}
