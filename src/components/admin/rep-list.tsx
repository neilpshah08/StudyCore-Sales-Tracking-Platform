"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { ChevronsUpDown, AlertTriangle, UserPlus } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn, formatCurrency, formatPercent, formatDate } from "@/lib/utils"
import type { User } from "@/types/database"

export interface RepWithBadges extends User {
  hasPipWarning: boolean
  currentWeekKpi: number
}

interface RepListProps {
  reps: RepWithBadges[]
}

type SortKey =
  | "full_name"
  | "role"
  | "status"
  | "hire_date"
  | "currentWeekKpi"
  | "commission_rate"
type SortDir = "asc" | "desc"

const roleBadgeClass: Record<string, string> = {
  setter: "bg-blue-100 text-[#93C5FD] border-blue-200",
  closer: "bg-purple-100 text-purple-800 border-purple-200",
}

const statusBadgeClass: Record<string, string> = {
  active: "bg-green-100 text-[#6EE7B7] border-green-200",
  inactive: "bg-white/8 text-white/70 border-white/10",
  terminated: "bg-red-100 text-[#FCA5A5] border-red-200",
}

export function RepList({ reps }: RepListProps) {
  const [sortKey, setSortKey] = useState<SortKey>("full_name")
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
      switch (sortKey) {
        case "full_name":
          cmp = a.full_name.localeCompare(b.full_name)
          break
        case "role":
          cmp = a.role.localeCompare(b.role)
          break
        case "status":
          cmp = a.status.localeCompare(b.status)
          break
        case "hire_date":
          cmp =
            new Date(a.hire_date ?? "1970-01-01").getTime() -
            new Date(b.hire_date ?? "1970-01-01").getTime()
          break
        case "currentWeekKpi":
          cmp = a.currentWeekKpi - b.currentWeekKpi
          break
        case "commission_rate":
          cmp = (a.commission_rate ?? 0) - (b.commission_rate ?? 0)
          break
      }
      return sortDir === "asc" ? cmp : -cmp
    })

    return result
  }, [reps, roleFilter, statusFilter, sortKey, sortDir])

  const SortableHead = ({
    label,
    sortKeyName,
    className,
  }: {
    label: string
    sortKeyName: SortKey
    className?: string
  }) => (
    <TableHead
      className={cn("cursor-pointer select-none", className)}
      onClick={() => handleSort(sortKeyName)}
    >
      <span className="flex items-center gap-1">
        {label}
        <ChevronsUpDown className="h-3 w-3 text-white/55" />
      </span>
    </TableHead>
  )

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>
            All Reps ({filteredAndSorted.length})
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
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
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="terminated">Terminated</SelectItem>
              </SelectContent>
            </Select>
            <Link href="/register">
              <Button size="sm">
                <UserPlus className="mr-2 h-4 w-4" />
                Add New Rep
              </Button>
            </Link>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead label="Name" sortKeyName="full_name" />
              <SortableHead label="Role" sortKeyName="role" />
              <SortableHead label="Status" sortKeyName="status" />
              <SortableHead label="Hire Date" sortKeyName="hire_date" />
              <SortableHead label="Week KPI" sortKeyName="currentWeekKpi" />
              <SortableHead
                label="Commission Rate"
                sortKeyName="commission_rate"
              />
              <TableHead>Alerts</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSorted.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center text-white/55"
                >
                  No reps found matching the current filters.
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSorted.map((rep) => (
                <TableRow key={rep.id}>
                  <TableCell>
                    <Link
                      href={`/admin/reps/${rep.id}`}
                      className="font-medium text-[#60A5FA] hover:underline"
                    >
                      {rep.full_name}
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
                      className={cn(
                        "capitalize",
                        statusBadgeClass[rep.status]
                      )}
                    >
                      {rep.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-white/55">
                    {rep.hire_date ? formatDate(rep.hire_date) : "-"}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">
                      {rep.role === "closer"
                        ? formatCurrency(rep.currentWeekKpi)
                        : rep.currentWeekKpi}
                    </span>
                    <span className="ml-1 text-xs text-white/55">
                      {rep.role === "setter" ? "bookings" : "cash"}
                    </span>
                  </TableCell>
                  <TableCell>
                    {rep.commission_rate != null
                      ? formatPercent(rep.commission_rate)
                      : "-"}
                  </TableCell>
                  <TableCell>
                    {rep.hasPipWarning && (
                      <Badge
                        variant="destructive"
                        className="gap-1 text-xs"
                      >
                        <AlertTriangle className="h-3 w-3" />
                        PIP/Warning
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/admin/reps/${rep.id}/edit`}
                      className="text-sm text-[#60A5FA] hover:underline"
                    >
                      Edit
                    </Link>
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
