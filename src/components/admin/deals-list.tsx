"use client"

import { useState, useMemo, useCallback } from "react"
import {
  Plus,
  Download,
  X,
  Pencil,
  Eye,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"
import { cn, formatCurrency, formatDate, exportToCsv } from "@/lib/utils"
import { PAYMENT_PLANS } from "@/lib/constants"
import type { Deal, PaymentPlanType, DealStatus } from "@/types/database"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DealWithNames = Deal & {
  setter_name: string | null
  closer_name: string | null
}

interface DealsListProps {
  deals: DealWithNames[]
  reps: { id: string; full_name: string; role: string }[]
}

interface DealFormData {
  date_closed: string
  student_name: string
  parent_name: string
  setter_id: string
  closer_id: string
  deal_value: string
  payment_plan: PaymentPlanType
  cash_collected: string
  notes: string
}

type StatusFilter = "all" | DealStatus

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_BADGE_CLASS: Record<DealStatus, string> = {
  active: "bg-green-100 text-[#6EE7B7] border-green-200",
  refunded: "bg-yellow-100 text-yellow-800 border-yellow-200",
  chargedback: "bg-red-100 text-[#FCA5A5] border-red-200",
}

const EMPTY_FORM: DealFormData = {
  date_closed: new Date().toISOString().split("T")[0],
  student_name: "",
  parent_name: "",
  setter_id: "",
  closer_id: "",
  deal_value: "",
  payment_plan: "PIF",
  cash_collected: "",
  notes: "",
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DealsList({ deals: initialDeals, reps }: DealsListProps) {
  const { toast } = useToast()

  // Data state
  const [deals, setDeals] = useState<DealWithNames[]>(initialDeals)

  // Filter state
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [setterFilter, setSetterFilter] = useState("all")
  const [closerFilter, setCloserFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [editingDeal, setEditingDeal] = useState<DealWithNames | null>(null)
  const [viewingDeal, setViewingDeal] = useState<DealWithNames | null>(null)
  const [formData, setFormData] = useState<DealFormData>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // Derived rep lists
  const setters = useMemo(
    () => reps.filter((r) => r.role === "setter"),
    [reps]
  )
  const closers = useMemo(
    () => reps.filter((r) => r.role === "closer"),
    [reps]
  )

  // Filtered deals
  const filteredDeals = useMemo(() => {
    let result = [...deals]

    if (startDate) {
      result = result.filter((d) => d.date_closed >= startDate)
    }
    if (endDate) {
      result = result.filter((d) => d.date_closed <= endDate)
    }
    if (setterFilter !== "all") {
      result = result.filter((d) => d.setter_id === setterFilter)
    }
    if (closerFilter !== "all") {
      result = result.filter((d) => d.closer_id === closerFilter)
    }
    if (statusFilter !== "all") {
      result = result.filter((d) => d.status === statusFilter)
    }

    return result
  }, [deals, startDate, endDate, setterFilter, closerFilter, statusFilter])

  // ------------------------------------------------------------------
  // Handlers
  // ------------------------------------------------------------------

  const clearFilters = useCallback(() => {
    setStartDate("")
    setEndDate("")
    setSetterFilter("all")
    setCloserFilter("all")
    setStatusFilter("all")
  }, [])

  const handleExportCsv = useCallback(() => {
    const rows = filteredDeals.map((d) => ({
      Date: formatDate(d.date_closed),
      "Student Name": d.student_name,
      "Parent Name": d.parent_name ?? "",
      Setter: d.setter_name ?? "",
      Closer: d.closer_name ?? "",
      "Deal Value": d.deal_value,
      "Payment Plan": d.payment_plan,
      "Cash Collected": d.cash_collected,
      "Setter Commission": d.setter_commission ?? 0,
      "Closer Commission": d.closer_commission ?? 0,
      "PIF Bonus": d.pif_bonus,
      "Total Commission": d.total_commission ?? 0,
      Status: d.status,
      Notes: d.notes ?? "",
    }))

    const start = startDate || "all"
    const end = endDate || "today"
    exportToCsv(rows, `deals_${start}_to_${end}.csv`)
  }, [filteredDeals, startDate, endDate])

  const openAddDialog = useCallback(() => {
    setEditingDeal(null)
    setFormData(EMPTY_FORM)
    setDialogOpen(true)
  }, [])

  const openEditDialog = useCallback((deal: DealWithNames) => {
    setEditingDeal(deal)
    setFormData({
      date_closed: deal.date_closed,
      student_name: deal.student_name,
      parent_name: deal.parent_name ?? "",
      setter_id: deal.setter_id ?? "",
      closer_id: deal.closer_id ?? "",
      deal_value: String(deal.deal_value),
      payment_plan: deal.payment_plan,
      cash_collected: String(deal.cash_collected),
      notes: deal.notes ?? "",
    })
    setDialogOpen(true)
  }, [])

  const openViewDialog = useCallback((deal: DealWithNames) => {
    setViewingDeal(deal)
    setViewDialogOpen(true)
  }, [])

  const refreshDeals = useCallback(async () => {
    try {
      const res = await fetch("/api/deals")
      if (!res.ok) throw new Error("Failed to fetch deals")
      const json = await res.json()
      setDeals(json.data ?? [])
    } catch {
      // Silently fail -- user still has stale data visible
    }
  }, [])

  const handleSave = useCallback(async () => {
    // Validate required fields
    if (!formData.student_name.trim()) {
      toast({ title: "Validation Error", description: "Student name is required.", variant: "destructive" })
      return
    }
    if (!formData.deal_value || Number(formData.deal_value) <= 0) {
      toast({ title: "Validation Error", description: "Deal value must be greater than 0.", variant: "destructive" })
      return
    }

    setSaving(true)

    try {
      const payload = {
        date_closed: formData.date_closed,
        student_name: formData.student_name.trim(),
        parent_name: formData.parent_name.trim() || null,
        setter_id: formData.setter_id || null,
        closer_id: formData.closer_id || null,
        deal_value: Number(formData.deal_value),
        payment_plan: formData.payment_plan,
        cash_collected: Number(formData.cash_collected) || 0,
        notes: formData.notes.trim() || null,
      }

      let res: Response

      if (editingDeal) {
        res = await fetch(`/api/deals/${editingDeal.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch("/api/deals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      }

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to save deal")
      }

      toast({
        title: editingDeal ? "Deal Updated" : "Deal Created",
        description: `Deal for ${formData.student_name} has been ${editingDeal ? "updated" : "created"} successfully.`,
        variant: "success",
      })

      setDialogOpen(false)
      await refreshDeals()
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }, [formData, editingDeal, toast, refreshDeals])

  const updateField = useCallback(
    <K extends keyof DealFormData>(field: K, value: DealFormData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }))
    },
    []
  )

  // Commission preview (read-only, approximate on client)
  const commissionPreview = useMemo(() => {
    const dv = Number(formData.deal_value) || 0
    // Rough estimates -- actual values calculated server-side
    const setterRate = 0.05 // placeholder display
    const closerRate = 0.10 // placeholder display
    const pifRate = 0.05

    const setter = formData.setter_id ? Math.round(dv * setterRate * 100) / 100 : 0
    const closer = formData.closer_id ? Math.round(dv * closerRate * 100) / 100 : 0
    const pif = formData.payment_plan === "PIF" ? Math.round(dv * pifRate * 100) / 100 : 0

    return { setter, closer, pif, total: Math.round((setter + closer + pif) * 100) / 100 }
  }, [formData.deal_value, formData.setter_id, formData.closer_id, formData.payment_plan])

  // ------------------------------------------------------------------
  // Render helpers
  // ------------------------------------------------------------------

  const hasFilters = startDate || endDate || setterFilter !== "all" || closerFilter !== "all" || statusFilter !== "all"

  return (
    <>
      {/* Filter Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-3">
            {/* Date Range */}
            <div className="space-y-1">
              <Label className="text-xs text-white/55">Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-[150px]"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-white/55">End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-[150px]"
              />
            </div>

            {/* Setter Filter */}
            <div className="space-y-1">
              <Label className="text-xs text-white/55">Setter</Label>
              <Select value={setterFilter} onValueChange={setSetterFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="All Setters" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Setters</SelectItem>
                  {setters.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Closer Filter */}
            <div className="space-y-1">
              <Label className="text-xs text-white/55">Closer</Label>
              <Select value={closerFilter} onValueChange={setCloserFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="All Closers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Closers</SelectItem>
                  {closers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="space-y-1">
              <Label className="text-xs text-white/55">Status</Label>
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as StatusFilter)}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                  <SelectItem value="chargedback">Chargedback</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Action Buttons */}
            <div className="flex items-end gap-2 ml-auto">
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="mr-1 h-4 w-4" />
                  Clear Filters
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleExportCsv}>
                <Download className="mr-1 h-4 w-4" />
                Export CSV
              </Button>
              <Button size="sm" onClick={openAddDialog}>
                <Plus className="mr-1 h-4 w-4" />
                Add Deal
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Deals Table */}
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Student Name</TableHead>
                <TableHead>Parent Name</TableHead>
                <TableHead>Setter</TableHead>
                <TableHead>Closer</TableHead>
                <TableHead className="text-right">Deal Value</TableHead>
                <TableHead>Payment Plan</TableHead>
                <TableHead className="text-right">Cash Collected</TableHead>
                <TableHead className="text-right">Commission</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDeals.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={11}
                    className="text-center text-white/55 py-8"
                  >
                    No deals found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredDeals.map((deal) => (
                  <TableRow
                    key={deal.id}
                    className="cursor-pointer"
                    onClick={() => openEditDialog(deal)}
                  >
                    <TableCell className="whitespace-nowrap">
                      {formatDate(deal.date_closed)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {deal.student_name}
                    </TableCell>
                    <TableCell>{deal.parent_name ?? "-"}</TableCell>
                    <TableCell>{deal.setter_name ?? "-"}</TableCell>
                    <TableCell>{deal.closer_name ?? "-"}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(deal.deal_value)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {deal.payment_plan}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(deal.cash_collected)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(deal.total_commission ?? 0)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "capitalize",
                          STATUS_BADGE_CLASS[deal.status]
                        )}
                      >
                        {deal.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation()
                            openViewDialog(deal)
                          }}
                        >
                          <Eye className="h-4 w-4" />
                          <span className="sr-only">View</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation()
                            openEditDialog(deal)
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Edit</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {filteredDeals.length > 0 && (
            <div className="mt-4 text-xs text-white/55">
              Showing {filteredDeals.length} of {deals.length} deals
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Deal Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingDeal ? "Edit Deal" : "Add New Deal"}
            </DialogTitle>
            <DialogDescription>
              {editingDeal
                ? "Update the deal details below. Commissions will be recalculated automatically."
                : "Enter deal details. Commissions will be calculated automatically on save."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Row 1: Date Closed */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date_closed">Date Closed</Label>
                <Input
                  id="date_closed"
                  type="date"
                  value={formData.date_closed}
                  onChange={(e) => updateField("date_closed", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment_plan">Payment Plan</Label>
                <Select
                  value={formData.payment_plan}
                  onValueChange={(v) =>
                    updateField("payment_plan", v as PaymentPlanType)
                  }
                >
                  <SelectTrigger id="payment_plan">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_PLANS.map((plan) => (
                      <SelectItem key={plan} value={plan}>
                        {plan}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 2: Student and Parent names */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="student_name">
                  Student Name <span className="text-[#EF4444]">*</span>
                </Label>
                <Input
                  id="student_name"
                  placeholder="Enter student name"
                  value={formData.student_name}
                  onChange={(e) => updateField("student_name", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="parent_name">Parent Name</Label>
                <Input
                  id="parent_name"
                  placeholder="Enter parent name"
                  value={formData.parent_name}
                  onChange={(e) => updateField("parent_name", e.target.value)}
                />
              </div>
            </div>

            {/* Row 3: Setter and Closer */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="setter_id">Setter</Label>
                <Select
                  value={formData.setter_id || "none"}
                  onValueChange={(v) =>
                    updateField("setter_id", v === "none" ? "" : v)
                  }
                >
                  <SelectTrigger id="setter_id">
                    <SelectValue placeholder="Select setter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {setters.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="closer_id">Closer</Label>
                <Select
                  value={formData.closer_id || "none"}
                  onValueChange={(v) =>
                    updateField("closer_id", v === "none" ? "" : v)
                  }
                >
                  <SelectTrigger id="closer_id">
                    <SelectValue placeholder="Select closer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {closers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 4: Deal Value and Cash Collected */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="deal_value">
                  Deal Value <span className="text-[#EF4444]">*</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-white/55">
                    $
                  </span>
                  <Input
                    id="deal_value"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="pl-7"
                    value={formData.deal_value}
                    onChange={(e) => updateField("deal_value", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cash_collected">Cash Collected</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-white/55">
                    $
                  </span>
                  <Input
                    id="cash_collected"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="pl-7"
                    value={formData.cash_collected}
                    onChange={(e) =>
                      updateField("cash_collected", e.target.value)
                    }
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any additional notes about this deal..."
                value={formData.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                rows={3}
              />
            </div>

            {/* Commission Preview */}
            <div className="rounded-md border bg-muted/50 p-4 space-y-2">
              <p className="text-sm font-medium">
                Commission Preview{" "}
                <span className="font-normal text-white/55">
                  (estimated -- final values calculated on save)
                </span>
              </p>
              {editingDeal ? (
                <div className="grid grid-cols-4 gap-3 text-sm">
                  <div>
                    <span className="text-white/55">Setter</span>
                    <p className="font-medium">
                      {formatCurrency(editingDeal.setter_commission ?? 0)}
                    </p>
                  </div>
                  <div>
                    <span className="text-white/55">Closer</span>
                    <p className="font-medium">
                      {formatCurrency(editingDeal.closer_commission ?? 0)}
                    </p>
                  </div>
                  <div>
                    <span className="text-white/55">PIF Bonus</span>
                    <p className="font-medium">
                      {formatCurrency(editingDeal.pif_bonus)}
                    </p>
                  </div>
                  <div>
                    <span className="text-white/55">Total</span>
                    <p className="font-semibold text-[#10B981]">
                      {formatCurrency(editingDeal.total_commission ?? 0)}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-3 text-sm">
                  <div>
                    <span className="text-white/55">Setter</span>
                    <p className="font-medium">
                      ~{formatCurrency(commissionPreview.setter)}
                    </p>
                  </div>
                  <div>
                    <span className="text-white/55">Closer</span>
                    <p className="font-medium">
                      ~{formatCurrency(commissionPreview.closer)}
                    </p>
                  </div>
                  <div>
                    <span className="text-white/55">PIF Bonus</span>
                    <p className="font-medium">
                      ~{formatCurrency(commissionPreview.pif)}
                    </p>
                  </div>
                  <div>
                    <span className="text-white/55">Total</span>
                    <p className="font-semibold text-[#10B981]">
                      ~{formatCurrency(commissionPreview.total)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingDeal ? "Update Deal" : "Create Deal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Deal Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Deal Details</DialogTitle>
            <DialogDescription>
              {viewingDeal
                ? `${viewingDeal.student_name} - ${formatDate(viewingDeal.date_closed)}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {viewingDeal && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <span className="text-white/55">Date Closed</span>
                  <p className="font-medium">
                    {formatDate(viewingDeal.date_closed)}
                  </p>
                </div>
                <div>
                  <span className="text-white/55">Status</span>
                  <p>
                    <Badge
                      variant="outline"
                      className={cn(
                        "capitalize",
                        STATUS_BADGE_CLASS[viewingDeal.status]
                      )}
                    >
                      {viewingDeal.status}
                    </Badge>
                  </p>
                </div>
                <div>
                  <span className="text-white/55">Student Name</span>
                  <p className="font-medium">{viewingDeal.student_name}</p>
                </div>
                <div>
                  <span className="text-white/55">Parent Name</span>
                  <p className="font-medium">
                    {viewingDeal.parent_name || "-"}
                  </p>
                </div>
                <div>
                  <span className="text-white/55">Setter</span>
                  <p className="font-medium">
                    {viewingDeal.setter_name || "-"}
                  </p>
                </div>
                <div>
                  <span className="text-white/55">Closer</span>
                  <p className="font-medium">
                    {viewingDeal.closer_name || "-"}
                  </p>
                </div>
                <div>
                  <span className="text-white/55">Deal Value</span>
                  <p className="font-medium">
                    {formatCurrency(viewingDeal.deal_value)}
                  </p>
                </div>
                <div>
                  <span className="text-white/55">Payment Plan</span>
                  <p>
                    <Badge variant="outline" className="capitalize">
                      {viewingDeal.payment_plan}
                    </Badge>
                  </p>
                </div>
                <div>
                  <span className="text-white/55">Cash Collected</span>
                  <p className="font-medium">
                    {formatCurrency(viewingDeal.cash_collected)}
                  </p>
                </div>
                <div>
                  <span className="text-white/55">Payout Date</span>
                  <p className="font-medium">
                    {viewingDeal.payout_date
                      ? formatDate(viewingDeal.payout_date)
                      : "-"}
                  </p>
                </div>
              </div>

              {/* Commission Breakdown */}
              <div className="rounded-md border bg-muted/50 p-4 space-y-2">
                <p className="text-sm font-medium">Commission Breakdown</p>
                <div className="grid grid-cols-4 gap-3 text-sm">
                  <div>
                    <span className="text-white/55">Setter</span>
                    <p className="font-medium">
                      {formatCurrency(viewingDeal.setter_commission ?? 0)}
                    </p>
                  </div>
                  <div>
                    <span className="text-white/55">Closer</span>
                    <p className="font-medium">
                      {formatCurrency(viewingDeal.closer_commission ?? 0)}
                    </p>
                  </div>
                  <div>
                    <span className="text-white/55">PIF Bonus</span>
                    <p className="font-medium">
                      {formatCurrency(viewingDeal.pif_bonus)}
                    </p>
                  </div>
                  <div>
                    <span className="text-white/55">Total</span>
                    <p className="font-semibold text-[#10B981]">
                      {formatCurrency(viewingDeal.total_commission ?? 0)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Clawback info */}
              {viewingDeal.clawback && (
                <div className="rounded-md border border-red-200 bg-[#EF4444]/8 p-4 text-sm">
                  <p className="font-medium text-[#FCA5A5]">Clawback Active</p>
                  <p className="text-[#FCA5A5]">
                    Amount: {formatCurrency(viewingDeal.clawback_amount)}
                  </p>
                  {viewingDeal.lost_reason && (
                    <p className="text-[#FCA5A5]">
                      Reason: {viewingDeal.lost_reason}
                    </p>
                  )}
                </div>
              )}

              {/* Notes */}
              {viewingDeal.notes && (
                <div>
                  <span className="text-sm text-white/55">Notes</span>
                  <p className="mt-1 text-sm whitespace-pre-wrap rounded-md border bg-muted/30 p-3">
                    {viewingDeal.notes}
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setViewDialogOpen(false)}
            >
              Close
            </Button>
            {viewingDeal && (
              <Button
                onClick={() => {
                  setViewDialogOpen(false)
                  openEditDialog(viewingDeal)
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit Deal
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
