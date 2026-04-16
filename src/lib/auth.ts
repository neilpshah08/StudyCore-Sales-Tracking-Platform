import { cache } from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import type { User } from "@/types/database"

export type AuthUser = {
  id: string
  email: string
}

export type UserProfile = User

export const getAuthUser = cache(async (): Promise<AuthUser | null> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return { id: user.id, email: user.email! }
})

export const getUserProfile = cache(async (): Promise<UserProfile | null> => {
  const authUser = await getAuthUser()
  if (!authUser) return null

  const supabase = await createClient()
  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .single()

  return data
})

export const requireAuth = cache(async (): Promise<{ authUser: AuthUser; profile: UserProfile }> => {
  const authUser = await getAuthUser()
  if (!authUser) redirect("/login")

  const profile = await getUserProfile()
  if (!profile) redirect("/login")

  if (profile.status !== "active") {
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect("/login")
  }

  return { authUser, profile }
})

export const requireAdmin = cache(async (): Promise<{ authUser: AuthUser; profile: UserProfile }> => {
  const result = await requireAuth()
  if (result.profile.role !== "admin") redirect("/dashboard")
  return result
})
