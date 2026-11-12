'use client'

import dynamic from 'next/dynamic'
import { CameraIcon } from '@/components/icons'

export const FaceEnrollment = dynamic(
  () => import('./face-enrollment').then((module) => module.FaceEnrollment),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-xl bg-black text-white">
        <span className="animate-[breathe_1.6s_ease-in-out_infinite] rounded-full border border-white/30 p-4"><CameraIcon className="h-5 w-5" /></span>
        <p className="text-sm text-white/60">Preparando la cámara…</p>
      </div>
    ),
  },
)
