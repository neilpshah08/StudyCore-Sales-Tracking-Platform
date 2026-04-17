"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatCurrency, formatDate } from "@/lib/utils"

type EarningsSummary = {
  totalAllTime: number
  totalThisMonth: number
  totalPending: number
  totalPaid: number
}

type EarningsDeal = {
  id: string
  date: string
  studentName: string
  dealValue: number
  myCommission: number
  pifBonus: number
  payoutStatus: "Pending" | "Paid" | "Clawback"
  clawbackAmount?: number
}

interface EarningsViewProps {
  userId: string
  role: "setter" | "closer"
  summary: EarningsSummary
  deals: EarningsDeal[]
}

function MetricCard({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: "success" | "warning" | "danger"
}) {
  const accentClass =
    accent === "success"
      ? "text-[#10B981]"
      : accent === "warning"
        ? "text-[#F59E0B]"
        : accent === "danger"
          ? "text-[#EF4444]"
          : "text-white"
  const glow =
    accent === "success"
      ? "shadow-[0_0_24px_rgba(16,185,129,0.12)]"
      : accent === "warning"
        ? "shadow-[0_0_24px_rgba(245,158,11,0.12)]"
        : ""
  return (
    <div className={`glass-card p-5 ${glow}`}>
      <p className="text-[11px] uppercase tracking-wider font-semibold text-white/55">
        {label}
      </p>
      <p className={`metric-number text-2xl font-bold mt-1.5 ${accentClass}`}>
        {value}
      </p>
    </div>
  )
}

export function EarningsView({ summary, deals }: EarningsViewProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-white tracking-tight">My Earnings</h1>
        <p className="text-white/55">
          Track your commissions, bonuses, and payouts.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Total Earned All-Time" value={formatCurrency(summary.totalAllTime)} accent="success" />
        <MetricCard label="Earned This Month" value={formatCurrency(summary.totalThisMonth)} />
        <MetricCard label="Pending Payout" value={formatCurrency(summary.totalPending)} accent="warning" />
        <MetricCard label="Total Paid Out" value={formatCurrency(summary.totalPaid)} />
      </div>

      {/* Deals Table */}
      <Card>
        <CardHeader>
          <CardTitle>Commission History</CardTitle>
        </CardHeader>
        <CardContent>
          {deals.length === 0 ? (
            <p className="py-8 text-center text-white/55">
              No deals found. Your commissions will appear here once deals are
              closed.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Student Name</TableHead>
                  <TableHead className="text-right">Deal Value</TableHead>
                  <TableHead className="text-right">My Commission</TableHead>
                  <TableHead className="text-right">PIF Bonus</TableHead>
                  <TableHead>Payout Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deals.map((deal) => (
                  <TableRow key={deal.id}>
                    <TableCell className="whitespace-nowrap text-white/70">
                      {formatDate(deal.date)}
                    </TableCell>
                    <TableCell className="text-white/90">{deal.studentName}</TableCell>
                    <TableCell className="text-right metric-number text-white/80">
                      {formatCurrency(deal.dealValue)}
                    </TableCell>
                    <TableCell className="text-right metric-number font-semibold text-white">
                      {formatCurrency(deal.myCommission)}
                    </TableCell>
                    <TableCell className="text-right metric-number text-white/80">
                      {formatCurrency(deal.pifBonus)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge
                          variant={
                            deal.payoutStatus === "Paid"
                              ? "success"
                              : deal.payoutStatus === "Clawback"
                                ? "destructive"
                                : "warning"
                          }
                        >
                          {deal.payoutStatus}
                        </Badge>
                        {deal.payoutStatus === "Clawback" &&
                          deal.clawbackAmount !== undefined &&
                          deal.clawbackAmount > 0 && (
                            <span className="text-xs font-medium text-[#FCA5A5] metric-number">
                              -{formatCurrency(deal.clawbackAmount)}
                            </span>
                          )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
