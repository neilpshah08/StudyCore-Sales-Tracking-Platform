"use client"

import { createContext, useContext } from "react"
import type { UserRole, UserStatus } from "@/types/database"

export interface AuthContextUser {
  id: string
  email: string
  full_name: string
  role: UserRole
  status: UserStatus
}

const AuthContext = createContext<AuthContextUser | null>(null)

export function AuthProvider({
  user,
  children,
}: {
  user: AuthContextUser
  children: React.ReactNode
}) {
  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextUser {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
