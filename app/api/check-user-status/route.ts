import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { useToast } from '@/components/ui/Toast/ToastProvider'

// Create admin client with service role key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)
const { showToast } = useToast()
export async function POST(request: NextRequest) {
  try {
    const { emails } = await request.json()

    if (!emails || !Array.isArray(emails)) {
      return NextResponse.json(
        { error: 'Emails array is required' },
        { status: 400 }
      )
    }

    // Get all auth users
    const { data: authData, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (listError) {
      showToast({
  type: 'error',
  title: 'Error listing users:',
  message: `Error listing users: ${listError}`
})
      return NextResponse.json(
        { error: 'Failed to fetch user status' },
        { status: 500 }
      )
    }

    // Find users who haven't confirmed their email (pending)
    const pendingUserIds: string[] = []
    
    for (const email of emails) {
      const authUser = authData.users.find(u => u.email === email)
      if (authUser && !authUser.email_confirmed_at) {
        pendingUserIds.push(authUser.id)
      }
    }

    return NextResponse.json({ pendingUserIds })

  } catch (error) {
    showToast({
  type: 'error',
  title: 'Check user status error:',
  message: error instanceof Error ? error.message : 'Check user status error:'
})
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
