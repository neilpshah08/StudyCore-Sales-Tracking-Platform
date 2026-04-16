'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import type { UserRole } from '@/types/database'

type RepRole = Extract<UserRole, 'setter' | 'closer'>

const DEFAULT_COMMISSION: Record<RepRole, number> = {
  setter: 5,
  closer: 10,
}

function generatePassword(length = 12): string {
  const charset = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%'
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  return Array.from(array, (byte) => charset[byte % charset.length]).join('')
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

export default function RegisterPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [authorized, setAuthorized] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState(() => generatePassword())
  const [role, setRole] = useState<RepRole>('setter')
  const [commissionRate, setCommissionRate] = useState(DEFAULT_COMMISSION.setter)
  const [hireDate, setHireDate] = useState(todayISO)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Verify the current user is an admin
  useEffect(() => {
    async function checkAdmin() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

      if (!profile || profile.role !== 'admin') {
        router.push('/dashboard')
        return
      }

      setAuthorized(true)
      setCheckingAuth(false)
    }

    checkAdmin()
  }, [router])

  // Update commission rate default when role changes
  useEffect(() => {
    setCommissionRate(DEFAULT_COMMISSION[role])
  }, [role])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName,
          email,
          password,
          role,
          commission_rate: commissionRate / 100,
          hire_date: hireDate,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to create account.')
        setLoading(false)
        return
      }

      toast({
        title: 'Account Created',
        description: `${fullName} (${email}) created successfully. Password: ${password}`,
        variant: 'success',
        duration: 15000,
      })

      // Reset form for next creation
      setFullName('')
      setEmail('')
      setPassword(generatePassword())
      setRole('setter')
      setCommissionRate(DEFAULT_COMMISSION.setter)
      setHireDate(todayISO())
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (checkingAuth || !authorized) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Verifying permissions...
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Rep Account</CardTitle>
        <CardDescription>
          Add a new setter or closer to the sales team.
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {/* Full Name */}
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              type="text"
              placeholder="Jane Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="jane@studycore.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="flex gap-2">
              <Input
                id="password"
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                disabled={loading}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => setPassword(generatePassword())}
                disabled={loading}
              >
                Generate
              </Button>
            </div>
          </div>

          {/* Role */}
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select
              value={role}
              onValueChange={(value: string) => setRole(value as RepRole)}
              disabled={loading}
            >
              <SelectTrigger id="role">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="setter">Setter</SelectItem>
                <SelectItem value="closer">Closer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Commission Rate */}
          <div className="space-y-2">
            <Label htmlFor="commissionRate">Commission Rate (%)</Label>
            <Input
              id="commissionRate"
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={commissionRate}
              onChange={(e) => setCommissionRate(parseFloat(e.target.value) || 0)}
              required
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Enter as a whole number (e.g. 5 for 5%, 10 for 10%). Stored as 0.05, 0.10, etc.
            </p>
          </div>

          {/* Hire Date */}
          <div className="space-y-2">
            <Label htmlFor="hireDate">Hire Date</Label>
            <Input
              id="hireDate"
              type="date"
              value={hireDate}
              onChange={(e) => setHireDate(e.target.value)}
              required
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
            {loading ? 'Creating Account...' : 'Create Account'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
