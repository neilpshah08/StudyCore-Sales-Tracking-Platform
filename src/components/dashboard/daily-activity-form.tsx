"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/use-toast"
import type { DailyActivity } from "@/types/database"

interface DailyActivityFormProps {
  userId: string
  role: "setter" | "closer"
  existingData?: DailyActivity | null
  date: string
}

interface SetterFields {
  dials_made: number
  conversations: number
  speed_to_lead_avg_min: number
  qualified_bookings: number
  follow_ups_completed: number
  show_confirmations_sent: number
  intros_completed: number
  demos_booked_from_intros: number
  notes: string
}

interface CloserFields {
  demos_scheduled: number
  demos_completed: number
  offers_made: number
  deals_closed: number
  cash_collected: number
  pif_deals: number
  payment_plan_deals: number
  notes: string
}

const SETTER_FIELD_CONFIG = [
  { key: "dials_made", label: "Dials Made", type: "number", step: 1 },
  { key: "conversations", label: "Conversations", type: "number", step: 1 },
  { key: "speed_to_lead_avg_min", label: "Speed to Lead (avg min)", type: "number", step: 0.1 },
  { key: "qualified_bookings", label: "Qualified Bookings", type: "number", step: 1 },
  { key: "follow_ups_completed", label: "Follow-Ups Completed", type: "number", step: 1 },
  { key: "show_confirmations_sent", label: "Show Confirmations Sent", type: "number", step: 1 },
  { key: "intros_completed", label: "Intros Completed", type: "number", step: 1 },
  { key: "demos_booked_from_intros", label: "Demos Booked from Intros", type: "number", step: 1 },
] as const

const CLOSER_FIELD_CONFIG = [
  { key: "demos_scheduled", label: "Demos Scheduled", type: "number", step: 1 },
  { key: "demos_completed", label: "Demos Completed", type: "number", step: 1 },
  { key: "offers_made", label: "Offers Made", type: "number", step: 1 },
  { key: "deals_closed", label: "Deals Closed", type: "number", step: 1 },
  { key: "cash_collected", label: "Cash Collected ($)", type: "number", step: 0.01 },
  { key: "pif_deals", label: "PIF Deals", type: "number", step: 1 },
  { key: "payment_plan_deals", label: "Payment Plan Deals", type: "number", step: 1 },
] as const

function getInitialSetterFields(data?: DailyActivity | null): SetterFields {
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

function getInitialCloserFields(data?: DailyActivity | null): CloserFields {
  return {
    demos_scheduled: data?.demos_scheduled ?? 0,
    demos_completed: data?.demos_completed ?? 0,
    offers_made: data?.offers_made ?? 0,
    deals_closed: data?.deals_closed ?? 0,
    cash_collected: data?.cash_collected ?? 0,
    pif_deals: data?.pif_deals ?? 0,
    payment_plan_deals: data?.payment_plan_deals ?? 0,
    notes: data?.notes ?? "",
  }
}

export function DailyActivityForm({
  userId,
  role,
  existingData,
  date,
}: DailyActivityFormProps) {
  const isEditMode = !!existingData
  const [saving, setSaving] = useState(false)

  const [setterFields, setSetterFields] = useState<SetterFields>(
    getInitialSetterFields(existingData)
  )
  const [closerFields, setCloserFields] = useState<CloserFields>(
    getInitialCloserFields(existingData)
  )

  const fieldConfig = role === "setter" ? SETTER_FIELD_CONFIG : CLOSER_FIELD_CONFIG
  const fields = role === "setter" ? setterFields : closerFields

  const handleFieldChange = (key: string, value: string) => {
    const numValue = value === "" ? 0 : Number(value)
    if (role === "setter") {
      setSetterFields((prev) => ({ ...prev, [key]: key === "notes" ? value : numValue }))
    } else {
      setCloserFields((prev) => ({ ...prev, [key]: key === "notes" ? value : numValue }))
    }
  }

  const handleNotesChange = (value: string) => {
    if (role === "setter") {
      setSetterFields((prev) => ({ ...prev, notes: value }))
    } else {
      setCloserFields((prev) => ({ ...prev, notes: value }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const body = {
        user_id: userId,
        date,
        ...(role === "setter" ? setterFields : closerFields),
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
                  value={(fields as unknown as Record<string, number | string>)[field.key] || ""}
                  onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  placeholder="0"
                  className="h-12 text-base sm:h-10 sm:text-sm"
                />
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="activity-notes" className="text-sm font-medium">
              Notes
            </Label>
            <Textarea
              id="activity-notes"
              value={role === "setter" ? setterFields.notes : closerFields.notes}
              onChange={(e) => handleNotesChange(e.target.value)}
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
