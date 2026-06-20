// components/kiosk-scanner-client.tsx
'use client'
import dynamic from 'next/dynamic'

export const KioskScanner = dynamic(
  () => import('./kiosk-scanner').then((m) => m.KioskScanner),
  { ssr: false, loading: () => (
    <div className="flex min-h-screen items-center justify-center bg-black text-white">Cargando…</div>
  ) },
)