"use client"

import { useState } from "react"
import { formatDate } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface AuditEntry {
  id: string
  timestamp: string
  admin_name: string
  action: string
  entity_type: string
  entity_id: string
  description: string
  changes: Record<string, { old: unknown; new: unknown }> | null
}

interface Props {
  entries: AuditEntry[]
}

const actionColors: Record<string, string> = {
  deal_created: "success",
  deal_edited: "default",
  commission_paid: "success",
  refund_processed: "destructive",
  rep_status_changed: "warning",
  rate_updated: "default",
}

export function AuditLogView({ entries }: Props) {
  const [filterAction, setFilterAction] = useState("all")
  const [filterEntity, setFilterEntity] = useState("all")
  const [filterSearch, setFilterSearch] = useState("")
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null)

  const actions = [...new Set(entries.map((e) => e.action))]
  const entityTypes = [...new Set(entries.map((e) => e.entity_type))]

  const filtered = entries.filter((e) => {
    if (filterAction !== "all" && e.action !== filterAction) return false
    if (filterEntity !== "all" && e.entity_type !== filterEntity) return false
    if (filterSearch && !e.description.toLowerCase().includes(filterSearch.toLowerCase()) && !e.admin_name.toLowerCase().includes(filterSearch.toLowerCase())) return false
    return true
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity Log ({filtered.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <Input className="w-64" placeholder="Search descriptions..." value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)} />
          <Select value={filterAction} onValueChange={setFilterAction}>
            <SelectTrigger className="w-44"><SelectValue placeholder="All Actions" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              {actions.map((a) => <SelectItem key={a} value={a}>{a.replace(/_/g, " ")}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterEntity} onValueChange={setFilterEntity}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All Entities" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Entities</SelectItem>
              {entityTypes.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Admin</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((e) => (
              <TableRow key={e.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedEntry(e); setDetailOpen(true) }}>
                <TableCell className="text-sm whitespace-nowrap">
                  {new Date(e.timestamp).toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </TableCell>
                <TableCell className="font-medium">{e.admin_name}</TableCell>
                <TableCell>
                  <Badge variant={(actionColors[e.action] || "outline") as "success" | "default" | "destructive" | "warning" | "outline"}>
                    {e.action.replace(/_/g, " ")}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-white/55">{e.entity_type}</TableCell>
                <TableCell className="text-sm max-w-md truncate">{e.description}</TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-white/55 py-8">No audit entries found</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Audit Entry Detail</DialogTitle></DialogHeader>
          {selectedEntry && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-white/55">Timestamp:</span> {new Date(selectedEntry.timestamp).toLocaleString("en-US", { timeZone: "America/Los_Angeles" })}</div>
                <div><span className="text-white/55">Admin:</span> {selectedEntry.admin_name}</div>
                <div><span className="text-white/55">Action:</span> {selectedEntry.action}</div>
                <div><span className="text-white/55">Entity:</span> {selectedEntry.entity_type}</div>
              </div>
              <div>
                <p className="text-sm text-white/55">Description</p>
                <p className="text-sm">{selectedEntry.description}</p>
              </div>
              {selectedEntry.changes && Object.keys(selectedEntry.changes).length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Changes</p>
                  <div className="bg-muted rounded-lg p-3 space-y-1">
                    {Object.entries(selectedEntry.changes).map(([field, change]) => (
                      <div key={field} className="text-sm">
                        <span className="font-medium">{field}:</span>{" "}
                        <span className="text-[#EF4444] line-through">{String(change.old)}</span>{" → "}
                        <span className="text-[#10B981]">{String(change.new)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-xs text-white/55">Entity ID: {selectedEntry.entity_id}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
