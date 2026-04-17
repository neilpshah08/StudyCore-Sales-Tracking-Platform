"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/use-toast"
import type { RepGoal } from "@/types/database"

interface GoalSetterProps {
  userId: string
  role: "setter" | "closer"
  weekStart: string
  existingGoals?: RepGoal[]
}

const SETTER_GOAL_FIELDS = [
  { key: "dials", label: "Dials Goal" },
  { key: "conversations", label: "Conversations Goal" },
  { key: "bookings", label: "Bookings Goal" },
] as const

const CLOSER_GOAL_FIELDS = [
  { key: "deals_closed", label: "Deals Closed Goal" },
  { key: "cash_collected", label: "Cash Collected Goal" },
] as const

export function GoalSetter({ userId, role, weekStart, existingGoals = [] }: GoalSetterProps) {
  const fields = role === "setter" ? SETTER_GOAL_FIELDS : CLOSER_GOAL_FIELDS

  const getInitialValues = useCallback(() => {
    const values: Record<string, number> = {}
    for (const field of fields) {
      const existing = existingGoals.find((g) => g.goal_metric === field.key)
      values[field.key] = existing?.goal_value ?? 0
    }
    return values
  }, [existingGoals, fields])

  const [values, setValues] = useState<Record<string, number>>(getInitialValues)
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    setValues(getInitialValues())
  }, [getInitialValues])

  const saveGoal = useCallback(
    async (metric: string, value: number) => {
      try {
        const res = await fetch("/api/goals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: userId,
            week_start: weekStart,
            goal_metric: metric,
            goal_value: value,
          }),
        })
        if (!res.ok) {
          throw new Error("Failed to save goal")
        }
      } catch {
        toast({
          title: "Error",
          description: "Failed to save goal. Please try again.",
          variant: "destructive",
        })
      }
    },
    [userId, weekStart]
  )

  const handleChange = (metric: string, rawValue: string) => {
    const numValue = rawValue === "" ? 0 : Number(rawValue)
    setValues((prev) => ({ ...prev, [metric]: numValue }))

    if (debounceTimers.current[metric]) {
      clearTimeout(debounceTimers.current[metric])
    }
    debounceTimers.current[metric] = setTimeout(() => {
      saveGoal(metric, numValue)
    }, 800)
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <span role="img" aria-label="target">
            🎯
          </span>
          Personal Goals
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {fields.map((field) => (
            <div key={field.key} className="space-y-1">
              <Label htmlFor={`goal-${field.key}`} className="text-xs text-white/60 uppercase tracking-wider font-semibold">
                {field.label}
              </Label>
              <Input
                id={`goal-${field.key}`}
                type="number"
                min={0}
                step={field.key === "cash_collected" ? 100 : 1}
                value={values[field.key] || ""}
                onChange={(e) => handleChange(field.key, e.target.value)}
                placeholder="0"
                className="h-9"
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
