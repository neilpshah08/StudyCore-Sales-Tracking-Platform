"use client"

import { cn, formatCurrency, formatPercent, formatDate, exportToCsv } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from "recharts"
import { FileDown, TrendingDown, AlertTriangle, DollarSign } from "lucide-react"

interface Props {
  summary: { totalLost: number; totalLostRevenue: number; mostCommonReason: string; lostRate: number }
  reasonDistribution: { name: string; value: number; percentage: number }[]
  closerData: Record<string, unknown>[]
  weeklyTrend: { week: string; count: number }[]
  deals: { id: string; date_closed: string; student_name: string; deal_value: number; lost_reason: string; notes: string | null; closer_name: string; status: string }[]
  allReasons: string[]
}

const COLORS = ["#3B82F6", "#EF4444", "#F59E0B", "#10B981", "#8B5CF6", "#EC4899", "#06B6D4", "#F97316"]

export function LostDealsAnalysis({ summary, reasonDistribution, closerData, weeklyTrend, deals, allReasons }: Props) {
  function handleExport() {
    exportToCsv(
      deals.map((d) => ({
        Date: d.date_closed,
        Student: d.student_name,
        Closer: d.closer_name,
        "Deal Value": d.deal_value,
        Reason: d.lost_reason,
        Notes: d.notes || "",
      })),
      `lost_deals_${new Date().toISOString().split("T")[0]}.csv`
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="h-4 w-4 text-red-500" />
              <p className="text-sm text-muted-foreground">Deals Lost (90d)</p>
            </div>
            <p className="text-2xl font-bold text-red-600">{summary.totalLost}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-red-500" />
              <p className="text-sm text-muted-foreground">Lost Revenue</p>
            </div>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(summary.totalLostRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground mb-1">Most Common Reason</p>
            <p className="text-lg font-bold">{summary.mostCommonReason}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              {summary.lostRate > 0.1 && <AlertTriangle className="h-4 w-4 text-red-500" />}
              <p className="text-sm text-muted-foreground">Lost Rate</p>
            </div>
            <p className={cn("text-2xl font-bold", summary.lostRate > 0.1 ? "text-red-600" : "text-gray-900")}>
              {formatPercent(summary.lostRate)}
            </p>
            {summary.lostRate > 0.1 && <Badge variant="destructive" className="mt-1">Above 10% threshold</Badge>}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <Card>
          <CardHeader><CardTitle>Lost Reasons Distribution</CardTitle></CardHeader>
          <CardContent>
            {reasonDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={reasonDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, payload }) => `${name} (${payload?.percentage ?? 0}%)`}>
                    {reasonDistribution.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">No lost deals data</p>
            )}
          </CardContent>
        </Card>

        {/* Bar Chart by Closer */}
        <Card>
          <CardHeader><CardTitle>Lost Reasons by Closer</CardTitle></CardHeader>
          <CardContent>
            {closerData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={closerData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Legend />
                  {allReasons.map((reason, i) => (
                    <Bar key={reason} dataKey={reason} stackId="a" fill={COLORS[i % COLORS.length]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">No data</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Weekly Trend */}
      <Card>
        <CardHeader><CardTitle>Lost Deals Weekly Trend (12 weeks)</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={weeklyTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#DC2626" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Lost Deals</CardTitle>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <FileDown className="h-4 w-4 mr-1" /> Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Closer</TableHead>
                <TableHead>Deal Value</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deals.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>{formatDate(d.date_closed)}</TableCell>
                  <TableCell>{d.student_name}</TableCell>
                  <TableCell>{d.closer_name}</TableCell>
                  <TableCell className="text-red-600">{formatCurrency(d.deal_value)}</TableCell>
                  <TableCell><Badge variant="outline">{d.lost_reason}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{d.notes || "—"}</TableCell>
                </TableRow>
              ))}
              {deals.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No lost deals</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
