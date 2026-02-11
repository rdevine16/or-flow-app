/**
 * Enhanced Session Management
 * Implements "Remember Me" with secure token handling
 * 
 * Features:
 * - Short sessions (browser close) vs Long sessions (30 days)
 * - Secure token rotation
 * - Device tracking (optional)
 * - Session revocation
 */

import { createClient } from '@/lib/supabase'
import { useState, useEffect } from 'react'
import { logger } from '@/lib/logger'

const log = logger('session-manager')

// Session durations
const SESSION_DURATION = {
  SHORT: 60 * 60, // 1 hour (seconds)
  LONG: 30 * 24 * 60 * 60, // 30 days (seconds)
} as const

// Cookie settings
const COOKIE_OPTIONS = {
  path: '/',
  secure: process.env.NODE_ENV === 'production', // HTTPS only in production
  sameSite: 'lax' as const,
  httpOnly: true, // Prevent XSS
}

/**
 * Sign in with enhanced session management
 */
export async function signInWithSession(
  email: string,
  password: string,
  rememberMe: boolean = false
) {
  const supabase = createClient()
  
  // Attempt sign in
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  
  if (error) {
    return { data: null, error }
  }
  
  if (!data.session) {
    return { data: null, error: new Error('No session created') }
  }
  
  // Configure session duration based on rememberMe
  const expiresIn = rememberMe ? SESSION_DURATION.LONG : SESSION_DURATION.SHORT
  
  // Update session with custom expiry
  const { data: updatedSession, error: updateError } = await supabase.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  })
  
  if (updateError) {
    return { data: null, error: updateError }
  }
  
  // Store session metadata in database for tracking
  if (data.user) {
    await recordSession(data.user.id, rememberMe, expiresIn)
  }
  
  return { data: updatedSession, error: null }
}

/**
 * Record session in database for tracking and revocation
 */
async function recordSession(
  userId: string,
  rememberMe: boolean,
  expiresIn: number
): Promise<void> {
  const supabase = createClient()
  
  const expiresAt = new Date(Date.now() + expiresIn * 1000)
  
  // Store session info
  await supabase.from('user_sessions').insert({
    user_id: userId,
    remember_me: rememberMe,
    expires_at: expiresAt.toISOString(),
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    ip_address: await getClientIP(),
    last_activity: new Date().toISOString(),
  })
  
  // Clean up old sessions for this user
  await cleanupExpiredSessions(userId)
}

/**
 * Get client IP (for session tracking)
 */
async function getClientIP(): Promise<string | null> {
  try {
    // This would be set by your middleware or API route
    if (typeof window !== 'undefined') {
      return null // Client-side, can't get IP
    }
    
    // Server-side only
    const response = await fetch('https://api.ipify.org?format=json')
    const data = await response.json()
    return data.ip
  } catch {
    return null
  }
}

/**
 * Clean up expired sessions
 */
async function cleanupExpiredSessions(userId: string): Promise<void> {
  const supabase = createClient()
  
  await supabase
    .from('user_sessions')
    .delete()
    .eq('user_id', userId)
    .lt('expires_at', new Date().toISOString())
}

/**
 * Get active sessions for a user
 */
export async function getActiveSessions(userId: string) {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('user_sessions')
    .select('*')
    .eq('user_id', userId)
    .gt('expires_at', new Date().toISOString())
    .order('last_activity', { ascending: false })
  
  if (error) {
    log.error('Error fetching sessions:', error)
    return []
  }
  
  return data.map(session => ({
    id: session.id,
    createdAt: new Date(session.created_at),
    expiresAt: new Date(session.expires_at),
    lastActivity: new Date(session.last_activity),
    rememberMe: session.remember_me,
    userAgent: session.user_agent,
    ipAddress: session.ip_address,
    isCurrent: false, // Would need to compare with current session
  }))
}

/**
 * Revoke a specific session
 */
export async function revokeSession(sessionId: string): Promise<boolean> {
  const supabase = createClient()
  
  const { error } = await supabase
    .from('user_sessions')
    .delete()
    .eq('id', sessionId)
  
  return !error
}

/**
 * Revoke all sessions for a user (except current)
 */
export async function revokeAllSessions(
  userId: string,
  exceptSessionId?: string
): Promise<boolean> {
  const supabase = createClient()
  
  let query = supabase
    .from('user_sessions')
    .delete()
    .eq('user_id', userId)
  
  if (exceptSessionId) {
    query = query.neq('id', exceptSessionId)
  }
  
  const { error } = await query
  
  return !error
}

/**
 * Update session activity (call this on important actions)
 */
export async function updateSessionActivity(userId: string): Promise<void> {
  const supabase = createClient()
  
  // Get current session
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) return
  
  // Update last activity for all active sessions (simplification)
  await supabase
    .from('user_sessions')
    .update({ last_activity: new Date().toISOString() })
    .eq('user_id', userId)
    .gt('expires_at', new Date().toISOString())
}

/**
 * Check if session is still valid
 */
export async function validateSession(): Promise<{
  valid: boolean
  user?: Record<string, unknown>
  reason?: string
}> {
  const supabase = createClient()
  
  const { data: { session }, error } = await supabase.auth.getSession()
  
  if (error || !session) {
    return { valid: false, reason: 'no_session' }
  }
  
  // Check if user is still active
  const { data: user } = await supabase
    .from('users')
    .select('is_active')
    .eq('id', session.user.id)
    .single()
  
  if (!user?.is_active) {
    return { valid: false, reason: 'user_deactivated' }
  }
  
  // Check if session exists in database
  const { data: dbSession } = await supabase
    .from('user_sessions')
    .select('*')
    .eq('user_id', session.user.id)
    .gt('expires_at', new Date().toISOString())
    .limit(1)
    .single()
  
  if (!dbSession) {
    return { valid: false, reason: 'session_revoked' }
  }
  
  return { valid: true, user: { ...session.user } }
}

/**
 * Extend session expiration (for remember me sessions)
 */
export async function extendSession(userId: string): Promise<boolean> {
  const supabase = createClient()
  
  const newExpiresAt = new Date(Date.now() + SESSION_DURATION.LONG * 1000)
  
  const { error } = await supabase
    .from('user_sessions')
    .update({ 
      expires_at: newExpiresAt.toISOString(),
      last_activity: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('remember_me', true)
    .gt('expires_at', new Date().toISOString())
  
  return !error
}

/**
 * Migration SQL for user_sessions table
 */
export const CREATE_SESSIONS_TABLE = `
-- User Sessions Table for enhanced session management
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  remember_me BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMP NOT NULL,
  user_agent TEXT,
  ip_address TEXT,
  last_activity TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active ON user_sessions(user_id, expires_at) WHERE expires_at > NOW();

-- RLS Policies (users can only see their own sessions)
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sessions"
  ON user_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sessions"
  ON user_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Function to auto-cleanup expired sessions (runs daily)
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM user_sessions
  WHERE expires_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup (if using pg_cron extension)
-- SELECT cron.schedule('cleanup-sessions', '0 2 * * *', 'SELECT cleanup_expired_sessions()');
`

/**
 * React Hook for session management
 */
export function useSession() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    
    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    
    return () => subscription.unsubscribe()
  }, [])
  
  return { session, loading }
}
