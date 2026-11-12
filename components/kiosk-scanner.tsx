// components/kiosk-scanner.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckIcon, MarkIcon, RefreshIcon } from '@/components/icons'

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

// Si calibraste estos valores en las pruebas, CONSERVA los tuyos.
const MIN_FACE_SCORE = 0.6
const MIN_REAL = 0.8
const MIN_LIVE = 0.75
const MIN_FACE_WIDTH_RATIO = 0.25
const FRONTAL_YAW_MAX = 0.18
const TURN_YAW_MIN = 0.45
const CHALLENGE_MS = 7000
const RESULT_MS = 3500
const TOKEN_KEY = 'kioskDeviceToken'

type Phase = 'setup' | 'loading' | 'scanning' | 'challenge' | 'matching' | 'result'
type Outcome = {
  matched: boolean
  duplicate?: boolean
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
  const resultTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const candidateRef = useRef<number[] | null>(null)
  const turnedRef = useRef(false)
  const armedRef = useRef(true)
  const challengeStartRef = useRef(0)
  const tokenRef = useRef('')

  const [phase, setPhase] = useState<Phase>('setup')
  const [tokenInput, setTokenInput] = useState('')
  const [hint, setHint] = useState('')
  const [readout, setReadout] = useState('')
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  function stopLoop() { if (loopRef.current) clearInterval(loopRef.current); loopRef.current = null }
  function clearResultTimer() { if (resultTimeoutRef.current) clearTimeout(resultTimeoutRef.current); resultTimeoutRef.current = null }
  function cleanup() {
    stopLoop()
    clearResultTimer()
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }


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
          detector: { rotation: false },
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
    clearResultTimer()
    candidateRef.current = null
    turnedRef.current = false
    armedRef.current = !requireClear
    setOutcome(null)
    setPhase('scanning')
    setHint('Acércate y mira a la cámara')
    stopLoop()
    loopRef.current = setInterval(scanTick, 200)
  }

  // Botón "Siguiente / Reiniciar": vuelve a escanear de inmediato, listo para
  // la siguiente persona, sin esperar el ciclo automático. El cooldown del
  // servidor sigue evitando que se duplique a la MISMA persona.
  function manualReset() {
    if (!humanRef.current) return
    startScanning(false)
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

    candidateRef.current = f.embedding
    startChallenge()
  }

  function startChallenge() {
    turnedRef.current = false
    // The challenge needs an elapsed-time deadline independent of React renders.
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
      if (data.duplicate) return showResult({ matched: true, duplicate: true, employeeName: data.employeeName })
      if (!data.matched) return showResult({ matched: false, message: 'Rostro no reconocido' })
      showResult({ matched: true, employeeName: data.employeeName, eventType: data.eventType, at: data.at })
    } catch {
      showResult({ matched: false, message: 'Sin conexión. Intenta de nuevo.' })
    }
  }

  function showResult(o: Outcome) {
    setOutcome(o)
    setPhase('result')
    clearResultTimer()
    resultTimeoutRef.current = setTimeout(() => startScanning(true), RESULT_MS)
  }

  useEffect(() => {
    const saved = localStorage.getItem(TOKEN_KEY)
    if (saved) {
      tokenRef.current = saved
      void boot()
    }
    return cleanup
    // Camera boot should only run once when the kiosk mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (phase === 'setup') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7f3] p-6">
        <div className="w-full max-w-md animate-[page-in_500ms_ease-out_both]">
          <span className="mb-8 grid h-12 w-12 place-items-center rounded-full bg-black text-white"><MarkIcon className="h-5 w-5" /></span>
          <p className="eyebrow mb-3">Una sola vez</p>
          <h1 className="text-4xl font-semibold tracking-[-0.06em]">Activa este kiosco.</h1>
          <p className="mt-4 text-sm leading-relaxed text-[#696963]">Pega el token que creaste desde la sección Kioscos.</p>
          <form className="mt-8 flex flex-col gap-3" onSubmit={(event) => { event.preventDefault(); saveToken() }}>
            <input value={tokenInput} onChange={(event) => setTokenInput(event.target.value)}
              placeholder="Token del kiosco" aria-label="Token del kiosco" className="field font-mono text-sm" />
            <button type="submit" disabled={!tokenInput.trim()} className="btn-primary">Activar y empezar</button>
          </form>
        </div>
      </main>
    )
  }

  const isActive = phase === 'scanning' || phase === 'challenge' || phase === 'matching'

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <video ref={videoRef} muted playsInline className="absolute inset-0 h-full w-full scale-x-[-1] object-cover opacity-75" />
      <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-black/45 via-transparent to-black/80" />
      <div className="pointer-events-none absolute inset-[10%] rounded-[42%] border border-white/45 shadow-[0_0_0_999px_rgba(0,0,0,.12)] sm:inset-[12%_30%]" />
      {phase === 'scanning' && <div className="pointer-events-none absolute inset-x-[10%] top-[10%] h-px animate-[scan-line_2.4s_ease-in-out_infinite] bg-white/70 shadow-[0_0_12px_white] sm:inset-x-[30%]" />}

      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between p-5 sm:p-8">
        <div className="brand p-0 text-white"><span className="brand-mark bg-white text-black"><MarkIcon /></span><span>checador.</span></div>
        {phase !== 'loading' && (
          <button onClick={manualReset} aria-label="Escanear a la siguiente persona" className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/40 px-4 py-2.5 text-sm font-medium text-white backdrop-blur-md transition hover:bg-white hover:text-black active:scale-95">
            <RefreshIcon className="h-4 w-4" /> <span className="hidden sm:inline">Siguiente</span>
          </button>
        )}
      </div>

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-end p-6 pb-10 text-center sm:p-10">
        {phase === 'loading' && (
          <div className="flex flex-col items-center gap-4">
            <span className="animate-[breathe_1.6s_ease-in-out_infinite] rounded-full border border-white/30 p-5"><MarkIcon className="h-6 w-6" /></span>
            <p className="text-sm text-white/60">Preparando la cámara…</p>
          </div>
        )}

        {isActive && (
          <div className="w-full max-w-2xl" role="status" aria-live="polite"><div className="rounded-2xl border border-white/15 bg-black/55 px-6 py-5 backdrop-blur-xl sm:px-10 sm:py-7">
            <p className="text-2xl font-semibold tracking-[-0.04em] sm:text-4xl">{hint}</p>
            <p className="mt-3 font-mono text-[9px] text-white/35">{readout}</p>
          </div></div>
        )}

        {phase === 'result' && outcome && (
          <div role="status" aria-live="assertive" className={`w-full max-w-2xl animate-[page-in_300ms_ease-out_both] rounded-2xl border px-8 py-8 backdrop-blur-xl sm:px-12 sm:py-10 ${
            outcome.matched ? 'border-white/20 bg-white text-black' : 'border-white/15 bg-black/75 text-white'
          }`}>
            <span className={`mx-auto mb-5 grid h-12 w-12 place-items-center rounded-full ${outcome.matched ? 'bg-black text-white' : 'border border-white/25'}`}>
              {outcome.matched ? <CheckIcon className="h-5 w-5" /> : <RefreshIcon className="h-5 w-5" />}
            </span>
            {outcome.duplicate ? (
              <><p className="text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">Ya quedó registrado.</p><p className="mt-2 text-lg opacity-60">{outcome.employeeName}</p></>
            ) : outcome.matched ? (
              <>
                <p className="eyebrow mb-3">{outcome.eventType === 'clock_in' ? 'Entrada' : 'Salida'}</p>
                <p className="text-3xl font-semibold tracking-tighter sm:text-5xl">Listo, {outcome.employeeName}.</p>
                <p className="mt-3 font-mono text-sm opacity-55">{outcome.at ? new Date(outcome.at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : ''}</p>
              </>
            ) : (
              <><p className="text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">{outcome.message}</p><p className="mt-3 text-sm text-white/50">Vamos a intentarlo otra vez.</p></>
            )}
          </div>
        )}
      </div>
    </main>
  )
}