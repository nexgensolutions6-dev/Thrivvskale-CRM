/**
 * Feeds the pointer position to a glass surface so its CSS can draw the soft
 * specular highlight under the cursor. Mouse only: touch and pen are ignored.
 * Called by Surface's onPointerMove.
 */
import type { PointerEvent } from 'react'

/** Writes --glass-mx / --glass-my (pixels from the surface's top-left corner) onto the element. */
export function trackPointer(event: PointerEvent<HTMLElement>): void {
  if (event.pointerType !== 'mouse') return
  const element = event.currentTarget
  const box = element.getBoundingClientRect()
  element.style.setProperty('--glass-mx', `${event.clientX - box.left}px`)
  element.style.setProperty('--glass-my', `${event.clientY - box.top}px`)
}
