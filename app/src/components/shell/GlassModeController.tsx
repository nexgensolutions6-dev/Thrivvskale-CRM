'use client'
/**
 * Connects the Settings "Lite glass" choice to the glass system: reads the stored
 * override and hands it to GlassModeSync, which sets <html data-glass>.
 * Mounted once by the app layout.
 */
import { GlassModeSync } from '@/components/glass/GlassModeSync'
import { useGlassOverride } from '@/lib/shell/use-glass-override'

export function GlassModeController() {
  const userOverride = useGlassOverride()
  return <GlassModeSync userOverride={userOverride} />
}
