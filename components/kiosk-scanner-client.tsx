// components/kiosk-scanner-client.tsx
'use client'
import dynamic from 'next/dynamic'
import { MarkIcon } from '@/components/icons'

export const KioskScanner = dynamic(
  () => import('./kiosk-scanner').then((m) => m.KioskScanner),
  { ssr: false, loading: () => (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black text-white">
      <span className="animate-[breathe_1.6s_ease-in-out_infinite] rounded-full border border-white/30 p-5"><MarkIcon className="h-6 w-6" /></span>
      <span className="text-sm text-white/50">Despertando el kiosco…</span>
    </div>
  ) },
)