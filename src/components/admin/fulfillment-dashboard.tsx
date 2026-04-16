"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { cn, formatDate } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Users, Clock, AlertTriangle, AlertCircle, Pencil } from "lucide-react"

interface FulfillmentRecord {
  deal_id: string
  student_name: string
  date_closed: string
  days_since_close: number
  first_session_scheduled: boolean
  first_session_date: string | null
  tutor_assigned: string | null
  sessions_completed: number
  total_sessions_purchased: number | null
  status: string
  fulfillment_id: string | null
}

interface Props {
  summary: { totalActiveStudents: number; avgDaysToFirstSession: number; onboardingDelayCount: number; atRiskCount: number }
  records: FulfillmentRecord[]
}

const statusColors: Record<string, string> = {
  pending_onboarding: "warning",
  active: "success",
  paused: "secondary",
  completed: "default",
  cancelled: "destructive",
}

export function FulfillmentDashboard({ summary, records }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [editOpen, setEditOpen] = useState(false)
  const [selected, setSelected] = useState<FulfillmentRecord | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    first_session_scheduled: false,
    first_session_date: "",
    tutor_assigned: "",
    sessions_completed: 0,
    total_sessions_purchased: 0,
    status: "pending_onboarding",
    notes: "",
  })

  function openEdit(record: FulfillmentRecord) {
    setSelected(record)
    setForm({
      first_session_scheduled: record.first_session_scheduled,
      first_session_date: record.first_session_date || "",
      tutor_assigned: record.tutor_assigned || "",
      sessions_completed: record.sessions_completed,
      total_sessions_purchased: record.total_sessions_purchased || 0,
      status: record.status,
      notes: "",
    })
    setEditOpen(true)
  }

  async function handleSave() {
    if (!selected) return
    setSaving(true)

    const supabase = createClient()
    const payload = {
      deal_id: selected.deal_id,
      first_session_scheduled: form.first_session_scheduled,
      first_session_date: form.first_session_date || null,
      tutor_assigned: form.tutor_assigned || null,
      sessions_completed: form.sessions_completed,
      total_sessions_purchased: form.total_sessions_purchased || null,
      status: form.status,
      notes: form.notes || null,
    }

    const { error } = selected.fulfillment_id
      ? await supabase.from("deal_fulfillment").update(payload).eq("id", selected.fulfillment_id)
      : await supabase.from("deal_fulfillment").insert(payload)

    setSaving(false)
    if (error) {
      toast({ title: "Error saving", variant: "destructive" })
    } else {
      toast({ title: "Fulfillment updated" })
      setEditOpen(false)
      router.refresh()
    }
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-blue-500" />
              <p className="text-sm text-muted-foreground">Active Students</p>
            </div>
            <p className="text-2xl font-bold">{summary.totalActiveStudents}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-blue-500" />
              <p className="text-sm text-muted-foreground">Avg Days to 1st Session</p>
            </div>
            <p className="text-2xl font-bold">{summary.avgDaysToFirstSession}</p>
          </CardContent>
        </Card>
        <Card className={cn(summary.onboardingDelayCount > 0 && "border-amber-400")}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <p className="text-sm text-muted-foreground">Onboarding Delay</p>
            </div>
            <p className={cn("text-2xl font-bold", summary.onboardingDelayCount > 0 && "text-amber-600")}>{summary.onboardingDelayCount}</p>
          </CardContent>
        </Card>
        <Card className={cn(summary.atRiskCount > 0 && "border-red-400")}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <p className="text-sm text-muted-foreground">At-Risk</p>
            </div>
            <p className={cn("text-2xl font-bold", summary.atRiskCount > 0 && "text-red-600")}>{summary.atRiskCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader><CardTitle>Student Fulfillment Status</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Date Closed</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>1st Session</TableHead>
                <TableHead>Session Date</TableHead>
                <TableHead>Tutor</TableHead>
                <TableHead>Sessions</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Flags</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((r) => {
                const isDelay = r.days_since_close > 3 && !r.first_session_scheduled
                const isCritical = r.days_since_close > 7 && r.status === "pending_onboarding"
                return (
                  <TableRow key={r.deal_id} className={cn(isCritical && "bg-red-50")}>
                    <TableCell className="font-medium">{r.student_name}</TableCell>
                    <TableCell>{formatDate(r.date_closed)}</TableCell>
                    <TableCell>{r.days_since_close}</TableCell>
                    <TableCell>{r.first_session_scheduled ? <Badge variant="success">Yes</Badge> : <Badge variant="destructive">No</Badge>}</TableCell>
                    <TableCell>{r.first_session_date ? formatDate(r.first_session_date) : "—"}</TableCell>
                    <TableCell>{r.tutor_assigned || "—"}</TableCell>
                    <TableCell>{r.sessions_completed}{r.total_sessions_purchased ? `/${r.total_sessions_purchased}` : ""}</TableCell>
                    <TableCell><Badge variant={statusColors[r.status] as "warning" | "success" | "secondary" | "default" | "destructive"}>{r.status.replace("_", " ")}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {isDelay && <Badge variant="destructive" className="text-xs">Delay</Badge>}
                        {isCritical && <Badge variant="destructive" className="text-xs animate-pulse">Critical</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
              {records.length === 0 && (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">No active deals</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Fulfillment - {selected?.student_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Checkbox checked={form.first_session_scheduled} onCheckedChange={(c) => setForm({ ...form, first_session_scheduled: !!c })} />
              <Label>First Session Scheduled</Label>
            </div>
            <div>
              <Label>First Session Date</Label>
              <Input type="date" value={form.first_session_date} onChange={(e) => setForm({ ...form, first_session_date: e.target.value })} />
            </div>
            <div>
              <Label>Tutor Assigned</Label>
              <Input value={form.tutor_assigned} onChange={(e) => setForm({ ...form, tutor_assigned: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Sessions Completed</Label>
                <Input type="number" value={form.sessions_completed} onChange={(e) => setForm({ ...form, sessions_completed: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Total Sessions Purchased</Label>
                <Input type="number" value={form.total_sessions_purchased} onChange={(e) => setForm({ ...form, total_sessions_purchased: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending_onboarding">Pending Onboarding</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
