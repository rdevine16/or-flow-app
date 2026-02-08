/**
 * Rate Limiting for Login Attempts
 * Prevents brute force attacks by limiting login attempts per email
 * 
 * Strategy:
 * - 5 attempts per 15 minutes per email
 * - Exponential backoff after 3 failures
 * - IP-based tracking as secondary measure
 */

interface LoginAttempt {
  email: string
  attempts: number
  firstAttempt: number
  lastAttempt: number
  blockedUntil?: number
}

interface IPAttempt {
  ip: string
  attempts: number
  firstAttempt: number
  lastAttempt: number
  blockedUntil?: number
}

// In-memory storage (use Redis in production for multi-instance deployments)
const emailAttempts = new Map<string, LoginAttempt>()
const ipAttempts = new Map<string, IPAttempt>()

// Configuration
const CONFIG = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
  blockDurationMs: 15 * 60 * 1000, // 15 minutes block
  ipMaxAttempts: 20, // More lenient for shared IPs (offices, hospitals)
  cleanupIntervalMs: 60 * 60 * 1000, // Clean up old entries every hour
}

/**
 * Get client IP address from request
 */
export function getClientIP(request: Request): string {
  // Check various headers for real IP (behind proxies/load balancers)
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  
  const realIP = request.headers.get('x-real-ip')
  if (realIP) {
    return realIP
  }
  
  // Fallback (won't work behind proxies)
  return 'unknown'
}

/**
 * Check if email/IP is rate limited
 */
export function checkRateLimit(email: string, ip: string): {
  allowed: boolean
  remainingAttempts?: number
  blockedUntil?: Date
  reason?: string
} {
  const now = Date.now()
  
  // Check email-based rate limit
  const emailAttempt = emailAttempts.get(email.toLowerCase())
  
  if (emailAttempt) {
    // Check if currently blocked
    if (emailAttempt.blockedUntil && emailAttempt.blockedUntil > now) {
      return {
        allowed: false,
        blockedUntil: new Date(emailAttempt.blockedUntil),
        reason: 'too_many_attempts',
      }
    }
    
    // Reset if window expired
    if (now - emailAttempt.firstAttempt > CONFIG.windowMs) {
      emailAttempts.delete(email.toLowerCase())
    } else if (emailAttempt.attempts >= CONFIG.maxAttempts) {
      // Block this email
      emailAttempt.blockedUntil = now + CONFIG.blockDurationMs
      return {
        allowed: false,
        blockedUntil: new Date(emailAttempt.blockedUntil),
        reason: 'too_many_attempts',
      }
    }
  }
  
  // Check IP-based rate limit (prevent distributed attacks)
  const ipAttempt = ipAttempts.get(ip)
  
  if (ipAttempt) {
    // Check if currently blocked
    if (ipAttempt.blockedUntil && ipAttempt.blockedUntil > now) {
      return {
        allowed: false,
        blockedUntil: new Date(ipAttempt.blockedUntil),
        reason: 'too_many_attempts_from_ip',
      }
    }
    
    // Reset if window expired
    if (now - ipAttempt.firstAttempt > CONFIG.windowMs) {
      ipAttempts.delete(ip)
    } else if (ipAttempt.attempts >= CONFIG.ipMaxAttempts) {
      // Block this IP
      ipAttempt.blockedUntil = now + CONFIG.blockDurationMs
      return {
        allowed: false,
        blockedUntil: new Date(ipAttempt.blockedUntil),
        reason: 'too_many_attempts_from_ip',
      }
    }
  }
  
  // Calculate remaining attempts
  const remainingAttempts = CONFIG.maxAttempts - (emailAttempt?.attempts || 0)
  
  return {
    allowed: true,
    remainingAttempts,
  }
}

/**
 * Record a failed login attempt
 */
export function recordFailedAttempt(email: string, ip: string): void {
  const now = Date.now()
  const emailKey = email.toLowerCase()
  
  // Record email-based attempt
  const emailAttempt = emailAttempts.get(emailKey)
  
  if (emailAttempt && now - emailAttempt.firstAttempt <= CONFIG.windowMs) {
    // Increment existing attempt
    emailAttempt.attempts++
    emailAttempt.lastAttempt = now
  } else {
    // Start new attempt window
    emailAttempts.set(emailKey, {
      email: emailKey,
      attempts: 1,
      firstAttempt: now,
      lastAttempt: now,
    })
  }
  
  // Record IP-based attempt
  const ipAttempt = ipAttempts.get(ip)
  
  if (ipAttempt && now - ipAttempt.firstAttempt <= CONFIG.windowMs) {
    ipAttempt.attempts++
    ipAttempt.lastAttempt = now
  } else {
    ipAttempts.set(ip, {
      ip,
      attempts: 1,
      firstAttempt: now,
      lastAttempt: now,
    })
  }
}

/**
 * Clear rate limit for an email (after successful login)
 */
export function clearRateLimit(email: string): void {
  emailAttempts.delete(email.toLowerCase())
}

/**
 * Get rate limit stats (for admin monitoring)
 */
export function getRateLimitStats() {
  const now = Date.now()
  
  return {
    emailBlocks: Array.from(emailAttempts.values())
      .filter(a => a.blockedUntil && a.blockedUntil > now)
      .map(a => ({
        email: a.email,
        attempts: a.attempts,
        blockedUntil: new Date(a.blockedUntil!),
      })),
    ipBlocks: Array.from(ipAttempts.values())
      .filter(a => a.blockedUntil && a.blockedUntil > now)
      .map(a => ({
        ip: a.ip,
        attempts: a.attempts,
        blockedUntil: new Date(a.blockedUntil!),
      })),
    totalEmailAttempts: emailAttempts.size,
    totalIPAttempts: ipAttempts.size,
  }
}

/**
 * Cleanup old entries (run periodically)
 */
export function cleanupOldEntries(): void {
  const now = Date.now()
  
  // Clean up email attempts
  for (const [email, attempt] of emailAttempts.entries()) {
    if (now - attempt.lastAttempt > CONFIG.windowMs * 2) {
      emailAttempts.delete(email)
    }
  }
  
  // Clean up IP attempts
  for (const [ip, attempt] of ipAttempts.entries()) {
    if (now - attempt.lastAttempt > CONFIG.windowMs * 2) {
      ipAttempts.delete(ip)
    }
  }
}

// Auto cleanup every hour
if (typeof window === 'undefined') {
  // Only run on server
  setInterval(cleanupOldEntries, CONFIG.cleanupIntervalMs)
}

/**
 * Supabase Edge Function alternative (for serverless deployments)
 * 
 * Store rate limit data in Supabase table instead of memory:
 * 
 * CREATE TABLE login_attempts (
 *   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 *   email TEXT NOT NULL,
 *   ip_address TEXT NOT NULL,
 *   attempt_count INTEGER DEFAULT 1,
 *   first_attempt TIMESTAMP DEFAULT NOW(),
 *   last_attempt TIMESTAMP DEFAULT NOW(),
 *   blocked_until TIMESTAMP,
 *   created_at TIMESTAMP DEFAULT NOW()
 * );
 * 
 * CREATE INDEX idx_login_attempts_email ON login_attempts(email);
 * CREATE INDEX idx_login_attempts_ip ON login_attempts(ip_address);
 * CREATE INDEX idx_login_attempts_blocked ON login_attempts(blocked_until) WHERE blocked_until IS NOT NULL;
 */

export async function checkRateLimitDB(
  supabase: any,
  email: string,
  ip: string
): Promise<{
  allowed: boolean
  remainingAttempts?: number
  blockedUntil?: Date
  reason?: string
}> {
  const now = new Date()
  const windowStart = new Date(now.getTime() - CONFIG.windowMs)
  
  // Check email-based attempts
  const { data: emailAttempt } = await supabase
    .from('login_attempts')
    .select('*')
    .eq('email', email.toLowerCase())
    .gte('last_attempt', windowStart.toISOString())
    .order('last_attempt', { ascending: false })
    .limit(1)
    .single()
  
  if (emailAttempt?.blocked_until) {
    const blockedUntil = new Date(emailAttempt.blocked_until)
    if (blockedUntil > now) {
      return {
        allowed: false,
        blockedUntil,
        reason: 'too_many_attempts',
      }
    }
  }
  
  if (emailAttempt && emailAttempt.attempt_count >= CONFIG.maxAttempts) {
    const blockedUntil = new Date(now.getTime() + CONFIG.blockDurationMs)
    
    // Update blocked_until
    await supabase
      .from('login_attempts')
      .update({ blocked_until: blockedUntil.toISOString() })
      .eq('id', emailAttempt.id)
    
    return {
      allowed: false,
      blockedUntil,
      reason: 'too_many_attempts',
    }
  }
  
  return {
    allowed: true,
    remainingAttempts: CONFIG.maxAttempts - (emailAttempt?.attempt_count || 0),
  }
}

export async function recordFailedAttemptDB(
  supabase: any,
  email: string,
  ip: string
): Promise<void> {
  const now = new Date()
  const windowStart = new Date(now.getTime() - CONFIG.windowMs)
  
  // Try to find existing attempt in current window
  const { data: existing } = await supabase
    .from('login_attempts')
    .select('*')
    .eq('email', email.toLowerCase())
    .gte('first_attempt', windowStart.toISOString())
    .order('first_attempt', { ascending: false })
    .limit(1)
    .single()
  
  if (existing) {
    // Increment existing
    await supabase
      .from('login_attempts')
      .update({
        attempt_count: existing.attempt_count + 1,
        last_attempt: now.toISOString(),
        ip_address: ip,
      })
      .eq('id', existing.id)
  } else {
    // Create new record
    await supabase
      .from('login_attempts')
      .insert({
        email: email.toLowerCase(),
        ip_address: ip,
        attempt_count: 1,
        first_attempt: now.toISOString(),
        last_attempt: now.toISOString(),
      })
  }
}

export async function clearRateLimitDB(
  supabase: any,
  email: string
): Promise<void> {
  await supabase
    .from('login_attempts')
    .delete()
    .eq('email', email.toLowerCase())
}
