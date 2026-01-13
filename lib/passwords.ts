// lib/passwords.ts
// Secure password generation utilities

/**
 * Character sets for password generation
 */
const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz'
const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const NUMBERS = '0123456789'
const SYMBOLS = '!@#$%^&*()-_=+[]{}|;:,.<>?'

// Exclude ambiguous characters (0, O, l, 1, I) for better readability
const LOWERCASE_SAFE = 'abcdefghjkmnpqrstuvwxyz'
const UPPERCASE_SAFE = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const NUMBERS_SAFE = '23456789'

export interface PasswordOptions {
  length?: number
  includeLowercase?: boolean
  includeUppercase?: boolean
  includeNumbers?: boolean
  includeSymbols?: boolean
  excludeAmbiguous?: boolean
}

/**
 * Generate a cryptographically secure random password
 */
export function generatePassword(options: PasswordOptions = {}): string {
  const {
    length = 16,
    includeLowercase = true,
    includeUppercase = true,
    includeNumbers = true,
    includeSymbols = true,
    excludeAmbiguous = true,
  } = options

  // Build character set
  let charset = ''
  const requiredChars: string[] = []

  if (includeLowercase) {
    const set = excludeAmbiguous ? LOWERCASE_SAFE : LOWERCASE
    charset += set
    requiredChars.push(getRandomChar(set))
  }

  if (includeUppercase) {
    const set = excludeAmbiguous ? UPPERCASE_SAFE : UPPERCASE
    charset += set
    requiredChars.push(getRandomChar(set))
  }

  if (includeNumbers) {
    const set = excludeAmbiguous ? NUMBERS_SAFE : NUMBERS
    charset += set
    requiredChars.push(getRandomChar(set))
  }

  if (includeSymbols) {
    charset += SYMBOLS
    requiredChars.push(getRandomChar(SYMBOLS))
  }

  if (charset.length === 0) {
    throw new Error('At least one character type must be included')
  }

  // Generate password with required characters + random fill
  const remainingLength = length - requiredChars.length
  const randomChars: string[] = []

  for (let i = 0; i < remainingLength; i++) {
    randomChars.push(getRandomChar(charset))
  }

  // Combine and shuffle
  const allChars = [...requiredChars, ...randomChars]
  return shuffleArray(allChars).join('')
}

/**
 * Generate a simple, human-readable temporary password
 * Good for initial passwords that will be changed
 */
export function generateTemporaryPassword(): string {
  return generatePassword({
    length: 12,
    includeLowercase: true,
    includeUppercase: true,
    includeNumbers: true,
    includeSymbols: false, // Easier to type
    excludeAmbiguous: true,
  })
}

/**
 * Generate a strong password for admin/sensitive accounts
 */
export function generateStrongPassword(): string {
  return generatePassword({
    length: 20,
    includeLowercase: true,
    includeUppercase: true,
    includeNumbers: true,
    includeSymbols: true,
    excludeAmbiguous: false,
  })
}

/**
 * Generate a memorable passphrase
 * Format: Word-Word-Word-Number (e.g., "Apple-River-Cloud-42")
 */
export function generatePassphrase(): string {
  const words = [
    'Apple', 'River', 'Cloud', 'Tiger', 'Ocean', 'Eagle', 'Mountain', 'Forest',
    'Storm', 'Sunset', 'Thunder', 'Valley', 'Crystal', 'Silver', 'Golden', 'Diamond',
    'Maple', 'Cedar', 'Willow', 'Coral', 'Aurora', 'Galaxy', 'Phoenix', 'Dragon',
    'Falcon', 'Panther', 'Shadow', 'Mystic', 'Spirit', 'Voyage', 'Harbor', 'Summit',
    'Breeze', 'Meadow', 'Prairie', 'Canyon', 'Glacier', 'Cascade', 'Horizon', 'Zenith',
  ]

  const word1 = words[getRandomInt(words.length)]
  const word2 = words[getRandomInt(words.length)]
  const word3 = words[getRandomInt(words.length)]
  const number = getRandomInt(100)

  return `${word1}-${word2}-${word3}-${number}`
}

/**
 * Generate a secure invitation token
 */
export function generateInvitationToken(): string {
  const charset = LOWERCASE_SAFE + NUMBERS_SAFE
  let token = ''
  for (let i = 0; i < 32; i++) {
    token += getRandomChar(charset)
  }
  return token
}

/**
 * Check password strength
 * Returns a score from 0-100 and feedback
 */
export function checkPasswordStrength(password: string): {
  score: number
  feedback: string[]
  level: 'weak' | 'fair' | 'good' | 'strong'
} {
  const feedback: string[] = []
  let score = 0

  // Length checks
  if (password.length >= 8) score += 10
  if (password.length >= 12) score += 15
  if (password.length >= 16) score += 10
  if (password.length < 8) feedback.push('Use at least 8 characters')

  // Character type checks
  if (/[a-z]/.test(password)) score += 10
  else feedback.push('Add lowercase letters')

  if (/[A-Z]/.test(password)) score += 15
  else feedback.push('Add uppercase letters')

  if (/[0-9]/.test(password)) score += 15
  else feedback.push('Add numbers')

  if (/[^a-zA-Z0-9]/.test(password)) score += 20
  else feedback.push('Add special characters')

  // Variety bonus
  const uniqueChars = new Set(password).size
  if (uniqueChars >= password.length * 0.7) score += 5

  // Penalty for common patterns
  if (/^[a-zA-Z]+$/.test(password)) score -= 10
  if (/^[0-9]+$/.test(password)) score -= 20
  if (/(.)\1{2,}/.test(password)) {
    score -= 10
    feedback.push('Avoid repeated characters')
  }
  if (/^(password|123456|qwerty)/i.test(password)) {
    score -= 30
    feedback.push('Avoid common passwords')
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score))

  // Determine level
  let level: 'weak' | 'fair' | 'good' | 'strong'
  if (score < 30) level = 'weak'
  else if (score < 50) level = 'fair'
  else if (score < 75) level = 'good'
  else level = 'strong'

  return { score, feedback, level }
}

// --- Helper functions ---

/**
 * Get a cryptographically secure random character from a string
 */
function getRandomChar(charset: string): string {
  return charset[getRandomInt(charset.length)]
}

/**
 * Get a cryptographically secure random integer
 */
function getRandomInt(max: number): number {
  // Use crypto API if available (browser or Node 19+)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint32Array(1)
    crypto.getRandomValues(array)
    return array[0] % max
  }
  // Fallback to Math.random (less secure, but works everywhere)
  return Math.floor(Math.random() * max)
}

/**
 * Shuffle an array using Fisher-Yates algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = getRandomInt(i + 1)
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
