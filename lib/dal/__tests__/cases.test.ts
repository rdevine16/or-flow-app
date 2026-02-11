import { describe, it, expect } from 'vitest'
import type { CaseListItem, CaseDetail } from '../cases'

describe('Cases DAL Types — Phase 1.5', () => {
  it('CaseListItem includes created_by field', () => {
    // Type-level check: this compiles only if created_by exists on CaseListItem
    const item: CaseListItem = {
      id: 'case-1',
      case_number: 'C-001',
      patient_name: 'Test Patient',
      patient_mrn: null,
      scheduled_date: '2026-03-15',
      start_time: '07:30',
      status: 'scheduled',
      or_room_id: 'room-1',
      surgeon_id: 'surgeon-1',
      facility_id: 'facility-1',
      created_at: '2026-03-15T00:00:00Z',
      created_by: 'user-1',
    }

    expect(item.created_by).toBe('user-1')
  })

  it('CaseListItem allows null created_by', () => {
    const item: CaseListItem = {
      id: 'case-2',
      case_number: 'C-002',
      patient_name: 'Test Patient 2',
      patient_mrn: null,
      scheduled_date: '2026-03-15',
      start_time: null,
      status: null,
      or_room_id: null,
      surgeon_id: null,
      facility_id: 'facility-1',
      created_at: '2026-03-15T00:00:00Z',
      created_by: null,
    }

    expect(item.created_by).toBeNull()
  })

  it('CaseDetail inherits created_by from CaseListItem', () => {
    const detail: CaseDetail = {
      id: 'case-3',
      case_number: 'C-003',
      patient_name: 'Test Patient 3',
      patient_mrn: null,
      scheduled_date: '2026-03-15',
      start_time: '08:00',
      status: 'scheduled',
      or_room_id: 'room-1',
      surgeon_id: 'surgeon-1',
      facility_id: 'facility-1',
      created_at: '2026-03-15T00:00:00Z',
      created_by: 'user-1',
      patient_dob: null,
      patient_phone: null,
      laterality: null,
      anesthesia_type: null,
      estimated_duration_minutes: null,
      actual_duration_minutes: null,
      notes: null,
      rep_required_override: null,
      called_back_at: null,
      called_back_by: null,
      complexity_id: null,
      case_milestones: [],
      case_flags: [],
      case_staff: [],
      case_implant_companies: [],
    }

    expect(detail.created_by).toBe('user-1')
  })
})
