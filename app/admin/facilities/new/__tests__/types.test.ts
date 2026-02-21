// app/admin/facilities/new/__tests__/types.test.ts
// Tests for validation helpers and utility functions

import { describe, it, expect } from 'vitest'
import {
  isStep1Valid,
  isStep2Valid,
  formatPhone,
  buildFullAddress,
  DEFAULT_FACILITY_DATA,
  DEFAULT_ADMIN_DATA,
} from '../types'
import type { FacilityData, AdminData } from '../types'

describe('isStep1Valid', () => {
  it('returns true when name and timezone are provided', () => {
    const data: FacilityData = {
      ...DEFAULT_FACILITY_DATA,
      name: 'Pacific Surgery Center',
      timezone: 'America/New_York',
    }
    expect(isStep1Valid(data)).toBe(true)
  })

  it('returns false when name is empty', () => {
    const data: FacilityData = {
      ...DEFAULT_FACILITY_DATA,
      name: '',
      timezone: 'America/New_York',
    }
    expect(isStep1Valid(data)).toBe(false)
  })

  it('returns false when name is whitespace only', () => {
    const data: FacilityData = {
      ...DEFAULT_FACILITY_DATA,
      name: '   ',
      timezone: 'America/New_York',
    }
    expect(isStep1Valid(data)).toBe(false)
  })

  it('returns false when timezone is empty', () => {
    const data: FacilityData = {
      ...DEFAULT_FACILITY_DATA,
      name: 'Pacific Surgery Center',
      timezone: '',
    }
    expect(isStep1Valid(data)).toBe(false)
  })

  it('returns false when both name and timezone are empty', () => {
    const data: FacilityData = {
      ...DEFAULT_FACILITY_DATA,
      name: '',
      timezone: '',
    }
    expect(isStep1Valid(data)).toBe(false)
  })

  it('returns true when optional fields are empty but required fields are filled', () => {
    const data: FacilityData = {
      ...DEFAULT_FACILITY_DATA,
      name: 'Surgery Center',
      timezone: 'America/New_York',
      phone: '',
      streetAddress: '',
      city: '',
      state: '',
      zipCode: '',
    }
    expect(isStep1Valid(data)).toBe(true)
  })
})

describe('isStep2Valid', () => {
  it('returns true when all required fields are provided', () => {
    const data: AdminData = {
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@hospital.com',
      roleId: 'role-123',
    }
    expect(isStep2Valid(data)).toBe(true)
  })

  it('returns false when firstName is empty', () => {
    const data: AdminData = {
      firstName: '',
      lastName: 'Smith',
      email: 'jane.smith@hospital.com',
      roleId: 'role-123',
    }
    expect(isStep2Valid(data)).toBe(false)
  })

  it('returns false when firstName is whitespace only', () => {
    const data: AdminData = {
      firstName: '   ',
      lastName: 'Smith',
      email: 'jane.smith@hospital.com',
      roleId: 'role-123',
    }
    expect(isStep2Valid(data)).toBe(false)
  })

  it('returns false when lastName is empty', () => {
    const data: AdminData = {
      firstName: 'Jane',
      lastName: '',
      email: 'jane.smith@hospital.com',
      roleId: 'role-123',
    }
    expect(isStep2Valid(data)).toBe(false)
  })

  it('returns false when lastName is whitespace only', () => {
    const data: AdminData = {
      firstName: 'Jane',
      lastName: '   ',
      email: 'jane.smith@hospital.com',
      roleId: 'role-123',
    }
    expect(isStep2Valid(data)).toBe(false)
  })

  it('returns false when email is empty', () => {
    const data: AdminData = {
      firstName: 'Jane',
      lastName: 'Smith',
      email: '',
      roleId: 'role-123',
    }
    expect(isStep2Valid(data)).toBe(false)
  })

  it('returns false when email is whitespace only', () => {
    const data: AdminData = {
      firstName: 'Jane',
      lastName: 'Smith',
      email: '   ',
      roleId: 'role-123',
    }
    expect(isStep2Valid(data)).toBe(false)
  })

  it('returns false when email does not contain @', () => {
    const data: AdminData = {
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith.hospital.com',
      roleId: 'role-123',
    }
    expect(isStep2Valid(data)).toBe(false)
  })

  it('returns false when roleId is empty', () => {
    const data: AdminData = {
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@hospital.com',
      roleId: '',
    }
    expect(isStep2Valid(data)).toBe(false)
  })

  it('returns false when all fields are empty', () => {
    const data: AdminData = {
      firstName: '',
      lastName: '',
      email: '',
      roleId: '',
    }
    expect(isStep2Valid(data)).toBe(false)
  })

  it('returns true with minimal valid email (a@b)', () => {
    const data: AdminData = {
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'a@b',
      roleId: 'role-123',
    }
    expect(isStep2Valid(data)).toBe(true)
  })
})

describe('formatPhone', () => {
  it('returns digits as-is when 3 or fewer', () => {
    expect(formatPhone('5')).toBe('5')
    expect(formatPhone('55')).toBe('55')
    expect(formatPhone('555')).toBe('555')
  })

  it('formats 4-6 digits with parentheses and space', () => {
    expect(formatPhone('5551')).toBe('(555) 1')
    expect(formatPhone('55512')).toBe('(555) 12')
    expect(formatPhone('555123')).toBe('(555) 123')
  })

  it('formats 7-10 digits with full formatting', () => {
    expect(formatPhone('5551234')).toBe('(555) 123-4')
    expect(formatPhone('55512345')).toBe('(555) 123-45')
    expect(formatPhone('555123456')).toBe('(555) 123-456')
    expect(formatPhone('5551234567')).toBe('(555) 123-4567')
  })

  it('truncates digits beyond 10', () => {
    expect(formatPhone('555123456789')).toBe('(555) 123-4567')
  })

  it('strips non-digit characters before formatting', () => {
    expect(formatPhone('(555) 123-4567')).toBe('(555) 123-4567')
    expect(formatPhone('555-123-4567')).toBe('(555) 123-4567')
    expect(formatPhone('555.123.4567')).toBe('(555) 123-4567')
    expect(formatPhone('+1 555 123 4567')).toBe('(155) 512-3456')
  })

  it('handles empty string', () => {
    expect(formatPhone('')).toBe('')
  })

  it('handles string with no digits', () => {
    expect(formatPhone('abc')).toBe('')
  })

  it('handles mixed alphanumeric input', () => {
    expect(formatPhone('5a5b5c1d2e3f4g5h6i7')).toBe('(555) 123-4567')
  })
})

describe('buildFullAddress', () => {
  it('builds address with all fields populated', () => {
    const data: FacilityData = {
      ...DEFAULT_FACILITY_DATA,
      streetAddress: '123 Main St',
      streetAddress2: 'Suite 100',
      city: 'Seattle',
      state: 'WA',
      zipCode: '98101',
    }
    expect(buildFullAddress(data)).toBe('123 Main St, Suite 100, Seattle, WA, 98101')
  })

  it('builds address without streetAddress2', () => {
    const data: FacilityData = {
      ...DEFAULT_FACILITY_DATA,
      streetAddress: '123 Main St',
      streetAddress2: '',
      city: 'Seattle',
      state: 'WA',
      zipCode: '98101',
    }
    expect(buildFullAddress(data)).toBe('123 Main St, Seattle, WA, 98101')
  })

  it('builds address with only street and city', () => {
    const data: FacilityData = {
      ...DEFAULT_FACILITY_DATA,
      streetAddress: '123 Main St',
      streetAddress2: '',
      city: 'Seattle',
      state: '',
      zipCode: '',
    }
    expect(buildFullAddress(data)).toBe('123 Main St, Seattle')
  })

  it('returns empty string when all address fields are empty', () => {
    const data: FacilityData = {
      ...DEFAULT_FACILITY_DATA,
      streetAddress: '',
      streetAddress2: '',
      city: '',
      state: '',
      zipCode: '',
    }
    expect(buildFullAddress(data)).toBe('')
  })

  it('handles partial address with only city and state', () => {
    const data: FacilityData = {
      ...DEFAULT_FACILITY_DATA,
      streetAddress: '',
      streetAddress2: '',
      city: 'Seattle',
      state: 'WA',
      zipCode: '',
    }
    expect(buildFullAddress(data)).toBe('Seattle, WA')
  })

  it('handles address with whitespace-only fields as empty', () => {
    const data: FacilityData = {
      ...DEFAULT_FACILITY_DATA,
      streetAddress: '123 Main St',
      streetAddress2: '',
      city: 'Seattle',
      state: '',
      zipCode: '98101',
    }
    expect(buildFullAddress(data)).toBe('123 Main St, Seattle, 98101')
  })
})
