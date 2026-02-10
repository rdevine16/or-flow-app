/**
 * INPUT VALIDATION WITH ZOD
 * 
 * Start here - basic schemas for your most critical API routes.
 * Expand as needed.
 */

import { z } from 'zod'
import { ValidationError } from './errorHandling'

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
  patient_name: z.string()
    .min(1, 'Patient name is required')
    .max(100, 'Patient name too long'),
  
  patient_mrn: z.string()
    .min(1, 'MRN is required')
    .max(50, 'MRN too long'),
  
  surgeon_id: uuidSchema,
  
  scheduled_date: dateSchema,
  
  scheduled_time: timeSchema,
  
  room_id: uuidSchema,
  
  procedure_ids: z.array(uuidSchema)
    .min(1, 'At least one procedure required'),
  
  anesthesia_type: z.enum(['general', 'mac', 'regional', 'local']).optional(),
  
  estimated_duration_minutes: z.number()
    .int()
    .min(1)
    .max(1440)
    .optional(),
  
  notes: z.string().max(1000).optional(),
})

export type CreateCaseInput = z.infer<typeof createCaseSchema>

export const updateCaseSchema = createCaseSchema.partial()
export type UpdateCaseInput = z.infer<typeof updateCaseSchema>

// ============================================
// MILESTONE SCHEMAS
// ============================================

export const recordMilestoneSchema = z.object({
  case_id: uuidSchema,
  milestone_id: uuidSchema,
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
export function validatePartial<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): Partial<T> {
  const partialSchema = schema.partial()
  return validate(partialSchema, data)
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
