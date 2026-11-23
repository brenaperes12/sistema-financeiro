
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12

function getEncryptionKey() {
  const encodedKey = process.env.ENCRYPTION_KEY

  if (!encodedKey) {
    throw new Error(
      'A variável ENCRYPTION_KEY não está configurada no ambiente.'
    )
  }

  const key = Buffer.from(encodedKey, 'base64')

  if (
    key.length !== 32 ||
    key.toString('base64') !== encodedKey
  ) {
    throw new Error(
      'ENCRYPTION_KEY inválida. A chave deve ter 32 bytes em Base64.'
    )
  }

  return key
}

export function encryptText(value) {
  if (value === null || value === undefined) {
    return value
  }

  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)

  const cipher = createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(
    String(value),
    'utf8',
    'base64'
  )

  encrypted += cipher.final('base64')

  const authTag = cipher.getAuthTag().toString('base64')

  return [
    'v1',
    iv.toString('base64'),
    authTag,
    encrypted,
  ].join(':')
}

export function decryptText(value) {
  if (value === null || value === undefined) {
    return value
  }

  const text = String(value)

  // Permite ler registros antigos ainda não criptografados.
  if (!text.startsWith('v1:')) {
    return text
  }

  const parts = text.split(':')

  if (parts.length !== 4) {
    throw new Error('Formato de dado criptografado inválido.')
  }

  const [, ivBase64, tagBase64, encrypted] = parts

  const key = getEncryptionKey()
  const iv = Buffer.from(ivBase64, 'base64')
  const authTag = Buffer.from(tagBase64, 'base64')

  if (iv.length !== IV_LENGTH || authTag.length !== 16) {
    throw new Error('Dados criptografados inválidos.')
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv)

  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(
    encrypted,
    'base64',
    'utf8'
  )

  decrypted += decipher.final('utf8')

  return decrypted
}
