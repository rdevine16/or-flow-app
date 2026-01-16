import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { generateDemoData, clearDemoData, getDemoDataStatus } from '@/lib/demo-data-generator'

// Use service role to bypass RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function POST(request: NextRequest) {
  try {
    const { action, facilityId } = await request.json()

    if (!facilityId) {
      return NextResponse.json({ error: 'facilityId required' }, { status: 400 })
    }

    // Verify facility is a demo facility
    const { data: facility } = await supabaseAdmin
      .from('facilities')
      .select('id, name, is_demo')
      .eq('id', facilityId)
      .single()

    if (!facility?.is_demo) {
      return NextResponse.json({ error: 'Not a demo facility' }, { status: 403 })
    }

    if (action === 'generate') {
      const result = await generateDemoData(supabaseAdmin, facilityId)
      return NextResponse.json(result)
    } 
    
    if (action === 'clear') {
      const result = await clearDemoData(supabaseAdmin, facilityId)
      return NextResponse.json(result)
    }
    
    if (action === 'status') {
      const result = await getDemoDataStatus(supabaseAdmin, facilityId)
      return NextResponse.json(result)
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: any) {
    console.error('Demo data API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
