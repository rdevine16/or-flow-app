import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Tests for POST /api/time-off/notify route logic.
 *
 * Tests channel determination (email vs push), push payload construction,
 * multi-channel independence, and graceful error handling.
 */

// ============================================
// CHANNEL DETERMINATION LOGIC
// ============================================

function determineChannels(channels: string[]): { emailEnabled: boolean; pushEnabled: boolean } {
  return {
    emailEnabled: channels.includes('email'),
    pushEnabled: channels.includes('push'),
  }
}

describe('Time-Off Notify — Channel Determination', () => {
  it('should detect email only', () => {
    const result = determineChannels(['in_app', 'email'])
    expect(result).toEqual({ emailEnabled: true, pushEnabled: false })
  })

  it('should detect push only', () => {
    const result = determineChannels(['in_app', 'push'])
    expect(result).toEqual({ emailEnabled: false, pushEnabled: true })
  })

  it('should detect both email and push', () => {
    const result = determineChannels(['in_app', 'email', 'push'])
    expect(result).toEqual({ emailEnabled: true, pushEnabled: true })
  })

  it('should detect neither when only in_app', () => {
    const result = determineChannels(['in_app'])
    expect(result).toEqual({ emailEnabled: false, pushEnabled: false })
  })

  it('should handle empty channels array', () => {
    const result = determineChannels([])
    expect(result).toEqual({ emailEnabled: false, pushEnabled: false })
  })
})

// ============================================
// NOTIFICATION TYPE MAPPING
// ============================================

function getNotificationType(status: 'approved' | 'denied'): string {
  return status === 'approved' ? 'time_off_approved' : 'time_off_denied'
}

describe('Time-Off Notify — Notification Type Mapping', () => {
  it('should map approved status to time_off_approved', () => {
    expect(getNotificationType('approved')).toBe('time_off_approved')
  })

  it('should map denied status to time_off_denied', () => {
    expect(getNotificationType('denied')).toBe('time_off_denied')
  })
})

// ============================================
// PUSH PAYLOAD CONSTRUCTION
// ============================================

interface PushPayloadInput {
  facilityId: string
  staffUserId: string
  status: 'approved' | 'denied'
  requestType: string
  startDate: string
  endDate: string
  reviewerName: string
}

function buildPushPayload(input: PushPayloadInput) {
  const statusLabel = input.status === 'approved' ? 'Approved' : 'Denied'
  const typeLabel = input.requestType.toUpperCase() === 'PTO'
    ? 'PTO'
    : input.requestType.charAt(0).toUpperCase() + input.requestType.slice(1)

  return {
    facility_id: input.facilityId,
    target_user_id: input.staffUserId,
    title: `Time-Off Request ${statusLabel}`,
    body: `Your ${typeLabel} request for ${input.startDate} to ${input.endDate} has been ${input.status} by ${input.reviewerName}`,
    data: {
      type: 'time_off_review',
      status: input.status,
      link_to: '/staff-management?tab=time-off-calendar',
    },
  }
}

describe('Time-Off Notify — Push Payload Construction', () => {
  it('should build correct payload for approved PTO request', () => {
    const payload = buildPushPayload({
      facilityId: 'fac-123',
      staffUserId: 'user-456',
      status: 'approved',
      requestType: 'pto',
      startDate: '2026-03-10',
      endDate: '2026-03-14',
      reviewerName: 'Dr. Smith',
    })

    expect(payload).toEqual({
      facility_id: 'fac-123',
      target_user_id: 'user-456',
      title: 'Time-Off Request Approved',
      body: 'Your PTO request for 2026-03-10 to 2026-03-14 has been approved by Dr. Smith',
      data: {
        type: 'time_off_review',
        status: 'approved',
        link_to: '/staff-management?tab=time-off-calendar',
      },
    })
  })

  it('should build correct payload for denied sick request', () => {
    const payload = buildPushPayload({
      facilityId: 'fac-123',
      staffUserId: 'user-789',
      status: 'denied',
      requestType: 'sick',
      startDate: '2026-04-01',
      endDate: '2026-04-01',
      reviewerName: 'Admin User',
    })

    expect(payload).toEqual({
      facility_id: 'fac-123',
      target_user_id: 'user-789',
      title: 'Time-Off Request Denied',
      body: 'Your Sick request for 2026-04-01 to 2026-04-01 has been denied by Admin User',
      data: {
        type: 'time_off_review',
        status: 'denied',
        link_to: '/staff-management?tab=time-off-calendar',
      },
    })
  })

  it('should capitalize PTO correctly regardless of input casing', () => {
    const payload = buildPushPayload({
      facilityId: 'f',
      staffUserId: 'u',
      status: 'approved',
      requestType: 'PTO',
      startDate: '2026-01-01',
      endDate: '2026-01-02',
      reviewerName: 'Admin',
    })
    expect(payload.body).toContain('Your PTO request')
  })
})

// ============================================
// MULTI-CHANNEL RESULT AGGREGATION
// ============================================

interface ChannelResults {
  email?: { sent: boolean; messageId?: string; error?: string }
  push?: { sent: boolean; error?: string }
}

function computeAnySent(results: ChannelResults): boolean {
  return !!(results.email?.sent || results.push?.sent)
}

describe('Time-Off Notify — Result Aggregation', () => {
  it('should return true when email sent', () => {
    expect(computeAnySent({ email: { sent: true, messageId: 'msg-1' } })).toBe(true)
  })

  it('should return true when push sent', () => {
    expect(computeAnySent({ push: { sent: true } })).toBe(true)
  })

  it('should return true when both sent', () => {
    expect(computeAnySent({
      email: { sent: true, messageId: 'msg-1' },
      push: { sent: true },
    })).toBe(true)
  })

  it('should return true when email sent but push failed', () => {
    expect(computeAnySent({
      email: { sent: true, messageId: 'msg-1' },
      push: { sent: false, error: 'timeout' },
    })).toBe(true)
  })

  it('should return true when push sent but email failed', () => {
    expect(computeAnySent({
      email: { sent: false, error: 'smtp_error' },
      push: { sent: true },
    })).toBe(true)
  })

  it('should return false when both failed', () => {
    expect(computeAnySent({
      email: { sent: false, error: 'smtp_error' },
      push: { sent: false, error: 'timeout' },
    })).toBe(false)
  })

  it('should return false when no results', () => {
    expect(computeAnySent({})).toBe(false)
  })
})

// ============================================
// PUSH ELIGIBILITY (pushEnabled + staffUserId)
// ============================================

function shouldSendPush(pushEnabled: boolean, staffUserId: string | undefined): boolean {
  return pushEnabled && !!staffUserId
}

describe('Time-Off Notify — Push Eligibility', () => {
  it('should send push when enabled and staffUserId provided', () => {
    expect(shouldSendPush(true, 'user-123')).toBe(true)
  })

  it('should NOT send push when channel disabled', () => {
    expect(shouldSendPush(false, 'user-123')).toBe(false)
  })

  it('should NOT send push when staffUserId is undefined', () => {
    expect(shouldSendPush(true, undefined)).toBe(false)
  })

  it('should NOT send push when both disabled and no user', () => {
    expect(shouldSendPush(false, undefined)).toBe(false)
  })
})
