import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FaceEnrollment } from '@/components/face-enrollment-client'
import { ArrowLeftIcon, CameraIcon } from '@/components/icons'

export default async function EnrollPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: employee } = await supabase
    .from('employees').select('id, full_name').eq('id', id).single()
  if (!employee) notFound()

  return (
    <main className="dashboard-page max-w-4xl">
      <Link href="/dashboard/employees" className="btn-quiet mb-8 w-fit px-0 hover:bg-transparent">
        <ArrowLeftIcon /> Equipo
      </Link>
      <header className="mb-8">
        <p className="eyebrow mb-4">Cámara</p>
        <h1 className="page-title">Mira aquí, {employee.full_name.split(' ')[0]}.</h1>
        <p className="page-copy mt-5">Busquemos buena luz y un encuadre claro. Toma unos segundos.</p>
      </header>
      <div className="panel overflow-hidden p-3 sm:p-5">
        <div className="mb-4 flex items-center gap-3 px-1 pt-1">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-black text-white"><CameraIcon className="h-4 w-4" /></span>
          <div><p className="text-sm font-semibold">Rostro de {employee.full_name}</p><p className="text-xs text-[#696963]">Solo se guarda la plantilla biométrica.</p></div>
        </div>
        <FaceEnrollment employeeId={employee.id} employeeName={employee.full_name} />
      </div>
    </main>
  )
}
