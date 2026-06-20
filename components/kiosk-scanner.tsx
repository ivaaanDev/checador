// components/kiosk-scanner.tsx
'use client'

import { useEffect, useRef, useState } from 'react'

type HumanFace = {
  embedding?: number[]
  faceScore?: number
  real?: number
  live?: number
  box?: [number, number, number, number]
  rotation?: { angle?: { yaw?: number } }
}
type HumanInstance = {
  load: () => Promise<void>
  warmup: () => Promise<void>
  detect: (input: HTMLVideoElement) => Promise<{ face: HumanFace[] }>
}

const MIN_FACE_SCORE = 0.6
const MIN_REAL = 0.8
const MIN_LIVE = 0.75
const MIN_FACE_WIDTH_RATIO = 0.25
const FRONTAL_YAW_MAX = 0.18 // rad (~10°). CALÍBRALO con el readout.
const TURN_YAW_MIN = 0.45    // rad (~26°): "claramente girado".
const CHALLENGE_MS = 7000
const RESULT_MS = 3500
const TOKEN_KEY = 'kioskDeviceToken'

type Phase = 'setup' | 'loading' | 'scanning' | 'challenge' | 'matching' | 'result'
type Outcome = {
  matched: boolean
  employeeName?: string
  eventType?: 'clock_in' | 'clock_out'
  at?: string
  message?: string
}

export function KioskScanner() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const humanRef = useRef<HumanInstance | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const loopRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const candidateRef = useRef<number[] | null>(null)
  const turnedRef = useRef(false)
  const armedRef = useRef(true)              // anti doble-checada: re-arma al salir el rostro
  const challengeStartRef = useRef(0)
  const tokenRef = useRef('')

  const [phase, setPhase] = useState<Phase>('setup')
  const [tokenInput, setTokenInput] = useState('')
  const [hint, setHint] = useState('')
  const [readout, setReadout] = useState('')
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  function stopLoop() { if (loopRef.current) clearInterval(loopRef.current); loopRef.current = null }
  function cleanup() {
    stopLoop()
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null
    if (saved) { tokenRef.current = saved; void boot() }
    return cleanup
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function saveToken() {
    if (!tokenInput.trim()) return
    localStorage.setItem(TOKEN_KEY, tokenInput.trim())
    tokenRef.current = tokenInput.trim()
    void boot()
  }

  async function boot() {
    setPhase('loading')
    try {
      const { Human } = await import('@vladmandic/human')
      const human = new Human({
        backend: 'webgl',
        modelBasePath: 'https://vladmandic.github.io/human-models/models/',
        filter: { enabled: true, equalization: false },
        face: {
          enabled: true,
          detector: { rotation: false }, // los ángulos salen del mesh; si pierde
                                          // la cara al girar, pon rotation: true
          mesh: { enabled: true },
          description: { enabled: true },
          antispoof: { enabled: true },
          liveness: { enabled: true },
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
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play() }
      startScanning(false)
    } catch (e) {
      setOutcome({ matched: false, message: 'Error de cámara/modelos. Recarga la página.' })
      setHint(e instanceof Error ? e.message : '')
      setPhase('result')
    }
  }

  function startScanning(requireClear: boolean) {
    candidateRef.current = null
    turnedRef.current = false
    armedRef.current = !requireClear // tras una checada, espera a que el rostro salga
    setOutcome(null)
    setPhase('scanning')
    setHint('Acércate y mira a la cámara')
    stopLoop()
    loopRef.current = setInterval(scanTick, 200)
  }

  async function scanTick() {
    const human = humanRef.current, video = videoRef.current
    if (!human || !video) return
    const faces = (await human.detect(video)).face ?? []

    if (faces.length === 0) { armedRef.current = true; setReadout('sin rostro'); return }
    if (faces.length > 1) { setHint('Una persona a la vez'); return }

    const f = faces[0]
    const score = f.faceScore ?? 0, real = f.real ?? 0, live = f.live ?? 0
    const yaw = f.rotation?.angle?.yaw ?? 0
    const wRatio = f.box ? f.box[2] / video.videoWidth : 0
    setReadout(`score ${score.toFixed(2)} · real ${real.toFixed(2)} · live ${live.toFixed(2)} · yaw ${yaw.toFixed(2)}`)

    if (!armedRef.current) { setHint('Siguiente persona, por favor'); return }
    if (wRatio < MIN_FACE_WIDTH_RATIO) { setHint('Acércate más'); return }
    if (score < MIN_FACE_SCORE) { setHint('Mira de frente'); return }
    if (real < MIN_REAL) { setHint('Usa tu rostro real'); return }
    if (live < MIN_LIVE) { setHint('Mira a la cámara'); return }
    if (Math.abs(yaw) > FRONTAL_YAW_MAX) { setHint('Mira de frente'); return }
    if (!f.embedding?.length) return

    candidateRef.current = f.embedding // frame frontal bueno
    startChallenge()
  }

  function startChallenge() {
    turnedRef.current = false
    challengeStartRef.current = Date.now()
    setPhase('challenge')
    setHint('Gira la cabeza a un lado y vuelve al frente')
    stopLoop()
    loopRef.current = setInterval(challengeTick, 150)
  }

  async function challengeTick() {
    const human = humanRef.current, video = videoRef.current
    if (!human || !video) return
    if (Date.now() - challengeStartRef.current > CHALLENGE_MS) { startScanning(false); return }

    const faces = (await human.detect(video)).face ?? []
    if (faces.length !== 1) return
    const yaw = faces[0].rotation?.angle?.yaw ?? 0
    setReadout(`reto · yaw ${yaw.toFixed(2)}`)

    if (Math.abs(yaw) > TURN_YAW_MIN) { turnedRef.current = true; setHint('Ahora vuelve al frente') }
    if (turnedRef.current && Math.abs(yaw) < FRONTAL_YAW_MAX) void submit()
  }

  async function submit() {
    stopLoop()
    setPhase('matching')
    setHint('Verificando…')
    const embedding = candidateRef.current
    if (!embedding) { startScanning(false); return }
    try {
      const res = await fetch('/api/kiosk/punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceToken: tokenRef.current, embedding }),
      })
      const data = await res.json().catch(() => ({ ok: false }))
      if (res.status === 401) return showResult({ matched: false, message: 'Kiosco no autorizado' })
      if (!data.ok) return showResult({ matched: false, message: data.error ?? 'Error' })
      if (!data.matched) return showResult({ matched: false, message: 'Rostro no reconocido' })
      showResult({ matched: true, employeeName: data.employeeName, eventType: data.eventType, at: data.at })
    } catch {
      showResult({ matched: false, message: 'Sin conexión. Intenta de nuevo.' })
    }
  }

  function showResult(o: Outcome) {
    setOutcome(o)
    setPhase('result')
    setTimeout(() => startScanning(true), RESULT_MS) // re-arma exigiendo rostro despejado
  }

  if (phase === 'setup') {
    return (
      <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
        <h1 className="text-xl font-semibold">Configurar kiosco</h1>
        <p className="text-sm text-gray-600">Pega el token de este kiosco (generado en Kioscos).</p>
        <input value={tokenInput} onChange={(e) => setTokenInput(e.target.value)}
          placeholder="token del kiosco" className="rounded border px-3 py-2" />
        <button onClick={saveToken} className="rounded bg-black px-4 py-2 text-white">Activar kiosco</button>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-white">
      <video ref={videoRef} muted playsInline
        className="absolute inset-0 h-full w-full object-cover opacity-90" />
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-end gap-4 p-8 text-center">
        {phase === 'loading' && <p className="text-2xl">Iniciando…</p>}

        {(phase === 'scanning' || phase === 'challenge' || phase === 'matching') && (
          <div className="rounded-2xl bg-black/60 px-8 py-6">
            <p className="text-3xl font-semibold">{hint}</p>
            <p className="mt-2 text-xs text-white/40">{readout}</p>
          </div>
        )}

        {phase === 'result' && outcome && (
          <div className={`rounded-2xl px-10 py-8 ${outcome.matched ? 'bg-green-600' : 'bg-red-600/90'}`}>
            {outcome.matched ? (
              <>
                <p className="text-4xl font-bold">
                  {outcome.eventType === 'clock_in' ? 'Entrada' : 'Salida'} registrada
                </p>
                <p className="mt-2 text-2xl">{outcome.employeeName}</p>
                <p className="mt-1 text-lg text-white/80">
                  {outcome.at ? new Date(outcome.at).toLocaleTimeString() : ''}
                </p>
              </>
            ) : (
              <p className="text-3xl font-semibold">{outcome.message}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}