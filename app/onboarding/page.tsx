import { createBusiness } from './actions'

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-xl font-semibold">Crea tu negocio</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <form className="flex flex-col gap-3">
        <input
          name="name" placeholder="Nombre (p. ej. Koko's Pizza)" required
          className="rounded border px-3 py-2"
        />
        <input
          name="timezone" defaultValue="America/Mexico_City"
          className="rounded border px-3 py-2"
        />
        <button formAction={createBusiness} className="rounded bg-black px-3 py-2 text-white">
          Crear negocio
        </button>
      </form>
    </main>
  )
}