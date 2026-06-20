import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FaceEnrollment } from '@/components/face-enrollment-client'

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
    <main className="mx-auto max-w-xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Enrolar rostro</h1>
        <Link href="/dashboard/employees" className="text-sm text-gray-600 underline">← Empleados</Link>
      </div>
      <p className="mb-4 text-sm text-gray-600">
        Empleado: <strong>{employee.full_name}</strong>
      </p>
      <FaceEnrollment employeeId={employee.id} employeeName={employee.full_name} />
    </main>
  )
}