// components/face-enrollment.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveFaceEnrollment } from '@/app/dashboard/employees/actions'
import { averageEmbeddings, l2normalize, cosineSimilarity } from '@/lib/biometrics/vector'
import { CameraIcon, CheckIcon, RefreshIcon } from '@/components/icons'

type HumanFace = {
  embedding?: number[]
  faceScore?: number
  box?: [number, number, number, number]
}
type HumanInstance = {
  load: () => Promise<void>
  warmup: () => Promise<void>
  detect: (input: HTMLVideoElement) => Promise<{ face: HumanFace[] }>
}

// Enrolamiento SUPERVISADO: solo rostro claro, único y de buen tamaño.
const TARGET_CAPTURES = 6
const MIN_CAPTURES = 4
const MIN_FACE_SCORE = 0.5
const MIN_FACE_WIDTH_RATIO = 0.22

type Phase = 'loading' | 'ready' | 'capturing' | 'saving' | 'done' | 'error'

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
  const startedRef = useRef(false)

  const [phase, setPhase] = useState<Phase>('loading')
  const [count, setCount] = useState(0)
  const [readout, setReadout] = useState('')
  const [error, setError] = useState('')

  function stopLoop() { if (loopRef.current) clearInterval(loopRef.current); loopRef.current = null }
  function cleanup() {
    stopLoop()
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  useEffect(() => {
    void boot()
    return cleanup
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Prende cámara + modelos de inmediato y deja el PREVIEW listo, sin capturar.
  async function boot() {
    if (startedRef.current) return
    startedRef.current = true
    setError('')
    setPhase('loading')
    try {
      const { Human } = await import('@vladmandic/human')
      const human = new Human({
        backend: 'webgl',
        modelBasePath: 'https://vladmandic.github.io/human-models/models/',
        filter: { enabled: true, equalization: false },
        face: {
          enabled: true,
          detector: { rotation: false },
          mesh: { enabled: true },
          description: { enabled: true },
          antispoof: { enabled: false }, // supervisado: sin antispoof/liveness
          liveness: { enabled: false },
          iris: { enabled: false }, emotion: { enabled: false }, attention: { enabled: false },
        },
        body: { enabled: false }, hand: { enabled: false },
        object: { enabled: false }, gesture: { enabled: false },
      }) as unknown as HumanInstance
      await human.load()
      await human.warmup()
      humanRef.current = human

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }, audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setPhase('ready') // cámara encendida; espera a que el usuario encuadre e inicie
    } catch (e) {
      startedRef.current = false
      setError(e instanceof Error ? e.message : 'Error al iniciar la cámara')
      setPhase('error')
      cleanup()
    }
  }

  // El usuario ya enfocó su cara: ahora sí capturamos (rápido).
  function startCapture() {
    capturesRef.current = []
    setCount(0)
    setReadout('')
    setPhase('capturing')
    stopLoop()
    loopRef.current = setInterval(tick, 250)
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
      stopLoop()
      await finalize()
    }
  }

  async function finalize() {
    setPhase('saving')
    try {
      const caps = capturesRef.current
      // Descarta los 2 frames más atípicos (mano tapando, parpadeo) sin umbral.
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

  const progress = Math.min(100, (count / TARGET_CAPTURES) * 100)

  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-black">
        <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
        <div className="pointer-events-none absolute inset-[12%] rounded-[45%] border border-white/70 shadow-[0_0_0_999px_rgba(0,0,0,.2)]" />
        {phase === 'capturing' && <div className="pointer-events-none absolute inset-x-[12%] top-[12%] h-px animate-[scan-line_2s_ease-in-out_infinite] bg-white/80 shadow-[0_0_10px_white]" />}
        <span className="absolute left-4 top-4 rounded-full bg-black/55 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-white/70 backdrop-blur-md">
          {phase === 'ready' ? 'Listo' : phase === 'capturing' ? `${count}/${TARGET_CAPTURES}` : phase === 'saving' ? 'Guardando' : phase}
        </span>
      </div>

      <div className="min-h-20 px-1 pb-1" aria-live="polite">
        {phase === 'loading' && <p className="text-sm text-[#696963]">Encendiendo cámara y cargando modelos…</p>}

        {phase === 'ready' && (
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <p className="text-sm text-[#696963]">Centra tu rostro dentro del óvalo.</p>
            <button onClick={startCapture} className="btn-primary w-fit"><CameraIcon /> Empezar</button>
          </div>
        )}

        {phase === 'capturing' && (
          <div>
            <div className="mb-3 h-1 overflow-hidden rounded-full bg-[#deded7]">
              <div className="h-full rounded-full bg-black transition-[width] duration-300" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <p className="font-medium">Quédate mirando al frente.</p>
              <p className="font-mono text-[10px] text-[#696963]">{readout}</p>
            </div>
          </div>
        )}

        {phase === 'saving' && <p className="animate-pulse text-sm text-[#696963]">Guardando tu mejor toma…</p>}

        {phase === 'done' && (
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <p className="success-note flex items-center gap-2"><CheckIcon className="h-4 w-4" /> Rostro listo para {employeeName}.</p>
            <button onClick={() => router.push('/dashboard/employees')} className="btn-secondary">Volver al equipo</button>
          </div>
        )}

        {phase === 'error' && (
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <p className="error-note">{error}</p>
            <button onClick={() => { startedRef.current = false; void boot() }} className="btn-secondary w-fit"><RefreshIcon /> Reintentar</button>
          </div>
        )}
      </div>
    </div>
  )
}