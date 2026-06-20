// components/device-register.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { registerDevice } from '@/app/dashboard/devices/actions'

export function DeviceRegister() {
  const router = useRouter()
  const [label, setLabel] = useState('')
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    setError(''); setBusy(true)
    const res = await registerDevice(label)
    setBusy(false)
    if (res.ok) { setToken(res.token); setLabel(''); router.refresh() }
    else setError(res.error)
  }

  return (
    <div className="mb-6 flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          value={label} onChange={(e) => setLabel(e.target.value)}
          placeholder="Nombre del kiosco (p. ej. Entrada motos)"
          className="flex-1 rounded border px-3 py-2"
        />
        <button onClick={submit} disabled={busy}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50">
          {busy ? 'Creando…' : 'Registrar kiosco'}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {token && (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">
          <p className="font-medium text-amber-800">
            Token del kiosco (cópialo ahora, no se vuelve a mostrar):
          </p>
          <code className="mt-1 block break-all rounded bg-white p-2 text-xs">{token}</code>
        </div>
      )}
    </div>
  )
}