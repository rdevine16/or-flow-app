// app/api/demo-data/route.ts
// API route for the Demo Data Wizard
// Supports: list-facilities, list-surgeons, status, status-detailed, generate-wizard, clear

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  generateDemoData,
  purgeCaseData,
  getDetailedStatus,
  type GenerationConfig,
} from '@/lib/demo-data-generator'

// Use service role key for admin operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action, facilityId } = body

    switch (action) {
      // ─── List demo-enabled facilities ───
      case 'list-facilities': {
        const { data: facilities, error } = await supabase
          .from('facilities')
          .select('id, name, is_demo, case_number_prefix, timezone')
          .eq('is_demo', true)
          .order('name')

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ facilities: facilities || [] })
      }

      // ─── List surgeons in a facility ───
      case 'list-surgeons': {
        if (!facilityId) {
          return NextResponse.json({ error: 'facilityId required' }, { status: 400 })
        }

        // Get the surgeon role ID
        const { data: surgeonRole } = await supabase
          .from('user_roles')
          .select('id')
          .eq('name', 'surgeon')
          .single()

        if (!surgeonRole) {
          return NextResponse.json({ error: 'Surgeon role not found' }, { status: 500 })
        }

        const { data: surgeons, error } = await supabase
          .from('users')
          .select('id, first_name, last_name, closing_workflow, closing_handoff_minutes')
          .eq('facility_id', facilityId)
          .eq('role_id', surgeonRole.id)
          .eq('is_active', true)
          .order('last_name')

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ surgeons: surgeons || [] })
      }

      // ─── Basic status (backward compatible) ───
      case 'status': {
        if (!facilityId) {
          return NextResponse.json({ error: 'facilityId required' }, { status: 400 })
        }

        const { count: caseCount } = await supabase
          .from('cases')
          .select('id', { count: 'exact', head: true })
          .eq('facility_id', facilityId)

        return NextResponse.json({
          cases: caseCount || 0,
          milestones: 0,
          staff: 0,
          implants: 0,
          delays: 0,
        })
      }

      // ─── Detailed status for wizard ───
      case 'status-detailed': {
        if (!facilityId) {
          return NextResponse.json({ error: 'facilityId required' }, { status: 400 })
        }

        const status = await getDetailedStatus(supabase, facilityId)
        return NextResponse.json(status)
      }

      // ─── Generate via wizard (v2) ───
      case 'generate-wizard': {
        const { surgeonProfiles, monthsOfHistory, purgeFirst } = body

        if (!facilityId || !surgeonProfiles) {
          return NextResponse.json(
            { success: false, error: 'facilityId and surgeonProfiles required' },
            { status: 400 }
          )
        }

        const config: GenerationConfig = {
          facilityId,
          surgeonProfiles,
          monthsOfHistory: monthsOfHistory || 6,
          purgeFirst: purgeFirst !== false,
        }

        const result = await generateDemoData(supabase, config)
        return NextResponse.json(result)
      }

      // ─── Clear / purge case data ───
      case 'clear': {
        if (!facilityId) {
          return NextResponse.json({ error: 'facilityId required' }, { status: 400 })
        }

        const result = await purgeCaseData(supabase, facilityId)
        return NextResponse.json(result)
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (error) {
    console.error('Demo data API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}