'use client'
import dynamic from 'next/dynamic'

// Carga el componente real SOLO en el navegador. Así human (y su build de Node
// que pide @tensorflow/tfjs-node) nunca entra al render del servidor.
export const FaceEnrollment = dynamic(
  () => import('./face-enrollment').then((m) => m.FaceEnrollment),
  {
    ssr: false,
    loading: () => <p className="text-sm text-gray-600">Cargando módulo de cámara…</p>,
  },
)