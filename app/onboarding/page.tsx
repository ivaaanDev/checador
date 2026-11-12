import { createBusiness } from './actions'
import { ArrowUpRightIcon, BuildingIcon, MarkIcon } from '@/components/icons'

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <main className="auth-shell">
      <section className="auth-intro">
        <div className="brand">
          <span className="brand-mark"><MarkIcon /></span>
          <span>checador.</span>
        </div>
        <h1 className="auth-statement">Vamos a poner esto en marcha.</h1>
        <p className="auth-footnote">Solo necesitamos dos datos. Lo demás viene después.</p>
      </section>

      <section className="auth-form-wrap">
        <div className="auth-form">
          <span className="mb-5 grid h-10 w-10 place-items-center rounded-full bg-black text-white">
            <BuildingIcon className="h-4 w-4" />
          </span>
          <p className="eyebrow mb-3">Primer paso</p>
          <h2 className="text-3xl font-semibold tracking-[-0.05em]">¿Cómo se llama tu negocio?</h2>
          <p className="mt-2 text-sm text-[#696963]">Así lo verá todo tu equipo.</p>

          {error && <p className="error-note mt-6" role="alert">{error}</p>}

          <form className="mt-8 flex flex-col gap-4">
            <label className="flex flex-col gap-2 text-xs font-medium">
              Nombre
              <input name="name" placeholder="Ej. Koko's Pizza" required autoFocus className="field" />
            </label>
            <label className="flex flex-col gap-2 text-xs font-medium">
              Zona horaria
              <input name="timezone" defaultValue="America/Mexico_City" className="field font-mono text-sm" />
            </label>
            <button formAction={createBusiness} className="btn-primary mt-2 w-full">
              Crear mi espacio <ArrowUpRightIcon />
            </button>
          </form>
        </div>
      </section>
    </main>
  )
}
