"use client"

import { useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/use-toast"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn, formatCurrency, formatDate } from "@/lib/utils"
import type { DailyActivity } from "@/types/database"

interface ActivityHistoryProps {
  activities: DailyActivity[]
  role: "setter" | "closer"
}

const ITEMS_PER_PAGE = 10

function isEditable(createdAt: string): boolean {
  const created = new Date(createdAt)
  const now = new Date()
  const diffMs = now.getTime() - created.getTime()
  const diffHours = diffMs / (1000 * 60 * 60)
  return diffHours <= 48
}

const SETTER_EDIT_FIELDS = [
  { key: "dials_made", label: "Dials Made", step: 1 },
  { key: "conversations", label: "Conversations", step: 1 },
  { key: "speed_to_lead_avg_min", label: "Speed to Lead (avg min)", step: 0.1 },
  { key: "qualified_bookings", label: "Qualified Bookings", step: 1 },
  { key: "follow_ups_completed", label: "Follow-Ups Completed", step: 1 },
  { key: "show_confirmations_sent", label: "Show Confirmations Sent", step: 1 },
  { key: "intros_completed", label: "Intros Completed", step: 1 },
  { key: "demos_booked_from_intros", label: "Demos Booked from Intros", step: 1 },
] as const

const CLOSER_EDIT_FIELDS = [
  { key: "demos_scheduled", label: "Demos Scheduled", step: 1 },
  { key: "demos_completed", label: "Demos Completed", step: 1 },
  { key: "offers_made", label: "Offers Made", step: 1 },
  { key: "deals_closed", label: "Deals Closed", step: 1 },
  { key: "cash_collected", label: "Cash Collected ($)", step: 0.01 },
  { key: "pif_deals", label: "PIF Deals", step: 1 },
  { key: "payment_plan_deals", label: "Payment Plan Deals", step: 1 },
] as const

export function ActivityHistory({ activities, role }: ActivityHistoryProps) {
  const [editingActivity, setEditingActivity] = useState<DailyActivity | null>(null)
  const [editValues, setEditValues] = useState<Record<string, number | string>>({})
  const [saving, setSaving] = useState(false)
  const [page, setPage] = useState(0)

  const totalPages = Math.ceil(activities.length / ITEMS_PER_PAGE)
  const paginatedActivities = activities.slice(
    page * ITEMS_PER_PAGE,
    (page + 1) * ITEMS_PER_PAGE
  )

  const editFields = role === "setter" ? SETTER_EDIT_FIELDS : CLOSER_EDIT_FIELDS

  const openEditDialog = (activity: DailyActivity) => {
    if (!isEditable(activity.created_at)) return

    const values: Record<string, number | string> = {}
    for (const field of editFields) {
      values[field.key] = ((activity as unknown as Record<string, unknown>)[field.key] as number) ?? 0
    }
    values.notes = activity.notes ?? ""
    setEditValues(values)
    setEditingActivity(activity)
  }

  const handleEditSave = async () => {
    if (!editingActivity) return
    setSaving(true)

    try {
      const body = {
        user_id: editingActivity.user_id,
        date: editingActivity.date,
        ...editValues,
      }

      const res = await fetch("/api/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        throw new Error("Failed to update activity")
      }

      toast({
        title: "Activity Updated",
        description: `Activity for ${formatDate(editingActivity.date)} has been updated.`,
        variant: "success",
      })

      setEditingActivity(null)
    } catch {
      toast({
        title: "Error",
        description: "Failed to update activity. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <TooltipProvider>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">My History</CardTitle>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No activity history yet. Start logging your daily activity!
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      {role === "setter" ? (
                        <>
                          <TableHead className="text-right">Dials</TableHead>
                          <TableHead className="text-right">Convos</TableHead>
                          <TableHead className="text-right">Bookings</TableHead>
                          <TableHead className="text-right">Follow-Ups</TableHead>
                          <TableHead className="text-right">Intros</TableHead>
                        </>
                      ) : (
                        <>
                          <TableHead className="text-right">Demos</TableHead>
                          <TableHead className="text-right">Offers</TableHead>
                          <TableHead className="text-right">Closed</TableHead>
                          <TableHead className="text-right">Cash</TableHead>
                          <TableHead className="text-right">PIF</TableHead>
                        </>
                      )}
                      <TableHead className="w-32">Notes</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedActivities.map((activity) => {
                      const editable = isEditable(activity.created_at)
                      return (
                        <TableRow
                          key={activity.id}
                          className={cn(
                            editable && "cursor-pointer hover:bg-blue-50/50"
                          )}
                          onClick={() => editable && openEditDialog(activity)}
                        >
                          <TableCell className="font-medium whitespace-nowrap">
                            {formatDate(activity.date)}
                          </TableCell>
                          {role === "setter" ? (
                            <>
                              <TableCell className="text-right">{activity.dials_made}</TableCell>
                              <TableCell className="text-right">{activity.conversations}</TableCell>
                              <TableCell className="text-right">{activity.qualified_bookings}</TableCell>
                              <TableCell className="text-right">{activity.follow_ups_completed}</TableCell>
                              <TableCell className="text-right">{activity.intros_completed}</TableCell>
                            </>
                          ) : (
                            <>
                              <TableCell className="text-right">{activity.demos_completed}</TableCell>
                              <TableCell className="text-right">{activity.offers_made}</TableCell>
                              <TableCell className="text-right">{activity.deals_closed}</TableCell>
                              <TableCell className="text-right">{formatCurrency(activity.cash_collected)}</TableCell>
                              <TableCell className="text-right">{activity.pif_deals}</TableCell>
                            </>
                          )}
                          <TableCell className="max-w-[120px]">
                            {activity.notes ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-xs text-muted-foreground truncate block">
                                    {activity.notes.length > 30
                                      ? `${activity.notes.slice(0, 30)}...`
                                      : activity.notes}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="text-sm">{activity.notes}</p>
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {!editable && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span
                                    className="text-muted-foreground"
                                    role="img"
                                    aria-label="locked"
                                  >
                                    {"\u{1F512}"}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-sm">Editing locked after 48 hours</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page + 1} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}

          {/* Edit Dialog */}
          <Dialog
            open={!!editingActivity}
            onOpenChange={(open) => {
              if (!open) setEditingActivity(null)
            }}
          >
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  Edit Activity - {editingActivity && formatDate(editingActivity.date)}
                </DialogTitle>
                <DialogDescription>
                  Update your activity metrics for this day.
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
                {editFields.map((field) => (
                  <div key={field.key} className="space-y-1.5">
                    <Label htmlFor={`edit-${field.key}`} className="text-sm">
                      {field.label}
                    </Label>
                    <Input
                      id={`edit-${field.key}`}
                      type="number"
                      min={0}
                      step={field.step}
                      value={editValues[field.key] ?? 0}
                      onChange={(e) =>
                        setEditValues((prev) => ({
                          ...prev,
                          [field.key]:
                            e.target.value === "" ? 0 : Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                ))}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-notes" className="text-sm">
                  Notes
                </Label>
                <Textarea
                  id="edit-notes"
                  value={(editValues.notes as string) ?? ""}
                  onChange={(e) =>
                    setEditValues((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setEditingActivity(null)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button onClick={handleEditSave} disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}
