// app/api/demo-data/generate/route.ts
// SSE streaming endpoint for demo data generation.
// Accepts full wizard config via POST body, streams progress events via Server-Sent Events.

import { createClient } from '@supabase/supabase-js'
import { generateDemoData, purgeCaseData, type GenerationConfig, type ProgressCallback } from '@/lib/demo-data-generator'
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
  specialty: 'joint' | 'hand_wrist' | 'spine'
  operatingDays: number[]
  dayRoomAssignments: Record<string, string[]>
  procedureTypeIds: string[]
  preferredVendor: string | null
  closingWorkflow: string | null
  closingHandoffMinutes: number | null
  outliers: Record<string, { enabled: boolean; frequency: number; magnitude: number }>
  badDaysPerMonth: number
}

function mapWizardProfiles(profiles: Record<string, WizardSurgeonProfile>) {
  return Object.values(profiles).map((p) => {
    // Determine primary and flip room from day assignments
    // For backward compat with v1 generator: pick the most common room as primary
    const roomCounts = new Map<string, number>()
    for (const rooms of Object.values(p.dayRoomAssignments)) {
      for (const roomId of rooms) {
        roomCounts.set(roomId, (roomCounts.get(roomId) || 0) + 1)
      }
    }
    const sortedRooms = [...roomCounts.entries()].sort((a, b) => b[1] - a[1])
    const primaryRoomId = sortedRooms[0]?.[0] || null
    const flipRoomId = sortedRooms[1]?.[0] || null

    return {
      surgeonId: p.surgeonId,
      speedProfile: p.speedProfile,
      usesFlipRooms: flipRoomId !== null,
      specialty: p.specialty,
      operatingDays: p.operatingDays,
      preferredVendor: p.preferredVendor as 'Stryker' | 'Zimmer Biomet' | 'DePuy Synthes' | null,
      primaryRoomId,
      flipRoomId,
      procedureTypeIds: p.procedureTypeIds,
    }
  })
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

    // Convert wizard profiles to generator format
    const mappedProfiles = mapWizardProfiles(surgeonProfiles)

    const config: GenerationConfig = {
      facilityId,
      surgeonProfiles: mappedProfiles,
      monthsOfHistory: monthsOfHistory || 6,
      purgeFirst: purgeFirst !== false,
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
            generating: 'generating_cases',
            milestones: 'inserting_milestones',
            staff: 'assigning_staff',
            implants: 'assigning_staff',
            validation: 'detecting_flags',
            stats: 'detecting_flags',
            triggers: 'finalizing',
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
                cancelledCount: 0, // Will be populated in Phase 6b
                delayedCount: 0,
                flaggedCount: 0,
                milestonesInserted: result.details?.milestones || 0,
                staffAssigned: result.details?.staff || 0,
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
