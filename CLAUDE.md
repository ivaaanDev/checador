@AGENTS.md

# Checador — contexto del proyecto

SaaS multi-tenant de asistencia por reconocimiento facial.
Stack: Next.js 16 (App Router, `proxy.ts` en lugar de middleware), Supabase (Postgres + Auth + RLS),
@vladmandic/human en el navegador, deploy en Vercel.

## Invariantes (NO romper)
- `attendance_events` es append-only: nunca UPDATE/DELETE. Las correcciones van en `attendance_corrections`.
- Los embeddings se guardan SOLO cifrados (AES-256-GCM, `lib/biometrics/crypto.ts`). Nunca imágenes ni vectores en claro.
- El match facial ocurre en el servidor (`app/api/kiosk/punch`). El navegador solo manda el embedding.
- El kiosco se autentica con token de dispositivo (hash SHA-256 en `devices.secret_hash`), no con sesión.
- `lib/supabase/admin.ts` salta RLS: toda consulta con ese cliente se acota a mano por `business_id`.
- Las horas se guardan en UTC; se muestran en `businesses.timezone`.
- `@vladmandic/human` solo se carga en el cliente (`next/dynamic` con `ssr: false`).

## Reglas de trabajo
- No leas, imprimas ni modifiques `.env*`.
- No apliques migraciones: escribe el SQL en `supabase/migrations/` y avisa.
- Verifica con `npx tsc --noEmit` y `npm run lint` antes de dar algo por terminado.
- Respuestas y comentarios en español.
