// app/api/demo-data/generate/route.ts
// SSE streaming endpoint for demo data generation.
// Accepts full wizard config via POST body, streams progress events via Server-Sent Events.

import { createClient } from '@supabase/supabase-js'
import { generateDemoData, purgeCaseData, type GenerationConfig, type ProgressCallback, type SurgeonDurationMap, type SurgeonProfileInput } from '@/lib/demo-data-generator'
import type { OutlierProfile } from '@/lib/demo-outlier-engine'
import type { OutlierType, OutlierSetting } from '@/app/admin/demo/types'
import { env, serverEnv } from '@/lib/env'
import { logger } from '@/lib/logger'

const log = logger('api/demo-data/generate')

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  serverEnv.SUPABASE_SERVICE_ROLE_KEY
)

// Map wizard surgeon profile format (Record<string, SurgeonProfile>) to generator format (SurgeonProfileInput[])
interface WizardSurgeonProfile {
  surgeonId: string
  speedProfile: 'fast' | 'average' | 'slow'
  speedMultiplierRange?: { min: number; max: number }
  specialty: 'joint' | 'hand_wrist' | 'spine'
  operatingDays: number[]
  dayRoomAssignments: Record<string, string[]>
  procedureTypeIds: string[]
  preferredVendor: string | null
  closingWorkflow: string | null
  closingHandoffMinutes: number | null
  outliers: Record<string, { enabled: boolean; frequency: number; rangeMin: number; rangeMax: number }>
  badDaysPerMonth: number
  casesPerDay?: { min: number; max: number }
}

function mapWizardProfiles(profiles: Record<string, WizardSurgeonProfile>): SurgeonProfileInput[] {
  return Object.values(profiles).map((p) => {
    // Convert string-keyed day assignments to number-keyed (JSON serializes number keys as strings)
    const dayRoomAssignments: Record<number, string[]> = {}
    for (const [dayStr, rooms] of Object.entries(p.dayRoomAssignments)) {
      dayRoomAssignments[Number(dayStr)] = rooms
    }

    // Build outlier profile from wizard config (if any outlier is enabled)
    let outlierProfile: OutlierProfile | undefined
    if (p.outliers) {
      const outliers = {} as Record<OutlierType, OutlierSetting>
      for (const [key, val] of Object.entries(p.outliers)) {
        outliers[key as OutlierType] = {
          enabled: val.enabled,
          frequency: val.frequency,
          rangeMin: val.rangeMin,
          rangeMax: val.rangeMax,
        }
      }
      outlierProfile = { outliers, badDaysPerMonth: p.badDaysPerMonth || 0 }
    }

    return {
      surgeonId: p.surgeonId,
      speedProfile: p.speedProfile,
      speedMultiplierRange: p.speedMultiplierRange,
      specialty: p.specialty,
      operatingDays: p.operatingDays,
      dayRoomAssignments,
      preferredVendor: p.preferredVendor as 'Stryker' | 'Zimmer Biomet' | 'DePuy Synthes' | null,
      procedureTypeIds: p.procedureTypeIds,
      outlierProfile,
      casesPerDay: p.casesPerDay,
    }
  })
}

/** Load surgeon-specific duration overrides from DB and build lookup map */
async function loadSurgeonDurations(facilityId: string): Promise<SurgeonDurationMap> {
  const { data } = await supabase
    .from('surgeon_procedure_duration')
    .select('surgeon_id, procedure_type_id, expected_duration_minutes')
    .eq('facility_id', facilityId)
    .eq('is_active', true)
    .is('deleted_at', null)
  const map: SurgeonDurationMap = new Map()
  for (const row of (data || [])) {
    map.set(`${row.surgeon_id}::${row.procedure_type_id}`, row.expected_duration_minutes)
  }
  return map
}

export async function POST(request: Request) {
  const startTime = Date.now()

  try {
    const body = await request.json()
    const { facilityId, surgeonProfiles, monthsOfHistory, purgeFirst } = body

    if (!facilityId || !surgeonProfiles) {
      return new Response(
        JSON.stringify({ error: 'facilityId and surgeonProfiles required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Convert wizard profiles to generator format and load surgeon durations
    const mappedProfiles = mapWizardProfiles(surgeonProfiles)
    const surgeonDurations = await loadSurgeonDurations(facilityId)

    const config: GenerationConfig = {
      facilityId,
      surgeonProfiles: mappedProfiles,
      monthsOfHistory: monthsOfHistory || 6,
      purgeFirst: purgeFirst !== false,
      surgeonDurations,
    }

    // Create SSE stream
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: Record<string, unknown>) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
          } catch {
            // Stream may already be closed
          }
        }

        // Progress callback for the generator
        const onProgress: ProgressCallback = (p) => {
          // Map generator phases to our SSE phase names
          const phaseMap: Record<string, string> = {
            clearing: 'purging',
            loading: 'generating_cases',
            resolving: 'generating_cases',
            planning: 'generating_cases',
            generating: 'generating_cases',
            inserting: 'inserting_milestones',
            detecting_flags: 'detecting_flags',
            finalizing: 'finalizing',
            complete: 'finalizing',
          }

          sendEvent({
            type: 'progress',
            phase: phaseMap[p.phase] || p.phase,
            current: p.current,
            total: p.total,
            message: p.message,
          })
        }

        try {
          sendEvent({
            type: 'progress',
            phase: 'purging',
            current: 0,
            total: 100,
            message: 'Starting generation...',
          })

          const result = await generateDemoData(supabase, config, onProgress)

          if (result.success) {
            sendEvent({
              type: 'complete',
              result: {
                casesGenerated: result.casesGenerated,
                cancelledCount: result.details?.cancelledCount || 0,
                delayedCount: result.details?.delayedCount || 0,
                flaggedCount: result.details?.flaggedCount || 0,
                unvalidatedCount: result.details?.unvalidatedCount || 0,
                milestonesInserted: result.details?.milestones || 0,
                staffAssigned: result.details?.staff || 0,
                implantsInserted: result.details?.implants || 0,
                duration: Date.now() - startTime,
              },
            })
          } else {
            // Generation failed — attempt rollback
            let purged = false
            try {
              await purgeCaseData(supabase, facilityId)
              purged = true
            } catch (purgeErr) {
              log.error('Rollback purge failed', purgeErr)
            }

            sendEvent({
              type: 'error',
              error: result.error || 'Generation failed',
              purged,
            })
          }
        } catch (err) {
          log.error('Generation error', err)

          // Attempt rollback on unexpected errors
          let purged = false
          try {
            await purgeCaseData(supabase, facilityId)
            purged = true
          } catch {
            // Rollback failed
          }

          sendEvent({
            type: 'error',
            error: err instanceof Error ? err.message : 'Unexpected error',
            purged,
          })
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (err) {
    log.error('Request parsing error', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Invalid request' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
