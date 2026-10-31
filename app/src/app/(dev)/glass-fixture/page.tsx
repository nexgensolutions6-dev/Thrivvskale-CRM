/**
 * TEST-ONLY page at /glass-fixture: a dock (L1), a card (L2), a sheet (L3) and a
 * 50-row list over a wallpaper, so tests/e2e/glass.spec.ts has something to look at
 * before the real shell (Task 13) exists. It 404s in production builds and sits
 * behind the normal sign-in guard in src/proxy.ts. Delete the (dev) folder when the
 * shell has its own e2e pages.
 * `?mode=full|lite` forces a glass mode so screenshots do not depend on the machine.
 */
import { notFound } from 'next/navigation'
import { GlassModeSync } from '@/components/glass/GlassModeSync'
import { Surface } from '@/components/glass/Surface'
import { wallpaperStyle } from '@/lib/glass/wallpaper-style'

const ROW_COUNT = 50

export default async function GlassFixturePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  if (process.env.NODE_ENV === 'production') notFound()

  const { mode } = await searchParams
  const userOverride = mode === 'full' || mode === 'lite' ? mode : undefined
  const rows = Array.from({ length: ROW_COUNT }, (_, index) => `Lead ${index + 1}`)

  return (
    <div className="glass-wallpaper min-h-screen" style={wallpaperStyle('aurora')}>
      <GlassModeSync userOverride={userOverride} />
      <main className="flex flex-col gap-4 p-4 pb-32">
        <Surface level="L2" className="p-4">
          <h1 className="text-xl font-semibold">Today</h1>
          <p>Twelve calls waiting.</p>
        </Surface>
        <Surface level="L3" className="p-4">
          <h2 className="text-lg font-semibold">Call card</h2>
          <p>Priya Rao, 9 minutes ago.</p>
        </Surface>
        <ul className="glass-list flex flex-col gap-2">
          {rows.map((label) => (
            <li key={label} className="glass-row px-4 py-3">
              {label}
            </li>
          ))}
        </ul>
      </main>
      <Surface level="L1" className="fixed inset-x-4 bottom-4 flex justify-around p-3" role="navigation" aria-label="Dock">
        <span>Today</span>
        <span>Leads</span>
        <span>Calendar</span>
      </Surface>
    </div>
  )
}
