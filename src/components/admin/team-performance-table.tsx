"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { ArrowUp, ArrowDown, ArrowRight, ChevronsUpDown } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn, formatCurrency, formatPercent } from "@/lib/utils"

export interface RepPerformance {
  id: string
  name: string
  role: "setter" | "closer"
  status: "active" | "inactive" | "terminated"
  weekKPI: number
  monthKPI: number
  closeOrBookRate: number
  trend: "up" | "down" | "flat"
}

interface TeamPerformanceTableProps {
  reps: RepPerformance[]
}

type SortKey = "name" | "role" | "status" | "weekKPI" | "monthKPI" | "closeOrBookRate"
type SortDir = "asc" | "desc"

const roleBadgeClass: Record<string, string> = {
  setter: "bg-blue-100 text-blue-800 border-blue-200",
  closer: "bg-purple-100 text-purple-800 border-purple-200",
}

const statusBadgeClass: Record<string, string> = {
  active: "bg-green-100 text-green-800 border-green-200",
  inactive: "bg-gray-100 text-gray-600 border-gray-200",
  terminated: "bg-red-100 text-red-800 border-red-200",
}

function TrendIcon({ trend }: { trend: "up" | "down" | "flat" }) {
  if (trend === "up") return <ArrowUp className="h-4 w-4 text-green-600" />
  if (trend === "down") return <ArrowDown className="h-4 w-4 text-red-600" />
  return <ArrowRight className="h-4 w-4 text-gray-400" />
}

export function TeamPerformanceTable({ reps }: TeamPerformanceTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("name")
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  const filteredAndSorted = useMemo(() => {
    let result = [...reps]

    if (roleFilter !== "all") {
      result = result.filter((r) => r.role === roleFilter)
    }
    if (statusFilter !== "all") {
      result = result.filter((r) => r.status === statusFilter)
    }

    result.sort((a, b) => {
      let cmp = 0
      const aVal = a[sortKey]
      const bVal = b[sortKey]
      if (typeof aVal === "string" && typeof bVal === "string") {
        cmp = aVal.localeCompare(bVal)
      } else if (typeof aVal === "number" && typeof bVal === "number") {
        cmp = aVal - bVal
      }
      return sortDir === "asc" ? cmp : -cmp
    })

    return result
  }, [reps, roleFilter, statusFilter, sortKey, sortDir])

  const SortableHead = ({
    label,
    sortKeyName,
  }: {
    label: string
    sortKeyName: SortKey
  }) => (
    <TableHead
      className="cursor-pointer select-none"
      onClick={() => handleSort(sortKeyName)}
    >
      <span className="flex items-center gap-1">
        {label}
        <ChevronsUpDown className="h-3 w-3 text-muted-foreground" />
      </span>
    </TableHead>
  )

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Team Performance</CardTitle>
          <div className="flex gap-2">
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="setter">Setter</SelectItem>
                <SelectItem value="closer">Closer</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="terminated">Terminated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead label="Name" sortKeyName="name" />
              <SortableHead label="Role" sortKeyName="role" />
              <SortableHead label="Status" sortKeyName="status" />
              <SortableHead label="This Week" sortKeyName="weekKPI" />
              <SortableHead label="This Month" sortKeyName="monthKPI" />
              <SortableHead label="Rate" sortKeyName="closeOrBookRate" />
              <TableHead>Trend</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No reps found.
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSorted.map((rep) => (
                <TableRow key={rep.id}>
                  <TableCell>
                    <Link
                      href={`/admin/reps/${rep.id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {rep.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn("capitalize", roleBadgeClass[rep.role])}
                    >
                      {rep.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn("capitalize", statusBadgeClass[rep.status])}
                    >
                      {rep.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {rep.role === "closer"
                      ? formatCurrency(rep.weekKPI)
                      : rep.weekKPI}
                  </TableCell>
                  <TableCell>
                    {rep.role === "closer"
                      ? formatCurrency(rep.monthKPI)
                      : rep.monthKPI}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "font-medium",
                        rep.role === "closer"
                          ? rep.closeOrBookRate >= 0.3
                            ? "text-green-600"
                            : "text-red-600"
                          : rep.closeOrBookRate >= 0.4
                          ? "text-green-600"
                          : "text-red-600"
                      )}
                    >
                      {formatPercent(rep.closeOrBookRate)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <TrendIcon trend={rep.trend} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
