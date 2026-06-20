import { login, signup } from './actions'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-xl font-semibold">Checador · Acceso</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <form className="flex flex-col gap-3">
        <input
          name="email" type="email" placeholder="correo" required
          className="rounded border px-3 py-2"
        />
        <input
          name="password" type="password" placeholder="contraseña" required
          className="rounded border px-3 py-2"
        />
        <div className="flex gap-2">
          <button formAction={login} className="flex-1 rounded bg-black px-3 py-2 text-white">
            Iniciar sesión
          </button>
          <button formAction={signup} className="flex-1 rounded border px-3 py-2">
            Crear cuenta
          </button>
        </div>
      </form>
    </main>
  )
}