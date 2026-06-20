-- =============================================================================
-- Embedding storage: bytea -> text (base64)  (Phase 1B)
-- =============================================================================
-- Al implementar el enrolamiento guardamos el embedding CIFRADO como base64 en
-- texto. Sobre la API REST de Supabase, texto es mucho más robusto que bytea
-- para un blob opaco (evita el manejo del prefijo \x y conversiones de ida y
-- vuelta). La tabla está vacía, así que el cambio de tipo es trivial.
--
-- El contenido del campo sigue siendo el mismo principio de seguridad:
--   base64( AES-256-GCM( iv | authTag | ciphertext ) )
-- nunca la imagen del rostro, solo el vector cifrado. RLS sigue aplicando.
-- =============================================================================

alter table biometric_templates
  alter column embedding type text using encode(embedding, 'base64');