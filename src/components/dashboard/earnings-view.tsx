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

export function EarningsView({ summary, deals }: EarningsViewProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Earnings</h1>
        <p className="text-muted-foreground">
          Track your commissions, bonuses, and payouts.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Earned All-Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(summary.totalAllTime)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Earned This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(summary.totalThisMonth)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Payout
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-600">
              {formatCurrency(summary.totalPending)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Paid Out
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(summary.totalPaid)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Deals Table */}
      <Card>
        <CardHeader>
          <CardTitle>Commission History</CardTitle>
        </CardHeader>
        <CardContent>
          {deals.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
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
                    <TableCell className="whitespace-nowrap">
                      {formatDate(deal.date)}
                    </TableCell>
                    <TableCell>{deal.studentName}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(deal.dealValue)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(deal.myCommission)}
                    </TableCell>
                    <TableCell className="text-right">
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
                            <span className="text-xs font-medium text-red-600">
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
