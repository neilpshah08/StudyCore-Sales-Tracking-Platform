"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn, formatCurrency, formatPercent } from "@/lib/utils"

export interface LeaderboardEntry {
  user_id: string
  full_name: string
  role: string
  total_bookings: number
  total_cash_collected: number
  contact_rate: number
  close_rate: number
}

interface LeaderboardProps {
  role: "setter" | "closer"
  currentUserId: string
  data: LeaderboardEntry[]
  anonymous: boolean
}

function getRankDisplay(rank: number): string {
  if (rank === 1) return "\u{1F947}"
  if (rank === 2) return "\u{1F948}"
  if (rank === 3) return "\u{1F949}"
  return rank.toString()
}

export function Leaderboard({
  role,
  currentUserId,
  data,
  anonymous,
}: LeaderboardProps) {
  // Sort by primary KPI descending
  const sorted = [...data].sort((a, b) => {
    if (role === "setter") {
      return b.total_bookings - a.total_bookings
    }
    return b.total_cash_collected - a.total_cash_collected
  })

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">
          Team Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="text-sm text-white/55 text-center py-4">
            No leaderboard data available yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Rank</TableHead>
                <TableHead>Rep</TableHead>
                <TableHead className="text-right">
                  {role === "setter" ? "Bookings" : "Cash Collected"}
                </TableHead>
                <TableHead className="text-right">
                  {role === "setter" ? "Contact Rate" : "Close Rate"}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((entry, index) => {
                const isCurrentUser = entry.user_id === currentUserId
                const rank = index + 1

                return (
                  <TableRow
                    key={entry.user_id}
                    className={cn(
                      isCurrentUser && "bg-[#3B82F6]/10 font-medium shadow-[inset_0_0_0_1px_rgba(59,130,246,0.25)]"
                    )}
                  >
                    <TableCell className="text-center">
                      <span className={cn(rank <= 3 ? "text-lg" : "metric-number text-white/70")}>
                        {getRankDisplay(rank)}
                      </span>
                    </TableCell>
                    <TableCell className="text-white/90">
                      {anonymous && !isCurrentUser
                        ? `Rep ${rank}`
                        : entry.full_name}
                      {isCurrentUser && (
                        <span className="ml-2 text-xs text-[#60A5FA]">(You)</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right metric-number font-semibold text-white">
                      {role === "setter"
                        ? entry.total_bookings
                        : formatCurrency(entry.total_cash_collected)}
                    </TableCell>
                    <TableCell className="text-right metric-number text-white/70">
                      {role === "setter"
                        ? formatPercent(entry.contact_rate)
                        : formatPercent(entry.close_rate)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
