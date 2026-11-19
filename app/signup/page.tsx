import Link from 'next/link'
import { signup } from './actions'
import { ArrowUpRightIcon, LockIcon, MarkIcon } from '@/components/icons'

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

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
          <p className="eyebrow mb-3">Cuenta nueva</p>
          <h2 className="text-3xl font-semibold tracking-[-0.05em]">Empecemos.</h2>
          <p className="mt-2 text-sm text-[#696963]">Crea tu cuenta para registrar tu negocio.</p>

          {error && <p className="error-note mt-6" role="alert">{error}</p>}

          <form action={signup} className="mt-8 flex flex-col gap-3">
            <label className="flex flex-col gap-2 text-xs font-medium">
              Correo
              <input
                name="email"
                type="email"
                placeholder="tu@correo.com"
                autoComplete="email"
                required
                className="field"
              />
            </label>
            <label className="flex flex-col gap-2 text-xs font-medium">
              Contraseña
              <input
                name="password"
                type="password"
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
                minLength={8}
                required
                className="field"
              />
            </label>
            <label className="flex flex-col gap-2 text-xs font-medium">
              Confirmar contraseña
              <input
                name="confirmPassword"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                minLength={8}
                required
                className="field"
              />
            </label>
            <button type="submit" className="btn-primary mt-2 w-full">
              Crear cuenta <ArrowUpRightIcon />
            </button>
            <Link href="/login" className="btn-secondary w-full">
              Ya tengo cuenta
            </Link>
          </form>
        </div>
      </section>
    </main>
  )
}
