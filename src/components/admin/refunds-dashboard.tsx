"use client"

import { useState, useMemo, useCallback } from "react"
import {
  RotateCcw,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Download,
  Plus,
  Loader2,
  X,
} from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"
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
import { useToast } from "@/components/ui/use-toast"
import {
  cn,
  formatCurrency,
  formatDate,
  formatPercent,
  calculateClawback,
  exportToCsv,
} from "@/lib/utils"
import { REFUND_REASONS } from "@/lib/constants"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RefundSummary {
  total_refunds_this_month: number
  total_refund_amount: number
  refund_rate: number
  total_clawbacks: number
}

export interface RefundWithDetails {
  id: string
  deal_id: string
  refund_date: string
  refund_amount: number
  reason: string
  setter_clawback: number
  closer_clawback: number
  processed_by: string | null
  notes: string | null
  created_at: string
  student_name: string
  deal_value: number
  date_closed: string
  setter_name: string | null
  closer_name: string | null
}

export interface RefundTrend {
  month: string
  refundRate: number
  refundCount: number
}

export interface DealForRefund {
  id: string
  student_name: string
  date_closed: string
  deal_value: number
  setter_commission: number | null
  closer_commission: number | null
}

interface RefundsDashboardProps {
  summary: RefundSummary
  refunds: RefundWithDetails[]
  trendData: RefundTrend[]
  deals: DealForRefund[]
}

interface RefundFormData {
  deal_id: string
  refund_amount: string
  reason: string
  notes: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RefundsDashboard({
  summary: initialSummary,
  refunds: initialRefunds,
  trendData,
  deals: initialDeals,
}: RefundsDashboardProps) {
  const { toast } = useToast()

  // Data state
  const [summary, setSummary] = useState(initialSummary)
  const [refunds, setRefunds] = useState(initialRefunds)
  const [deals, setDeals] = useState(initialDeals)

  // Dialog state
  const [refundDialogOpen, setRefundDialogOpen] = useState(false)
  const [refundForm, setRefundForm] = useState<RefundFormData>({
    deal_id: "",
    refund_amount: "",
    reason: "",
    notes: "",
  })
  const [refundSaving, setRefundSaving] = useState(false)

  // Filter state
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [reasonFilter, setReasonFilter] = useState("all")
  const [closerFilter, setCloserFilter] = useState("all")

  // ------------------------------------------------------------------
  // Summary Cards
  // ------------------------------------------------------------------

  const summaryCards = [
    {
      title: "Refunds This Month",
      value: String(summary.total_refunds_this_month),
      icon: RotateCcw,
      colorClass: "text-white",
      bgClass: "bg-white",
      iconClass: "text-white/55",
    },
    {
      title: "Total Refund Amount",
      value: formatCurrency(summary.total_refund_amount),
      icon: DollarSign,
      colorClass: "text-[#EF4444]",
      bgClass: "bg-white",
      iconClass: "text-white/55",
    },
    {
      title: "Refund Rate (30-day)",
      value: formatPercent(summary.refund_rate),
      icon: TrendingUp,
      colorClass: summary.refund_rate > 0.1 ? "text-[#EF4444]" : "text-[#10B981]",
      bgClass: "bg-white",
      iconClass: "text-white/55",
      alert: summary.refund_rate > 0.1,
    },
    {
      title: "Total Clawbacks",
      value: formatCurrency(summary.total_clawbacks),
      icon: AlertTriangle,
      colorClass: "text-[#EF4444]",
      bgClass: "bg-white",
      iconClass: "text-white/55",
    },
  ]

  // ------------------------------------------------------------------
  // Clawback preview for selected deal
  // ------------------------------------------------------------------

  const selectedDeal = useMemo(
    () => deals.find((d) => d.id === refundForm.deal_id),
    [deals, refundForm.deal_id]
  )

  const clawbackPreview = useMemo(() => {
    if (!selectedDeal) return null

    const now = new Date()
    const dateClosed = new Date(selectedDeal.date_closed)
    const daysSinceClose = Math.floor(
      (now.getTime() - dateClosed.getTime()) / (1000 * 60 * 60 * 24)
    )

    const setterCommission = selectedDeal.setter_commission ?? 0
    const closerCommission = selectedDeal.closer_commission ?? 0

    const setterClawback = calculateClawback(setterCommission, daysSinceClose)
    const closerClawback = calculateClawback(closerCommission, daysSinceClose)

    let policy: string
    if (daysSinceClose <= 14) {
      policy = "Full clawback (within 14 days)"
    } else if (daysSinceClose <= 90) {
      const remaining = ((90 - daysSinceClose) / 90) * 100
      policy = `Prorated clawback: ${remaining.toFixed(1)}%`
    } else {
      policy = "No clawback (90+ days)"
    }

    return {
      daysSinceClose,
      policy,
      setterClawback,
      closerClawback,
      totalClawback: Math.round((setterClawback + closerClawback) * 100) / 100,
    }
  }, [selectedDeal])

  // ------------------------------------------------------------------
  // Filtered refunds
  // ------------------------------------------------------------------

  const uniqueClosers = useMemo(() => {
    const closerSet = new Map<string, string>()
    refunds.forEach((r) => {
      if (r.closer_name) {
        closerSet.set(r.closer_name, r.closer_name)
      }
    })
    return Array.from(closerSet.values()).sort()
  }, [refunds])

  const filteredRefunds = useMemo(() => {
    let result = [...refunds]

    if (startDate) {
      result = result.filter((r) => r.refund_date >= startDate)
    }
    if (endDate) {
      result = result.filter((r) => r.refund_date <= endDate)
    }
    if (reasonFilter !== "all") {
      result = result.filter((r) => r.reason === reasonFilter)
    }
    if (closerFilter !== "all") {
      result = result.filter((r) => r.closer_name === closerFilter)
    }

    return result
  }, [refunds, startDate, endDate, reasonFilter, closerFilter])

  const hasFilters =
    startDate || endDate || reasonFilter !== "all" || closerFilter !== "all"

  // ------------------------------------------------------------------
  // Handlers
  // ------------------------------------------------------------------

  const clearFilters = useCallback(() => {
    setStartDate("")
    setEndDate("")
    setReasonFilter("all")
    setCloserFilter("all")
  }, [])

  const openRefundDialog = useCallback(() => {
    setRefundForm({
      deal_id: "",
      refund_amount: "",
      reason: "",
      notes: "",
    })
    setRefundDialogOpen(true)
  }, [])

  const handleDealSelect = useCallback(
    (dealId: string) => {
      const deal = deals.find((d) => d.id === dealId)
      setRefundForm((prev) => ({
        ...prev,
        deal_id: dealId,
        refund_amount: deal ? String(deal.deal_value) : "",
      }))
    },
    [deals]
  )

  const handleProcessRefund = useCallback(async () => {
    if (!refundForm.deal_id || !refundForm.refund_amount || !refundForm.reason) {
      toast({
        title: "Validation Error",
        description: "Please select a deal, enter refund amount, and choose a reason.",
        variant: "destructive",
      })
      return
    }

    setRefundSaving(true)

    try {
      const res = await fetch("/api/refunds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deal_id: refundForm.deal_id,
          refund_amount: Number(refundForm.refund_amount),
          reason: refundForm.reason,
          notes: refundForm.notes || null,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to process refund")
      }

      toast({
        title: "Refund Processed",
        description: `Refund of ${formatCurrency(Number(refundForm.refund_amount))} has been processed successfully.`,
        variant: "success",
      })

      setRefundDialogOpen(false)

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
      setRefundSaving(false)
    }
  }, [refundForm, toast])

  const refreshData = useCallback(async () => {
    try {
      const res = await fetch("/api/refunds")
      if (res.ok) {
        const json = await res.json()
        setSummary(json.summary)
        setRefunds(json.refunds)
        setDeals(json.deals)
      }
    } catch {
      // Silently fail
    }
  }, [])

  const handleExportCsv = useCallback(() => {
    const rows = filteredRefunds.map((r) => ({
      Date: formatDate(r.refund_date),
      "Student Name": r.student_name,
      "Original Deal Value": r.deal_value,
      "Refund Amount": r.refund_amount,
      Reason: r.reason,
      "Closer Name": r.closer_name ?? "",
      "Setter Clawback": r.setter_clawback,
      "Closer Clawback": r.closer_clawback,
      Notes: r.notes ?? "",
    }))
    exportToCsv(
      rows,
      `refunds_${new Date().toISOString().split("T")[0]}.csv`
    )
  }, [filteredRefunds])

  // ------------------------------------------------------------------
  // Chart data transform
  // ------------------------------------------------------------------

  const chartData = useMemo(
    () =>
      trendData.map((d) => ({
        month: d.month,
        refundRate: Math.round(d.refundRate * 100 * 100) / 100,
      })),
    [trendData]
  )

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.title} className={card.bgClass}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-white/55">
                  {card.title}
                </CardTitle>
                <div className="flex items-center gap-1">
                  {"alert" in card && card.alert && (
                    <Badge variant="destructive" className="text-[10px]">
                      HIGH
                    </Badge>
                  )}
                  <Icon className={cn("h-4 w-4", card.iconClass)} />
                </div>
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

      {/* Process Refund Button */}
      <div className="flex justify-end">
        <Button onClick={openRefundDialog}>
          <Plus className="mr-1 h-4 w-4" />
          Process Refund
        </Button>
      </div>

      {/* Refund Rate Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Refund Rate Trend (6 Months)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(v: number) => `${v}%`}
                domain={[0, "auto"]}
              />
              <Tooltip
                formatter={(value) => [`${Number(value)}%`, "Refund Rate"]}
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid #e5e7eb",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                }}
              />
              <ReferenceLine
                y={10}
                stroke="#DC2626"
                strokeDasharray="5 5"
                label={{
                  value: "10% Threshold",
                  position: "insideTopRight",
                  fill: "#DC2626",
                  fontSize: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="refundRate"
                name="Refund Rate"
                stroke="#8B5CF6"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Filter Bar + Refunds Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Refunds</CardTitle>
          <Button variant="outline" size="sm" onClick={handleExportCsv}>
            <Download className="mr-1 h-4 w-4" />
            Export CSV
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-end gap-3">
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
            <div className="space-y-1">
              <Label className="text-xs text-white/55">Reason</Label>
              <Select value={reasonFilter} onValueChange={setReasonFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Reasons" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Reasons</SelectItem>
                  {REFUND_REASONS.map((reason) => (
                    <SelectItem key={reason} value={reason}>
                      {reason}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-white/55">Closer</Label>
              <Select value={closerFilter} onValueChange={setCloserFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="All Closers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Closers</SelectItem>
                  {uniqueClosers.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="mr-1 h-4 w-4" />
                Clear Filters
              </Button>
            )}
          </div>

          {/* Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Student Name</TableHead>
                <TableHead className="text-right">Deal Value</TableHead>
                <TableHead className="text-right">Refund Amount</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Closer</TableHead>
                <TableHead className="text-right">Setter Clawback</TableHead>
                <TableHead className="text-right">Closer Clawback</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRefunds.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-white/55 py-8"
                  >
                    No refunds found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRefunds.map((refund) => (
                  <TableRow key={refund.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(refund.refund_date)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {refund.student_name}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(refund.deal_value)}
                    </TableCell>
                    <TableCell className="text-right text-[#EF4444] font-medium">
                      {formatCurrency(refund.refund_amount)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {refund.reason}
                      </Badge>
                    </TableCell>
                    <TableCell>{refund.closer_name ?? "-"}</TableCell>
                    <TableCell className="text-right text-[#EF4444]">
                      {formatCurrency(refund.setter_clawback)}
                    </TableCell>
                    <TableCell className="text-right text-[#EF4444]">
                      {formatCurrency(refund.closer_clawback)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {filteredRefunds.length > 0 && (
            <div className="text-xs text-white/55">
              Showing {filteredRefunds.length} of {refunds.length} refunds
            </div>
          )}
        </CardContent>
      </Card>

      {/* Process Refund Dialog */}
      <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Process Refund</DialogTitle>
            <DialogDescription>
              Select a deal to process a refund. Clawbacks will be calculated
              automatically based on the time since close.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Select Deal */}
            <div className="space-y-2">
              <Label htmlFor="refund_deal">
                Select Deal <span className="text-[#EF4444]">*</span>
              </Label>
              <Select
                value={refundForm.deal_id || "none"}
                onValueChange={(v) =>
                  handleDealSelect(v === "none" ? "" : v)
                }
              >
                <SelectTrigger id="refund_deal">
                  <SelectValue placeholder="Choose a deal..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Choose a deal...</SelectItem>
                  {deals.map((deal) => (
                    <SelectItem key={deal.id} value={deal.id}>
                      {deal.student_name} - {formatDate(deal.date_closed)} (
                      {formatCurrency(deal.deal_value)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Refund Amount */}
            <div className="space-y-2">
              <Label htmlFor="refund_amount">
                Refund Amount <span className="text-[#EF4444]">*</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-white/55">
                  $
                </span>
                <Input
                  id="refund_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  className="pl-7"
                  value={refundForm.refund_amount}
                  onChange={(e) =>
                    setRefundForm((prev) => ({
                      ...prev,
                      refund_amount: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label htmlFor="refund_reason">
                Reason <span className="text-[#EF4444]">*</span>
              </Label>
              <Select
                value={refundForm.reason || "none"}
                onValueChange={(v) =>
                  setRefundForm((prev) => ({
                    ...prev,
                    reason: v === "none" ? "" : v,
                  }))
                }
              >
                <SelectTrigger id="refund_reason">
                  <SelectValue placeholder="Select reason..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select reason...</SelectItem>
                  {REFUND_REASONS.map((reason) => (
                    <SelectItem key={reason} value={reason}>
                      {reason}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="refund_notes">Notes</Label>
              <Textarea
                id="refund_notes"
                placeholder="Any additional notes about this refund..."
                value={refundForm.notes}
                onChange={(e) =>
                  setRefundForm((prev) => ({
                    ...prev,
                    notes: e.target.value,
                  }))
                }
                rows={3}
              />
            </div>

            {/* Clawback Preview */}
            {clawbackPreview && (
              <div className="rounded-md border bg-muted/50 p-4 space-y-3">
                <p className="text-sm font-medium">Clawback Preview</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-white/55">
                      Days Since Close
                    </span>
                    <p className="font-medium">
                      {clawbackPreview.daysSinceClose} days
                    </p>
                  </div>
                  <div>
                    <span className="text-white/55">Policy</span>
                    <p className="font-medium">{clawbackPreview.policy}</p>
                  </div>
                  <div>
                    <span className="text-white/55">
                      Setter Clawback
                    </span>
                    <p className="font-medium text-[#EF4444]">
                      {formatCurrency(clawbackPreview.setterClawback)}
                    </p>
                  </div>
                  <div>
                    <span className="text-white/55">
                      Closer Clawback
                    </span>
                    <p className="font-medium text-[#EF4444]">
                      {formatCurrency(clawbackPreview.closerClawback)}
                    </p>
                  </div>
                </div>
                <div className="border-t pt-2">
                  <span className="text-sm text-white/55">
                    Total Clawback
                  </span>
                  <p className="text-lg font-bold text-[#EF4444]">
                    {formatCurrency(clawbackPreview.totalClawback)}
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRefundDialogOpen(false)}
              disabled={refundSaving}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleProcessRefund}
              disabled={refundSaving}
            >
              {refundSaving && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Process Refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
