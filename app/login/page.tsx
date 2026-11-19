import Link from 'next/link'
import { login } from './actions'
import { ArrowUpRightIcon, LockIcon, MarkIcon } from '@/components/icons'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>
}) {
  const { error, message } = await searchParams

  return (
    <main className="auth-shell">
      <section className="auth-intro">
        <Link href="/login" className="brand" aria-label="Checador">
          <span className="brand-mark"><MarkIcon /></span>
          <span>checador.</span>
        </Link>
        <h1 className="auth-statement">Llegar. Checar. Listo.</h1>
        <p className="auth-footnote">Menos hojas. Menos vueltas. Más tiempo.</p>
      </section>

      <section className="auth-form-wrap">
        <div className="auth-form">
          <span className="mb-5 grid h-10 w-10 place-items-center rounded-full bg-black text-white">
            <LockIcon className="h-4 w-4" />
          </span>
          <p className="eyebrow mb-3">Tu espacio</p>
          <h2 className="text-3xl font-semibold tracking-[-0.05em]">Qué bueno verte.</h2>
          <p className="mt-2 text-sm text-[#696963]">Entra para ver cómo va el equipo.</p>

          {error && <p className="error-note mt-6" role="alert">{error}</p>}
          {message && !error && (
            <p className="mt-6 rounded-xl border border-[#deded7] bg-white p-3 text-sm text-[#3f3f3a]" role="status">{message}</p>
          )}

          <form action={login} className="mt-8 flex flex-col gap-3">
            <label className="flex flex-col gap-2 text-xs font-medium">
              Correo
              <input name="email" type="email" placeholder="tu@correo.com" autoComplete="email" required className="field" />
            </label>
            <label className="flex flex-col gap-2 text-xs font-medium">
              Contraseña
              <input name="password" type="password" placeholder="••••••••" autoComplete="current-password" required className="field" />
            </label>
            <button type="submit" className="btn-primary mt-2 w-full">
              Entrar <ArrowUpRightIcon />
            </button>
            <Link href="/signup" className="btn-secondary w-full">
              Soy nuevo, crear cuenta
            </Link>
          </form>
        </div>
      </section>
    </main>
  )
}
