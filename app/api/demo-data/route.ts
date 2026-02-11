// app/api/demo-data/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateDemoData, purgeCaseData, getDetailedStatus, type GenerationConfig } from '@/lib/demo-data-generator'
import { env, serverEnv } from '@/lib/env'
import { logger } from '@/lib/logger'

const log = logger('api/demo-data')

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  serverEnv.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action, facilityId } = body

    switch (action) {
      case 'list-facilities': {
        const { data, error } = await supabase.from('facilities').select('id, name, is_demo, case_number_prefix, timezone').eq('is_demo', true).order('name')
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ facilities: data || [] })
      }

      case 'list-surgeons': {
        if (!facilityId) return NextResponse.json({ error: 'facilityId required' }, { status: 400 })
        const { data: role } = await supabase.from('user_roles').select('id').eq('name', 'surgeon').single()
        if (!role) return NextResponse.json({ error: 'Surgeon role not found' }, { status: 500 })
        const { data, error } = await supabase.from('users').select('id, first_name, last_name, closing_workflow, closing_handoff_minutes').eq('facility_id', facilityId).eq('role_id', role.id).eq('is_active', true).order('last_name')
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ surgeons: data || [] })
      }

      case 'list-rooms': {
        if (!facilityId) return NextResponse.json({ error: 'facilityId required' }, { status: 400 })
        const { data, error } = await supabase.from('or_rooms').select('id, name').eq('facility_id', facilityId).eq('is_active', true).order('display_order')
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ rooms: data || [] })
      }

      case 'list-procedure-types': {
        if (!facilityId) return NextResponse.json({ error: 'facilityId required' }, { status: 400 })
        const { data, error } = await supabase.from('procedure_types').select('id, name').eq('facility_id', facilityId).eq('is_active', true).order('name')
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ procedureTypes: data || [] })
      }

      case 'status': {
        if (!facilityId) return NextResponse.json({ error: 'facilityId required' }, { status: 400 })
        const { count } = await supabase.from('cases').select('id', { count: 'exact', head: true }).eq('facility_id', facilityId)
        return NextResponse.json({ cases: count || 0, milestones: 0, staff: 0, implants: 0, delays: 0 })
      }

      case 'status-detailed': {
        if (!facilityId) return NextResponse.json({ error: 'facilityId required' }, { status: 400 })
        const status = await getDetailedStatus(supabase, facilityId)
        return NextResponse.json(status)
      }

      case 'generate-wizard': {
        const { surgeonProfiles, monthsOfHistory, purgeFirst } = body
        if (!facilityId || !surgeonProfiles) return NextResponse.json({ success: false, error: 'facilityId and surgeonProfiles required' }, { status: 400 })
        const config: GenerationConfig = { facilityId, surgeonProfiles, monthsOfHistory: monthsOfHistory || 6, purgeFirst: purgeFirst !== false }
        const result = await generateDemoData(supabase, config)
        return NextResponse.json(result)
      }

      case 'clear': {
        if (!facilityId) return NextResponse.json({ error: 'facilityId required' }, { status: 400 })
        const result = await purgeCaseData(supabase, facilityId)
        return NextResponse.json(result)
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (error) {
log.error('Error description:', error)

    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal error' }, { status: 500 })
  }
}
