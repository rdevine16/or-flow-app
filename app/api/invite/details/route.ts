import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { env, serverEnv } from '@/lib/env'

const supabaseAdmin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  serverEnv.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.json({ error: 'Token required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('device_rep_invites')
    .select(`
      id,
      email,
      facility_id,
      implant_company_id,
      expires_at,
      accepted_at,
      facilities (name, address),
      implant_companies (name)
    `)
    .eq('invite_token', token)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Invalid invite token' }, { status: 404 })
  }

  const facility = Array.isArray(data.facilities) ? data.facilities[0] : data.facilities
  const company = Array.isArray(data.implant_companies) ? data.implant_companies[0] : data.implant_companies

  return NextResponse.json({
    id: data.id,
    email: data.email,
    facility_id: data.facility_id,
    implant_company_id: data.implant_company_id,
    expires_at: data.expires_at,
    accepted_at: data.accepted_at,
    facility_name: facility?.name || null,
    facility_address: facility?.address || null,
    company_name: company?.name || null,
  })
}
