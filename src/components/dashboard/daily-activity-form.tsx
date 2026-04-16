"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/use-toast"
import { formatCurrency } from "@/lib/utils"
import type { DailyActivity } from "@/types/database"

interface DailyActivityFormProps {
  userId: string
  role: "setter" | "closer"
  existingData?: DailyActivity | null
  date: string
  dealStats?: {
    deals_closed: number
    cash_collected: number
    pif_deals: number
    payment_plan_deals: number
  }
}

const SETTER_FIELD_CONFIG = [
  { key: "dials_made", label: "Dials Made", step: 1 },
  { key: "conversations", label: "Conversations", step: 1 },
  { key: "speed_to_lead_avg_min", label: "Speed to Lead (avg min)", step: 0.1 },
  { key: "qualified_bookings", label: "Qualified Bookings", step: 1 },
  { key: "follow_ups_completed", label: "Follow-Ups Completed", step: 1 },
  { key: "show_confirmations_sent", label: "Show Confirmations Sent", step: 1 },
  { key: "intros_completed", label: "Intros Completed", step: 1 },
  { key: "demos_booked_from_intros", label: "Demos Booked from Intros", step: 1 },
] as const

// Closer only manually enters demos/offers — deal fields come from deals table
const CLOSER_FIELD_CONFIG = [
  { key: "demos_scheduled", label: "Demos Scheduled", step: 1 },
  { key: "demos_completed", label: "Demos Completed", step: 1 },
  { key: "offers_made", label: "Offers Made", step: 1 },
] as const

type FieldValues = Record<string, number | string>

function getInitialFields(role: string, data?: DailyActivity | null): FieldValues {
  if (role === "setter") {
    return {
      dials_made: data?.dials_made ?? 0,
      conversations: data?.conversations ?? 0,
      speed_to_lead_avg_min: data?.speed_to_lead_avg_min ?? 0,
      qualified_bookings: data?.qualified_bookings ?? 0,
      follow_ups_completed: data?.follow_ups_completed ?? 0,
      show_confirmations_sent: data?.show_confirmations_sent ?? 0,
      intros_completed: data?.intros_completed ?? 0,
      demos_booked_from_intros: data?.demos_booked_from_intros ?? 0,
      notes: data?.notes ?? "",
    }
  }
  return {
    demos_scheduled: data?.demos_scheduled ?? 0,
    demos_completed: data?.demos_completed ?? 0,
    offers_made: data?.offers_made ?? 0,
    notes: data?.notes ?? "",
  }
}

export function DailyActivityForm({
  userId,
  role,
  existingData,
  date,
  dealStats,
}: DailyActivityFormProps) {
  const isEditMode = !!existingData
  const [saving, setSaving] = useState(false)
  const [fields, setFields] = useState<FieldValues>(
    getInitialFields(role, existingData)
  )

  const fieldConfig = role === "setter" ? SETTER_FIELD_CONFIG : CLOSER_FIELD_CONFIG

  const handleFieldChange = (key: string, value: string) => {
    const numValue = value === "" ? 0 : Number(value)
    setFields((prev) => ({ ...prev, [key]: numValue }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const { notes, ...numericFields } = fields
      const body: Record<string, unknown> = {
        user_id: userId,
        date,
        ...numericFields,
        notes: notes || null,
      }

      const res = await fetch("/api/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to save activity")
      }

      toast({
        title: "Activity Saved",
        description: isEditMode
          ? "Your activity has been updated successfully."
          : "Today's activity has been logged successfully.",
        variant: "success",
      })
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to save activity. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border-2 border-blue-100">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">
          {isEditMode ? "Edit Today's Activity" : "Log Today's Activity"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {fieldConfig.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={`activity-${field.key}`} className="text-sm font-medium">
                  {field.label}
                </Label>
                <Input
                  id={`activity-${field.key}`}
                  type="number"
                  min={0}
                  step={field.step}
                  value={fields[field.key] ?? ""}
                  onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  placeholder="0"
                  className="h-12 text-base sm:h-10 sm:text-sm"
                />
              </div>
            ))}
          </div>

          {/* Read-only deal stats for closers */}
          {role === "closer" && dealStats && (
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-sm font-medium text-muted-foreground mb-3">
                Today&apos;s Deal Stats (auto-calculated from Deals)
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Deals Closed</p>
                  <p className="text-xl font-bold">{dealStats.deals_closed}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cash Collected</p>
                  <p className="text-xl font-bold text-green-600">{formatCurrency(dealStats.cash_collected)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">PIF Deals</p>
                  <p className="text-xl font-bold">{dealStats.pif_deals}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Payment Plan</p>
                  <p className="text-xl font-bold">{dealStats.payment_plan_deals}</p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="activity-notes" className="text-sm font-medium">
              Notes
            </Label>
            <Textarea
              id="activity-notes"
              value={(fields.notes as string) || ""}
              onChange={(e) => setFields((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Optional notes about today's activities..."
              rows={3}
            />
          </div>

          <Button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto h-12 sm:h-10 text-base sm:text-sm"
          >
            {saving ? "Saving..." : isEditMode ? "Update Activity" : "Save Today's Activity"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
