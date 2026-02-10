import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/errorHandling'
import { createClient } from '@/lib/supabase-server'

export const GET = withErrorHandler(async (req: NextRequest) => {
  const supabase = await createClient()
  
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    return NextResponse.json(
      { authenticated: false },
      { status: 401 }
    )
  }

  return NextResponse.json({
    authenticated: true,
    userId: user.id,
    email: user.email,
  })
})