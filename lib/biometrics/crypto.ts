import 'server-only'
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGO = 'aes-256-gcm'
const IV_LEN = 12
const TAG_LEN = 16

function getKey(): Buffer {
  const b64 = process.env.BIOMETRIC_ENC_KEY
  if (!b64) throw new Error('Falta BIOMETRIC_ENC_KEY')
  const key = Buffer.from(b64, 'base64')
  if (key.length !== 32) throw new Error('BIOMETRIC_ENC_KEY debe ser 32 bytes en base64')
  return key
}

// Serializa el vector a bytes, lo cifra, y devuelve base64 de: iv | authTag | ciphertext
export function encryptEmbedding(embedding: number[]): string {
  const plaintext = Buffer.from(Float32Array.from(embedding).buffer)
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALGO, getKey(), iv)
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, ct]).toString('base64')
}

export function decryptEmbedding(payload: string): number[] {
  const buf = Buffer.from(payload, 'base64')
  const iv = buf.subarray(0, IV_LEN)
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN)
  const ct = buf.subarray(IV_LEN + TAG_LEN)
  const decipher = createDecipheriv(ALGO, getKey(), iv)
  decipher.setAuthTag(tag)
  const out = Buffer.concat([decipher.update(ct), decipher.final()])
  return Array.from(new Float32Array(out.buffer, out.byteOffset, out.byteLength / 4))
}