'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from '@/components/ui/card'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError(signInError.message)
        setLoading(false)
        return
      }

      // Fetch user profile to determine role-based redirect
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setError('Unable to retrieve user information.')
        setLoading(false)
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('role, status')
        .eq('id', user.id)
        .single()

      if (profileError || !profile) {
        setError('User profile not found. Please contact an administrator.')
        setLoading(false)
        return
      }

      if (profile.status !== 'active') {
        await supabase.auth.signOut()
        setError('Your account has been deactivated. Please contact an administrator.')
        setLoading(false)
        return
      }

      // Redirect based on role
      if (profile.role === 'admin') {
        router.push('/admin')
      } else {
        router.push('/dashboard')
      }
      router.refresh()
    } catch {
      setError('An unexpected error occurred. Please try again.')
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader className="text-center space-y-1">
        <h1 className="text-3xl font-bold" style={{ color: '#1B2A4A' }}>
          StudyCore
        </h1>
        <p className="text-sm text-muted-foreground">Sales Tracker</p>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </CardContent>

        <CardFooter>
          <Button
            type="submit"
            className="w-full bg-[#1B2A4A] hover:bg-[#2A3F6A] text-white"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
