// components/face-enrollment.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveFaceEnrollment } from '@/app/dashboard/employees/actions'
import { averageEmbeddings, l2normalize, cosineSimilarity } from '@/lib/biometrics/vector'

// Tipos mínimos de human (no importamos los tipos completos para no inflar nada).
type HumanFace = {
  embedding?: number[]
  faceScore?: number
  box?: [number, number, number, number] // x, y, w, h en px
}
type HumanInstance = {
  load: () => Promise<void>
  warmup: () => Promise<void>
  detect: (input: HTMLVideoElement) => Promise<{ face: HumanFace[] }>
}

// El enrolamiento es SUPERVISADO: no peleamos spoofing aquí (eso vive en el
// kiosco). Solo pedimos un rostro claro, único y de buen tamaño. La protección
// contra oclusión (mano frente a la cara) se hace al final, descartando los
// frames más atípicos — sin ningún umbral que calibrar ni que te bloquee.
const TARGET_CAPTURES = 6   // capturamos 6 de corrido
const MIN_CAPTURES = 4      // cuántos sobreviven al descarte de atípicos
const MIN_FACE_SCORE = 0.5  // "hay un rostro claro", nada más
const MIN_FACE_WIDTH_RATIO = 0.22

type Phase = 'idle' | 'loading' | 'capturing' | 'saving' | 'done' | 'error'

export function FaceEnrollment({
  employeeId,
  employeeName,
}: {
  employeeId: string
  employeeName: string
}) {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const humanRef = useRef<HumanInstance | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const loopRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const capturesRef = useRef<number[][]>([])
  const lastCapRef = useRef(0)

  const [phase, setPhase] = useState<Phase>('idle')
  const [count, setCount] = useState(0)
  const [readout, setReadout] = useState('')
  const [error, setError] = useState('')

  function cleanup() {
    if (loopRef.current) clearInterval(loopRef.current)
    loopRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }
  useEffect(() => cleanup, []) // limpia al desmontar

  async function start() {
    setError('')
    setPhase('loading')
    capturesRef.current = []
    setCount(0)
    try {
      const { Human } = await import('@vladmandic/human') // solo en el navegador
      const human = new Human({
        backend: 'webgl',
        // DEV: CDN oficial de modelos (cero setup).
        // PROD: copia los modelos a /public/models y pon modelBasePath: '/models'.
        modelBasePath: 'https://vladmandic.github.io/human-models/models/',
        filter: { enabled: true, equalization: false },
        face: {
          enabled: true,
          detector: { rotation: false },
          mesh: { enabled: true },
          description: { enabled: true }, // -> face.embedding
          antispoof: { enabled: false },  // no se usa en enrolamiento (supervisado)
          liveness: { enabled: false },   // idem -> menos modelos, carga más rápida
          iris: { enabled: false },
          emotion: { enabled: false },
          attention: { enabled: false },
        },
        body: { enabled: false },
        hand: { enabled: false },
        object: { enabled: false },
        gesture: { enabled: false },
      }) as unknown as HumanInstance

      await human.load()    // primera vez descarga modelos (se cachean en IndexedDB)
      await human.warmup()
      humanRef.current = human

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      })
      streamRef.current = stream
      if (!videoRef.current) return
      videoRef.current.srcObject = stream
      await videoRef.current.play()

      setPhase('capturing')
      loopRef.current = setInterval(tick, 250)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al iniciar la cámara')
      setPhase('error')
      cleanup()
    }
  }

  async function tick() {
    const human = humanRef.current
    const video = videoRef.current
    if (!human || !video) return

    const faces = (await human.detect(video)).face ?? []
    if (faces.length === 0) return setReadout('No se detecta rostro')
    if (faces.length > 1) return setReadout('Se detecta más de un rostro')

    const f = faces[0]
    const score = f.faceScore ?? 0
    const wRatio = f.box ? f.box[2] / video.videoWidth : 0
    setReadout(`score ${score.toFixed(2)} · capturas ${capturesRef.current.length}/${TARGET_CAPTURES}`)

    // Solo: rostro claro, único y de tamaño suficiente. Sin antispoof/liveness.
    if (wRatio < MIN_FACE_WIDTH_RATIO) return setReadout('Acércate más a la cámara')
    if (score < MIN_FACE_SCORE) return setReadout('Mira de frente a la cámara')
    if (!f.embedding?.length) return

    const now = Date.now()
    if (now - lastCapRef.current < 500) return
    lastCapRef.current = now

    capturesRef.current.push(f.embedding)
    const n = capturesRef.current.length
    setCount(n)
    if (n >= TARGET_CAPTURES) {
      if (loopRef.current) clearInterval(loopRef.current)
      loopRef.current = null
      await finalize()
    }
  }

  async function finalize() {
    setPhase('saving')
    try {
      const caps = capturesRef.current
      // Descarta los frames más alejados del "rostro promedio" (mano tapando,
      // parpadeo raro). Sin umbral: nos quedamos con los mejores.
      const centroid = averageEmbeddings(caps)
      const ranked = caps
        .map((c) => ({ c, sim: cosineSimilarity(c, centroid) }))
        .sort((a, b) => b.sim - a.sim)
      const kept = ranked.slice(0, Math.max(MIN_CAPTURES, caps.length - 2)).map((r) => r.c)

      const mean = l2normalize(averageEmbeddings(kept))
      const result = await saveFaceEnrollment(employeeId, mean, 1)
      cleanup()
      if (result.ok) setPhase('done')
      else { setError(result.error); setPhase('error') }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
      setPhase('error'); cleanup()
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded border bg-black">
        <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
      </div>

      {phase === 'capturing' && (
        <div className="text-sm text-gray-600">
          <p>Capturas: {count}/{TARGET_CAPTURES}</p>
          <p className="text-xs">{readout}</p>
        </div>
      )}
      {phase === 'idle' && (
        <button onClick={start} className="rounded bg-black px-4 py-2 text-white">
          Iniciar enrolamiento
        </button>
      )}
      {phase === 'loading' && <p className="text-sm text-gray-600">Cargando modelos y cámara…</p>}
      {phase === 'saving' && <p className="text-sm text-gray-600">Guardando rostro…</p>}
      {phase === 'done' && (
        <div className="flex items-center gap-3">
          <p className="text-sm text-green-700">✓ Rostro enrolado para {employeeName}.</p>
          <button onClick={() => router.push('/dashboard/employees')}
            className="rounded border px-3 py-1 text-sm">Volver a empleados</button>
        </div>
      )}
      {phase === 'error' && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-red-600">{error}</p>
          <button onClick={start} className="w-fit rounded border px-3 py-1 text-sm">Reintentar</button>
        </div>
      )}
    </div>
  )
}