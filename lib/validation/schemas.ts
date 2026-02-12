/**
 * INPUT VALIDATION WITH ZOD
 * 
 * Start here - basic schemas for your most critical API routes.
 * Expand as needed.
 */

import { z } from 'zod'
import { ValidationError } from '../errorHandling'

// ============================================
// BASE VALIDATORS
// ============================================

export const uuidSchema = z.string().uuid('Invalid ID format')

export const dateSchema = z.string().regex(
  /^\d{4}-\d{2}-\d{2}$/,
  'Date must be YYYY-MM-DD format'
)

export const timeSchema = z.string().regex(
  /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/,
  'Time must be HH:MM or HH:MM:SS (24-hour)'
)

export const emailSchema = z.string().email('Invalid email address')

// ============================================
// CASE SCHEMAS
// ============================================

export const createCaseSchema = z.object({
  case_number: z.string()
    .min(1, 'Case number is required')
    .max(50, 'Case number too long'),

  scheduled_date: z.string()
    .min(1, 'Scheduled date is required')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),

  start_time: z.string()
    .min(1, 'Start time is required')
    .regex(/^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/, 'Time must be HH:MM (24-hour)'),

  surgeon_id: z.string().min(1, 'Surgeon is required'),

  procedure_type_id: z.string().min(1, 'Procedure type is required'),

  or_room_id: z.string().min(1, 'OR room is required'),

  status_id: z.string().min(1, 'Status is required'),

  anesthesiologist_id: z.string().optional().or(z.literal('')),

  operative_side: z.enum(['left', 'right', 'bilateral', 'n/a', '']).optional(),

  payer_id: z.string().optional().or(z.literal('')),

  notes: z.string().max(1000, 'Notes must be under 1000 characters').optional().or(z.literal('')),
})

export type CreateCaseInput = z.infer<typeof createCaseSchema>

export const updateCaseSchema = createCaseSchema.partial()
export type UpdateCaseInput = z.infer<typeof updateCaseSchema>

// Phase 2.1: Relaxed schema for draft cases — only date required
export const draftCaseSchema = z.object({
  case_number: z.string().max(50, 'Case number too long').optional().or(z.literal('')),

  scheduled_date: z.string()
    .min(1, 'Scheduled date is required')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),

  start_time: z.string().optional().or(z.literal('')),

  surgeon_id: z.string().optional().or(z.literal('')),

  procedure_type_id: z.string().optional().or(z.literal('')),

  or_room_id: z.string().optional().or(z.literal('')),

  status_id: z.string().optional().or(z.literal('')),

  anesthesiologist_id: z.string().optional().or(z.literal('')),

  operative_side: z.enum(['left', 'right', 'bilateral', 'n/a', '']).optional(),

  payer_id: z.string().optional().or(z.literal('')),

  notes: z.string().max(1000, 'Notes must be under 1000 characters').optional().or(z.literal('')),
})

export type DraftCaseInput = z.infer<typeof draftCaseSchema>

// Phase 4.1: Schema for a single row in bulk case creation
// Date and surgeon are shared header fields, not per-row
export const bulkCaseRowSchema = z.object({
  case_number: z.string()
    .min(1, 'Case number is required')
    .max(50, 'Case number too long'),

  start_time: z.string()
    .min(1, 'Start time is required')
    .regex(/^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/, 'Time must be HH:MM (24-hour)'),

  procedure_type_id: z.string().min(1, 'Procedure is required'),

  or_room_id: z.string().min(1, 'Room is required'),

  operative_side: z.enum(['left', 'right', 'bilateral', 'n/a', '']).optional(),

  implant_company_ids: z.array(z.string()).optional(),

  rep_required_override: z.boolean().nullable().optional(),
})

export type BulkCaseRowInput = z.infer<typeof bulkCaseRowSchema>

// Schema for the entire bulk creation submission (header + rows)
export const bulkCaseSubmissionSchema = z.object({
  scheduled_date: z.string()
    .min(1, 'Scheduled date is required')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),

  surgeon_id: z.string().min(1, 'Surgeon is required'),

  rows: z.array(bulkCaseRowSchema)
    .min(1, 'At least one case row is required')
    .max(20, 'Maximum 20 cases per bulk submission'),
})

export type BulkCaseSubmissionInput = z.infer<typeof bulkCaseSubmissionSchema>

// ============================================
// MILESTONE SCHEMAS
// ============================================

export const recordMilestoneSchema = z.object({
  case_id: uuidSchema,
  facility_milestone_id: uuidSchema,
  timestamp: z.string().datetime('Must be ISO 8601 format'),
  recorded_by: uuidSchema.optional(),
  notes: z.string().max(500).optional(),
})

export type RecordMilestoneInput = z.infer<typeof recordMilestoneSchema>

// ============================================
// SURGEON SCHEMAS
// ============================================

export const createSurgeonSchema = z.object({
  first_name: z.string().min(1).max(50),
  last_name: z.string().min(1).max(50),
  email: emailSchema,
  phone: z.string().optional(),
  npi: z.string().regex(/^\d{10}$/, 'NPI must be 10 digits').optional(),
  specialty: z.string().max(100).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be hex color').optional(),
})

export type CreateSurgeonInput = z.infer<typeof createSurgeonSchema>

// ============================================
// FILTER/SEARCH SCHEMAS
// ============================================

export const caseFilterSchema = z.object({
  date_from: dateSchema.optional(),
  date_to: dateSchema.optional(),
  surgeon_id: uuidSchema.optional(),
  room_id: uuidSchema.optional(),
  status: z.enum([
    'scheduled',
    'checked_in',
    'in_or',
    'in_pacu',
    'completed',
    'cancelled'
  ]).optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(25),
})

export type CaseFilterInput = z.infer<typeof caseFilterSchema>

// ============================================
// VALIDATION HELPER
// ============================================

/**
 * Validate data against a Zod schema
 * Throws ValidationError if invalid
 */
export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): T {
  const result = schema.safeParse(data)
  
  if (!result.success) {
    const errors = result.error.flatten()
    throw new ValidationError(
      'Validation failed',
      {
        fields: errors.fieldErrors,
        issues: errors.formErrors,
      }
    )
  }
  
  return result.data
}

/**
 * Validate partial updates (only provided fields)
 */
export function validatePartial<T extends Record<string, any>>(
  schema: z.ZodObject<any>,
  data: unknown
): Partial<T> {
  const partialSchema = schema.partial()
  return validate(partialSchema, data) as Partial<T>
}

/**
 * Validate a single field against a schema.
 * Returns the error message string or null if valid.
 */
export function validateField(
  schema: z.ZodObject<any>,
  field: string,
  value: unknown
): string | null {
  const fieldSchema = schema.shape[field]
  if (!fieldSchema) return null

  const result = fieldSchema.safeParse(value)
  if (result.success) return null

  return result.error.issues[0]?.message || 'Invalid value'
}

// ============================================
// USAGE EXAMPLES
// ============================================

/*
// In API routes:
import { validate, createCaseSchema } from '@/lib/validation/schemas'

export const POST = withErrorHandler(async (req) => {
  const body = await req.json()
  const validated = validate(createCaseSchema, body)
  
  // Now 'validated' is type-safe and guaranteed valid
  const { data, error } = await supabase
    .from('cases')
    .insert(validated)
  // ...
})

// In forms:
import { validate, createCaseSchema } from '@/lib/validation/schemas'

function handleSubmit(formData) {
  try {
    const validated = validate(createCaseSchema, formData)
    // Submit validated data
  } catch (err) {
    if (err instanceof ValidationError) {
      // Show field errors
      setErrors(err.details?.fields)
    }
  }
}
*/

// ============================================
// ADD MORE SCHEMAS AS NEEDED
// ============================================

/*
TODO: Add schemas for:
- Block schedules
- Facilities
- Device reps
- Implant companies
- Room configurations
- User invitations

Copy the pattern above and customize for your data.
*/
