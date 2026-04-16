import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { UserRole } from '@/types/database'

interface RegisterBody {
  full_name: string
  email: string
  password: string
  role: Extract<UserRole, 'setter' | 'closer'>
  commission_rate: number
  hire_date: string
}

export async function POST(request: Request) {
  try {
    // 1. Verify the requesting user is an admin
    const supabase = await createClient()
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser()

    if (!currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized. You must be logged in.' },
        { status: 401 }
      )
    }

    const { data: adminProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', currentUser.id)
      .single()

    if (!adminProfile || adminProfile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden. Only admins can create accounts.' },
        { status: 403 }
      )
    }

    // 2. Parse and validate the request body
    const body: RegisterBody = await request.json()
    const { full_name, email, password, role, commission_rate, hire_date } = body

    if (!full_name || !email || !password || !role) {
      return NextResponse.json(
        { error: 'Missing required fields: full_name, email, password, role.' },
        { status: 400 }
      )
    }

    if (!['setter', 'closer'].includes(role)) {
      return NextResponse.json(
        { error: 'Role must be "setter" or "closer".' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters.' },
        { status: 400 }
      )
    }

    // 3. Create the auth user with the admin client (service role)
    const supabaseAdmin = createAdminClient()

    const { data: newAuthUser, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })

    if (createError) {
      return NextResponse.json(
        { error: createError.message },
        { status: 400 }
      )
    }

    if (!newAuthUser.user) {
      return NextResponse.json(
        { error: 'Failed to create authentication user.' },
        { status: 500 }
      )
    }

    // 4. Insert the user profile into the users table
    const { error: insertError } = await supabaseAdmin.from('users').insert({
      id: newAuthUser.user.id,
      email,
      full_name,
      role,
      status: 'active',
      hire_date: hire_date || new Date().toISOString().split('T')[0],
      commission_rate: commission_rate ?? (role === 'setter' ? 5 : 10),
    })

    if (insertError) {
      // Clean up the auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(newAuthUser.user.id)
      return NextResponse.json(
        { error: `Failed to create user profile: ${insertError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        message: 'Account created successfully.',
        user: {
          id: newAuthUser.user.id,
          email,
          full_name,
          role,
        },
      },
      { status: 201 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
