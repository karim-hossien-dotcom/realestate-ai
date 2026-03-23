/**
 * AES-256-GCM encryption for sensitive data (CRM API keys, etc.)
 *
 * Uses a server-side encryption key from ENCRYPTION_KEY env var.
 * Format: base64(iv:authTag:ciphertext)
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // GCM standard
const TAG_LENGTH = 16

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set')
  }
  // Key must be 32 bytes (256 bits). Accept hex or base64.
  if (key.length === 64) {
    return Buffer.from(key, 'hex')
  }
  const buf = Buffer.from(key, 'base64')
  if (buf.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex chars or 44 base64 chars)')
  }
  return buf
}

/**
 * Encrypt a string using AES-256-GCM.
 * Returns a base64 string containing iv:tag:ciphertext.
 */
export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, 'utf8')
  encrypted = Buffer.concat([encrypted, cipher.final()])

  const tag = cipher.getAuthTag()

  // Pack iv + tag + ciphertext into a single base64 string
  const packed = Buffer.concat([iv, tag, encrypted])
  return packed.toString('base64')
}

/**
 * Decrypt a string encrypted with encrypt().
 * Input is base64 string containing iv:tag:ciphertext.
 */
export function decrypt(encoded: string): string {
  const key = getKey()
  const packed = Buffer.from(encoded, 'base64')

  if (packed.length < IV_LENGTH + TAG_LENGTH + 1) {
    throw new Error('Invalid encrypted data: too short')
  }

  const iv = packed.subarray(0, IV_LENGTH)
  const tag = packed.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const ciphertext = packed.subarray(IV_LENGTH + TAG_LENGTH)

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  let decrypted = decipher.update(ciphertext)
  decrypted = Buffer.concat([decrypted, decipher.final()])

  return decrypted.toString('utf8')
}

/**
 * Check if a string looks like it's already encrypted (base64 with correct length).
 */
export function isEncrypted(value: string): boolean {
  try {
    const buf = Buffer.from(value, 'base64')
    return buf.length >= IV_LENGTH + TAG_LENGTH + 1 && value !== buf.toString('utf8')
  } catch {
    return false
  }
}
