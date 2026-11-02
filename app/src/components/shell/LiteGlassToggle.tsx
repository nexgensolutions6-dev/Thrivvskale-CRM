'use client'
/**
 * The "Lite glass" switch on the Settings page. On = lite glass always; off =
 * automatic (the app decides from the device). Stores the choice with
 * lib/shell/glass-override.ts; GlassModeController picks it up straight away.
 */
import { useId } from 'react'
import { writeGlassOverride } from '@/lib/shell/glass-override'
import { useGlassOverride } from '@/lib/shell/use-glass-override'

export function LiteGlassToggle() {
  const override = useGlassOverride()
  const hintId = useId()
  return (
    <div className="flex items-start gap-3">
      <input
        id="lite-glass"
        type="checkbox"
        aria-describedby={hintId}
        checked={override === 'lite'}
        onChange={(event) => writeGlassOverride(event.target.checked ? 'lite' : undefined)}
        className="mt-1 size-5 shrink-0"
      />
      <div>
        <label htmlFor="lite-glass" className="font-medium">
          Lite glass
        </label>
        <p id={hintId} className="text-sm text-(--glass-text-secondary)">
          Turns off the blur behind panels. Use it if scrolling feels slow. Off means the app decides for your device.
        </p>
      </div>
    </div>
  )
}
