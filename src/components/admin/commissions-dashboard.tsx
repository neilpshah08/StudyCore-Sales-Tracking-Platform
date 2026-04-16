"use client"

import { useState, useMemo, useCallback } from "react"
import {
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  Download,
  Plus,
  Pencil,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { cn, formatCurrency, formatDate, formatPercent, exportToCsv } from "@/lib/utils"
import type { CommissionRate, UserRole } from "@/types/database"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CommissionSummary {
  total_owed: number
  total_paid_this_month: number
  total_clawbacks: number
}

export interface RepCommission {
  rep_id: string
  rep_name: string
  role: string
  total_deals: number
  total_commission_earned: number
  total_paid: number
  total_clawbacks: number
  total_outstanding: number
}

export interface PayoutEntry {
  id: string
  date: string
  rep_name: string
  amount_paid: number
  num_deals: number
  notes: string
  admin_name: string
}

interface CommissionsDashboardProps {
  summary: CommissionSummary
  repBreakdown: RepCommission[]
  rates: CommissionRate[]
  payoutLog: PayoutEntry[]
}

interface PayoutFormData {
  rep_id: string
  amount: string
  payout_date: string
  notes: string
}

interface RateFormData {
  id: string
  role: UserRole
  label: string
  rate: string
  pif_bonus_rate: string
  min_close_rate: string
  effective_date: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommissionsDashboard({
  summary: initialSummary,
  repBreakdown: initialRepBreakdown,
  rates: initialRates,
  payoutLog: initialPayoutLog,
}: CommissionsDashboardProps) {
  const { toast } = useToast()

  // Data state
  const [summary, setSummary] = useState(initialSummary)
  const [repBreakdown, setRepBreakdown] = useState(initialRepBreakdown)
  const [rates, setRates] = useState(initialRates)
  const [payoutLog, setPayoutLog] = useState(initialPayoutLog)

  // Payout dialog state
  const [payoutDialogOpen, setPayoutDialogOpen] = useState(false)
  const [payoutForm, setPayoutForm] = useState<PayoutFormData>({
    rep_id: "",
    amount: "",
    payout_date: new Date().toISOString().split("T")[0],
    notes: "",
  })
  const [payoutSaving, setPayoutSaving] = useState(false)

  // Rate dialog state
  const [rateDialogOpen, setRateDialogOpen] = useState(false)
  const [editingRate, setEditingRate] = useState<CommissionRate | null>(null)
  const [rateForm, setRateForm] = useState<RateFormData>({
    id: "",
    role: "setter",
    label: "",
    rate: "",
    pif_bonus_rate: "",
    min_close_rate: "",
    effective_date: new Date().toISOString().split("T")[0],
  })
  const [rateSaving, setRateSaving] = useState(false)

  // ------------------------------------------------------------------
  // Summary Cards
  // ------------------------------------------------------------------

  const summaryCards = [
    {
      title: "Total Commission Owed",
      value: formatCurrency(summary.total_owed),
      icon: DollarSign,
      colorClass: "text-amber-600",
      bgClass: "bg-amber-50 border-amber-200",
      iconClass: "text-amber-500",
    },
    {
      title: "Total Paid This Month",
      value: formatCurrency(summary.total_paid_this_month),
      icon: CheckCircle2,
      colorClass: "text-green-600",
      bgClass: "bg-green-50 border-green-200",
      iconClass: "text-green-500",
    },
    {
      title: "Total Clawbacks",
      value: formatCurrency(summary.total_clawbacks),
      icon: AlertTriangle,
      colorClass: "text-red-600",
      bgClass: "bg-red-50 border-red-200",
      iconClass: "text-red-500",
    },
  ]

  // ------------------------------------------------------------------
  // Payout handlers
  // ------------------------------------------------------------------

  const openPayoutDialog = useCallback(
    (rep: RepCommission) => {
      setPayoutForm({
        rep_id: rep.rep_id,
        amount: String(rep.total_outstanding),
        payout_date: new Date().toISOString().split("T")[0],
        notes: "",
      })
      setPayoutDialogOpen(true)
    },
    []
  )

  const handlePayout = useCallback(async () => {
    if (!payoutForm.rep_id || !payoutForm.amount || !payoutForm.payout_date) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      })
      return
    }

    setPayoutSaving(true)

    try {
      const res = await fetch("/api/commissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rep_id: payoutForm.rep_id,
          amount: Number(payoutForm.amount),
          payout_date: payoutForm.payout_date,
          notes: payoutForm.notes,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to process payout")
      }

      const result = await res.json()

      toast({
        title: "Payout Processed",
        description: `Successfully marked ${result.deals_updated} deals as paid.`,
        variant: "success",
      })

      setPayoutDialogOpen(false)

      // Refresh data
      await refreshData()
    } catch (err) {
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      })
    } finally {
      setPayoutSaving(false)
    }
  }, [payoutForm, toast])

  // ------------------------------------------------------------------
  // Rate handlers
  // ------------------------------------------------------------------

  const openAddRateDialog = useCallback(() => {
    setEditingRate(null)
    setRateForm({
      id: "",
      role: "setter",
      label: "",
      rate: "",
      pif_bonus_rate: "",
      min_close_rate: "",
      effective_date: new Date().toISOString().split("T")[0],
    })
    setRateDialogOpen(true)
  }, [])

  const openEditRateDialog = useCallback((rate: CommissionRate) => {
    setEditingRate(rate)
    setRateForm({
      id: rate.id,
      role: rate.role,
      label: rate.label,
      rate: String(rate.rate),
      pif_bonus_rate: String(rate.pif_bonus_rate),
      min_close_rate: rate.min_close_rate !== null ? String(rate.min_close_rate) : "",
      effective_date: rate.effective_date,
    })
    setRateDialogOpen(true)
  }, [])

  const handleSaveRate = useCallback(async () => {
    if (!rateForm.label || !rateForm.rate || !rateForm.pif_bonus_rate || !rateForm.effective_date) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      })
      return
    }

    setRateSaving(true)

    try {
      const payload = {
        ...(editingRate ? { id: editingRate.id } : {}),
        role: rateForm.role,
        label: rateForm.label,
        rate: Number(rateForm.rate),
        pif_bonus_rate: Number(rateForm.pif_bonus_rate),
        min_close_rate: rateForm.min_close_rate ? Number(rateForm.min_close_rate) : null,
        effective_date: rateForm.effective_date,
      }

      const res = await fetch("/api/commissions/rates", {
        method: editingRate ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to save rate tier")
      }

      toast({
        title: editingRate ? "Rate Updated" : "Rate Created",
        description: `Commission rate tier "${rateForm.label}" has been ${editingRate ? "updated" : "created"} successfully.`,
        variant: "success",
      })

      setRateDialogOpen(false)

      // Refresh rates
      const ratesRes = await fetch("/api/commissions/rates")
      if (ratesRes.ok) {
        const ratesJson = await ratesRes.json()
        setRates(ratesJson.data || [])
      }
    } catch (err) {
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      })
    } finally {
      setRateSaving(false)
    }
  }, [rateForm, editingRate, toast])

  // ------------------------------------------------------------------
  // Refresh data
  // ------------------------------------------------------------------

  const refreshData = useCallback(async () => {
    try {
      const res = await fetch("/api/commissions")
      if (res.ok) {
        const json = await res.json()
        setSummary(json.summary)
        setRepBreakdown(json.repBreakdown)
        setPayoutLog(json.payoutLog)
      }
    } catch {
      // Silently fail
    }
  }, [])

  // ------------------------------------------------------------------
  // Export CSV
  // ------------------------------------------------------------------

  const handleExportRepCsv = useCallback(() => {
    const rows = repBreakdown.map((r) => ({
      "Rep Name": r.rep_name,
      Role: r.role,
      "Total Deals": r.total_deals,
      "Commission Earned": r.total_commission_earned,
      "Total Paid": r.total_paid,
      "Total Outstanding": r.total_outstanding,
      "Total Clawbacks": r.total_clawbacks,
    }))
    exportToCsv(rows, `commission_breakdown_${new Date().toISOString().split("T")[0]}.csv`)
  }, [repBreakdown])

  // ------------------------------------------------------------------
  // Get the rep name for payout dialog title
  // ------------------------------------------------------------------

  const payoutRepName = useMemo(() => {
    const rep = repBreakdown.find((r) => r.rep_id === payoutForm.rep_id)
    return rep?.rep_name || "Unknown"
  }, [repBreakdown, payoutForm.rep_id])

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {summaryCards.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.title} className={cn("border", card.bgClass)}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <Icon className={cn("h-5 w-5", card.iconClass)} />
              </CardHeader>
              <CardContent>
                <div className={cn("text-2xl font-bold", card.colorClass)}>
                  {card.value}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="per-rep" className="space-y-4">
        <TabsList>
          <TabsTrigger value="per-rep">Per-Rep Breakdown</TabsTrigger>
          <TabsTrigger value="rates">Commission Rates</TabsTrigger>
          <TabsTrigger value="payout-log">Payout Log</TabsTrigger>
        </TabsList>

        {/* Per-Rep Breakdown Tab */}
        <TabsContent value="per-rep">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Per-Rep Commission Breakdown</CardTitle>
              <Button variant="outline" size="sm" onClick={handleExportRepCsv}>
                <Download className="mr-1 h-4 w-4" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rep Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Total Deals</TableHead>
                    <TableHead className="text-right">Commission Earned</TableHead>
                    <TableHead className="text-right">Total Paid</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {repBreakdown.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center text-muted-foreground py-8"
                      >
                        No commission data found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    repBreakdown.map((rep) => (
                      <TableRow key={rep.rep_id}>
                        <TableCell className="font-medium">
                          {rep.rep_name}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              rep.role === "closer" ? "success" : "warning"
                            }
                            className="capitalize"
                          >
                            {rep.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {rep.total_deals}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(rep.total_commission_earned)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(rep.total_paid)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={cn(
                              "font-medium",
                              rep.total_outstanding > 0
                                ? "text-amber-600"
                                : "text-green-600"
                            )}
                          >
                            {formatCurrency(rep.total_outstanding)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={rep.total_outstanding <= 0}
                            onClick={() => openPayoutDialog(rep)}
                          >
                            Mark as Paid
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Commission Rates Tab */}
        <TabsContent value="rates">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Commission Rate Tiers</CardTitle>
              <Button size="sm" onClick={openAddRateDialog}>
                <Plus className="mr-1 h-4 w-4" />
                Add Rate Tier
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Role</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">PIF Bonus Rate</TableHead>
                    <TableHead className="text-right">Min Close Rate</TableHead>
                    <TableHead>Effective Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rates.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center text-muted-foreground py-8"
                      >
                        No commission rate tiers found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rates.map((rate) => (
                      <TableRow key={rate.id}>
                        <TableCell>
                          <Badge
                            variant={
                              rate.role === "closer" ? "success" : "warning"
                            }
                            className="capitalize"
                          >
                            {rate.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {rate.label}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatPercent(rate.rate)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatPercent(rate.pif_bonus_rate)}
                        </TableCell>
                        <TableCell className="text-right">
                          {rate.min_close_rate !== null
                            ? formatPercent(rate.min_close_rate)
                            : "-"}
                        </TableCell>
                        <TableCell>{formatDate(rate.effective_date)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditRateDialog(rate)}
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payout Log Tab */}
        <TabsContent value="payout-log">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Payout Log</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Rep Name</TableHead>
                    <TableHead className="text-right">Amount Paid</TableHead>
                    <TableHead className="text-right">Deals</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Processed By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payoutLog.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center text-muted-foreground py-8"
                      >
                        No payout records found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    payoutLog.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(entry.date)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {entry.rep_name}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(entry.amount_paid)}
                        </TableCell>
                        <TableCell className="text-right">
                          {entry.num_deals}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {entry.notes || "-"}
                        </TableCell>
                        <TableCell>{entry.admin_name}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Payout Dialog */}
      <Dialog open={payoutDialogOpen} onOpenChange={setPayoutDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Process Payout</DialogTitle>
            <DialogDescription>
              Mark all unpaid deals for {payoutRepName} as paid.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="payout_amount">Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  id="payout_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  className="pl-7"
                  value={payoutForm.amount}
                  onChange={(e) =>
                    setPayoutForm((prev) => ({
                      ...prev,
                      amount: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payout_date">Payout Date</Label>
              <Input
                id="payout_date"
                type="date"
                value={payoutForm.payout_date}
                onChange={(e) =>
                  setPayoutForm((prev) => ({
                    ...prev,
                    payout_date: e.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payout_notes">Notes</Label>
              <Textarea
                id="payout_notes"
                placeholder="Optional notes about this payout..."
                value={payoutForm.notes}
                onChange={(e) =>
                  setPayoutForm((prev) => ({
                    ...prev,
                    notes: e.target.value,
                  }))
                }
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPayoutDialogOpen(false)}
              disabled={payoutSaving}
            >
              Cancel
            </Button>
            <Button onClick={handlePayout} disabled={payoutSaving}>
              {payoutSaving && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Confirm Payout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rate Dialog */}
      <Dialog open={rateDialogOpen} onOpenChange={setRateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingRate ? "Edit Rate Tier" : "Add Rate Tier"}
            </DialogTitle>
            <DialogDescription>
              {editingRate
                ? "Update the commission rate tier details."
                : "Create a new commission rate tier."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rate_role">Role</Label>
                <Select
                  value={rateForm.role}
                  onValueChange={(v) =>
                    setRateForm((prev) => ({
                      ...prev,
                      role: v as UserRole,
                    }))
                  }
                >
                  <SelectTrigger id="rate_role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="setter">Setter</SelectItem>
                    <SelectItem value="closer">Closer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rate_label">
                  Label <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="rate_label"
                  placeholder='e.g., "Base"'
                  value={rateForm.label}
                  onChange={(e) =>
                    setRateForm((prev) => ({
                      ...prev,
                      label: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rate_rate">
                  Rate (decimal) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="rate_rate"
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  placeholder="0.10"
                  value={rateForm.rate}
                  onChange={(e) =>
                    setRateForm((prev) => ({
                      ...prev,
                      rate: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rate_pif_bonus">
                  PIF Bonus Rate <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="rate_pif_bonus"
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  placeholder="0.05"
                  value={rateForm.pif_bonus_rate}
                  onChange={(e) =>
                    setRateForm((prev) => ({
                      ...prev,
                      pif_bonus_rate: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rate_min_close">Min Close Rate (decimal)</Label>
                <Input
                  id="rate_min_close"
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  placeholder="0.30 (optional)"
                  value={rateForm.min_close_rate}
                  onChange={(e) =>
                    setRateForm((prev) => ({
                      ...prev,
                      min_close_rate: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rate_effective_date">
                  Effective Date <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="rate_effective_date"
                  type="date"
                  value={rateForm.effective_date}
                  onChange={(e) =>
                    setRateForm((prev) => ({
                      ...prev,
                      effective_date: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRateDialogOpen(false)}
              disabled={rateSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveRate} disabled={rateSaving}>
              {rateSaving && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {editingRate ? "Update Rate" : "Create Rate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
