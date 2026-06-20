import 'server-only'
import { createClient } from '@supabase/supabase-js'

// Cliente con la llave secreta: SALTA RLS. Solo en código de servidor.
// Cada consulta DEBE acotarse manualmente al business_id validado por el token.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false } },
  )
}