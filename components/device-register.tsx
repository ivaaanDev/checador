'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { registerDevice } from '@/app/dashboard/devices/actions'
import { CheckIcon, MonitorIcon, PlusIcon } from '@/components/icons'

export function DeviceRegister() {
  const router = useRouter()
  const [label, setLabel] = useState('')
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    setError('')
    setBusy(true)
    try {
      const res = await registerDevice(label)
      if (res.ok) {
        setToken(res.token)
        setLabel('')
        router.refresh()
      } else {
        setError(res.error)
      }
    } catch {
      setError('No se pudo registrar. Intenta de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel p-5 sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-black text-white">
          <PlusIcon className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold">Nuevo kiosco</h2>
          <p className="text-xs text-[#696963]">Ponle un nombre fácil de reconocer.</p>
        </div>
      </div>
      <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); void submit() }}>
        <div className="relative flex-1">
          <MonitorIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#96968e]" />
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Ej. Entrada principal"
            aria-label="Nombre del kiosco"
            className="field w-full pl-11"
          />
        </div>
        <button type="submit" disabled={busy || !label.trim()} className="btn-primary sm:min-w-40">
          {busy ? 'Creando…' : 'Registrar'}
        </button>
      </form>
      {error && <p className="error-note mt-3" role="alert">{error}</p>}
      {token && (
        <div className="mt-4 rounded-xl border border-black bg-black p-4 text-white">
          <p className="flex items-center gap-2 text-sm font-medium"><CheckIcon className="h-4 w-4" /> Listo. Copia el token ahora.</p>
          <p className="mt-1 text-xs text-white/55">Por seguridad, no volverá a mostrarse.</p>
          <code className="mt-4 block select-all break-all rounded-lg bg-white/10 p-3 font-mono text-xs leading-relaxed">{token}</code>
        </div>
      )}
    </section>
  )
}
