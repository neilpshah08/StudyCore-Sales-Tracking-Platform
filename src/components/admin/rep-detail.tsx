"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { cn, formatCurrency, formatDate, formatPercent } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"
import {
  Pencil, UserCheck, UserX, UserMinus, Plus, ExternalLink,
} from "lucide-react"
import type { User, Deal, CallReview, RepNote } from "@/types/database"

interface EnrichedCallReview extends CallReview {
  reviewer_name: string
}

interface EnrichedRepNote extends RepNote {
  author_name: string
}

interface WeeklyBreakdown {
  weekStart: string
  dials_made: number
  conversations: number
  qualified_bookings: number
  follow_ups_completed: number
  demos_scheduled: number
  demos_completed: number
  offers_made: number
  deals_closed: number
  cash_collected: number
  pif_deals: number
  payment_plan_deals: number
  intros_completed: number
  demos_booked_from_intros: number
  show_confirmations_sent: number
}

interface WeeklyPerformance {
  weekStart: string
  primaryKpi: number
}

interface Props {
  rep: User
  performance: WeeklyPerformance[]
  callReviews: EnrichedCallReview[]
  deals: Deal[]
  notes: EnrichedRepNote[]
  weeklyData: WeeklyBreakdown[]
}

const statusColors: Record<string, string> = {
  active: "success",
  inactive: "secondary",
  terminated: "destructive",
}

const noteTypeColors: Record<string, string> = {
  coaching: "bg-blue-100 text-blue-800",
  verbal_warning: "bg-amber-100 text-amber-800",
  pip: "bg-red-100 text-red-800",
  positive: "bg-green-100 text-green-800",
  general: "bg-gray-100 text-gray-800",
}

export function RepDetail({ rep, performance, callReviews, deals, notes, weeklyData }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({
    full_name: rep.full_name,
    commission_rate: rep.commission_rate?.toString() || "0",
    base_pay_weekly: rep.base_pay_weekly?.toString() || "0",
    status: rep.status,
    termination_date: rep.termination_date || "",
  })
  const [saving, setSaving] = useState(false)

  const [noteForm, setNoteForm] = useState({ note_type: "general", content: "" })
  const [savingNote, setSavingNote] = useState(false)

  const [reviewDetailOpen, setReviewDetailOpen] = useState(false)
  const [selectedReview, setSelectedReview] = useState<EnrichedCallReview | null>(null)

  const totalDeals = deals.length
  const totalCommission = deals.reduce((sum, d) => {
    if (d.setter_id === rep.id) sum += d.setter_commission || 0
    if (d.closer_id === rep.id) sum += d.closer_commission || 0
    return sum
  }, 0)

  const avgQAScore = callReviews.length > 0
    ? callReviews.reduce((s, r) => s + (r.weighted_score || 0), 0) / callReviews.length
    : 0

  async function handleEditSave() {
    setSaving(true)
    const res = await fetch(`/api/reps/${rep.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: editForm.full_name,
        commission_rate: parseFloat(editForm.commission_rate),
        base_pay_weekly: parseFloat(editForm.base_pay_weekly),
        status: editForm.status,
        termination_date: editForm.status !== "active" ? editForm.termination_date || null : null,
      }),
    })
    setSaving(false)
    if (res.ok) {
      toast({ title: "Rep updated", variant: "default" })
      setEditOpen(false)
      router.refresh()
    } else {
      toast({ title: "Error updating rep", variant: "destructive" })
    }
  }

  async function handleStatusChange(newStatus: string) {
    const res = await fetch(`/api/reps/${rep.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: newStatus,
        termination_date: newStatus === "terminated" ? new Date().toISOString().split("T")[0] : null,
      }),
    })
    if (res.ok) {
      toast({ title: `Rep ${newStatus}`, variant: "default" })
      router.refresh()
    } else {
      toast({ title: "Error changing status", variant: "destructive" })
    }
  }

  async function handleAddNote() {
    if (!noteForm.content.trim()) return
    setSavingNote(true)
    const res = await fetch(`/api/reps/${rep.id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(noteForm),
    })
    setSavingNote(false)
    if (res.ok) {
      toast({ title: "Note added", variant: "default" })
      setNoteForm({ note_type: "general", content: "" })
      router.refresh()
    } else {
      toast({ title: "Error adding note", variant: "destructive" })
    }
  }

  const chartData = performance.map((p) => ({
    week: new Date(p.weekStart).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    value: p.primaryKpi,
  }))

  return (
    <div className="space-y-6">
      {/* Rep Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle className="text-2xl">{rep.full_name}</CardTitle>
              <Badge variant={rep.role === "setter" ? "default" : "secondary"}>
                {rep.role}
              </Badge>
              <Badge variant={statusColors[rep.status] as "success" | "secondary" | "destructive"}>
                {rep.status}
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4 mr-1" /> Quick Edit
              </Button>
              <Button variant="default" size="sm" asChild>
                <a href={`/admin/reps/${rep.id}/edit`}>
                  Full Edit
                </a>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Hire Date</p>
              <p className="font-medium">{rep.hire_date ? formatDate(rep.hire_date) : "N/A"}</p>
            </div>
            {rep.termination_date && (
              <div>
                <p className="text-sm text-muted-foreground">Termination Date</p>
                <p className="font-medium text-red-600">{formatDate(rep.termination_date)}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Commission Rate</p>
              <p className="font-medium">{rep.commission_rate ? `${(rep.commission_rate * 100).toFixed(1)}%` : "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Deals</p>
              <p className="font-medium">{totalDeals}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Commission</p>
              <p className="font-medium text-green-600">{formatCurrency(totalCommission)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg QA Score</p>
              <p className={cn("font-medium", avgQAScore >= 4 ? "text-green-600" : avgQAScore >= 3 ? "text-yellow-600" : "text-red-600")}>
                {callReviews.length > 0 ? avgQAScore.toFixed(2) : "N/A"}
              </p>
            </div>
          </div>
          <Separator className="my-4" />
          <div className="flex gap-2">
            {rep.status !== "active" && (
              <Button size="sm" variant="outline" className="text-green-600 border-green-600" onClick={() => handleStatusChange("active")}>
                <UserCheck className="h-4 w-4 mr-1" /> Activate
              </Button>
            )}
            {rep.status === "active" && (
              <Button size="sm" variant="outline" className="text-yellow-600 border-yellow-600" onClick={() => handleStatusChange("inactive")}>
                <UserMinus className="h-4 w-4 mr-1" /> Deactivate
              </Button>
            )}
            {rep.status !== "terminated" && (
              <Button size="sm" variant="outline" className="text-red-600 border-red-600" onClick={() => handleStatusChange("terminated")}>
                <UserX className="h-4 w-4 mr-1" /> Terminate
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabbed Content */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="weekly">Weekly Data</TabsTrigger>
          <TabsTrigger value="reviews">Call Reviews</TabsTrigger>
          <TabsTrigger value="commissions">Commissions</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>{rep.role === "setter" ? "Bookings per Week" : "Cash Collected per Week"}</CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip formatter={(value) => rep.role === "closer" ? formatCurrency(Number(value)) : String(value)} />
                    <Line type="monotone" dataKey="value" stroke="#3B82F6" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-muted-foreground text-center py-8">No performance data yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Weekly Data Tab */}
        <TabsContent value="weekly">
          <Card>
            <CardHeader><CardTitle>Weekly Breakdown</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Week</TableHead>
                    {rep.role === "setter" ? (
                      <>
                        <TableHead>Dials</TableHead>
                        <TableHead>Convos</TableHead>
                        <TableHead>Bookings</TableHead>
                        <TableHead>Follow-Ups</TableHead>
                        <TableHead>Show Confirms</TableHead>
                        <TableHead>Intros</TableHead>
                        <TableHead>Demos from Intros</TableHead>
                      </>
                    ) : (
                      <>
                        <TableHead>Demos Sched</TableHead>
                        <TableHead>Demos Done</TableHead>
                        <TableHead>Offers</TableHead>
                        <TableHead>Closed</TableHead>
                        <TableHead>Cash</TableHead>
                        <TableHead>PIF</TableHead>
                        <TableHead>PP</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {weeklyData.map((w) => (
                    <TableRow key={w.weekStart}>
                      <TableCell className="font-medium">{formatDate(w.weekStart)}</TableCell>
                      {rep.role === "setter" ? (
                        <>
                          <TableCell>{w.dials_made}</TableCell>
                          <TableCell>{w.conversations}</TableCell>
                          <TableCell>{w.qualified_bookings}</TableCell>
                          <TableCell>{w.follow_ups_completed}</TableCell>
                          <TableCell>{w.show_confirmations_sent}</TableCell>
                          <TableCell>{w.intros_completed}</TableCell>
                          <TableCell>{w.demos_booked_from_intros}</TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell>{w.demos_scheduled}</TableCell>
                          <TableCell>{w.demos_completed}</TableCell>
                          <TableCell>{w.offers_made}</TableCell>
                          <TableCell>{w.deals_closed}</TableCell>
                          <TableCell>{formatCurrency(w.cash_collected)}</TableCell>
                          <TableCell>{w.pif_deals}</TableCell>
                          <TableCell>{w.payment_plan_deals}</TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                  {weeklyData.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">No weekly data</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Call Reviews Tab */}
        <TabsContent value="reviews">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Call Reviews ({callReviews.length})</CardTitle>
                {callReviews.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Avg Score: <span className={cn("font-bold", avgQAScore >= 4 ? "text-green-600" : avgQAScore >= 3 ? "text-yellow-600" : "text-red-600")}>
                      {avgQAScore.toFixed(2)}
                    </span>
                  </p>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Prospect</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Auto-Fail</TableHead>
                    <TableHead>Reviewer</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {callReviews.map((r) => {
                    const hasAutoFail = r.auto_fail_1 || r.auto_fail_2 || r.auto_fail_3 || r.auto_fail_4
                    return (
                      <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedReview(r); setReviewDetailOpen(true) }}>
                        <TableCell>{formatDate(r.date)}</TableCell>
                        <TableCell><Badge variant={r.call_type === "setter" ? "default" : "secondary"}>{r.call_type}</Badge></TableCell>
                        <TableCell>{r.prospect_name || "N/A"}</TableCell>
                        <TableCell>
                          <span className={cn("font-bold", (r.weighted_score || 0) >= 4 ? "text-green-600" : (r.weighted_score || 0) >= 3 ? "text-yellow-600" : "text-red-600")}>
                            {r.weighted_score?.toFixed(2) || "0.00"}
                          </span>
                        </TableCell>
                        <TableCell>{hasAutoFail ? <Badge variant="destructive">Yes</Badge> : <Badge variant="success">No</Badge>}</TableCell>
                        <TableCell>{r.reviewer_name}</TableCell>
                      </TableRow>
                    )
                  })}
                  {callReviews.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">No call reviews yet</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Commissions Tab */}
        <TabsContent value="commissions">
          <Card>
            <CardHeader><CardTitle>Commission History</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Deal Value</TableHead>
                    <TableHead>Commission</TableHead>
                    <TableHead>PIF Bonus</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deals.map((d) => {
                    const isCloser = d.closer_id === rep.id
                    const commission = isCloser ? (d.closer_commission || 0) : (d.setter_commission || 0)
                    const hasPayout = !!d.payout_date
                    const isClawback = d.clawback
                    return (
                      <TableRow key={d.id}>
                        <TableCell>{formatDate(d.date_closed)}</TableCell>
                        <TableCell>{d.student_name}</TableCell>
                        <TableCell>{formatCurrency(d.deal_value)}</TableCell>
                        <TableCell className="font-medium">{formatCurrency(commission)}</TableCell>
                        <TableCell>{formatCurrency(d.pif_bonus || 0)}</TableCell>
                        <TableCell>
                          {isClawback ? (
                            <Badge variant="destructive">Clawback</Badge>
                          ) : hasPayout ? (
                            <Badge variant="success">Paid</Badge>
                          ) : (
                            <Badge variant="warning">Pending</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {deals.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">No deals yet</TableCell>
                    </TableRow>
                  )}
                </TableBody>
                {deals.length > 0 && (
                  <tfoot>
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell colSpan={3}>Total</TableCell>
                      <TableCell>{formatCurrency(totalCommission)}</TableCell>
                      <TableCell>{formatCurrency(deals.reduce((s, d) => s + (d.pif_bonus || 0), 0))}</TableCell>
                      <TableCell />
                    </TableRow>
                  </tfoot>
                )}
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes">
          <Card>
            <CardHeader><CardTitle>Admin Notes</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {/* Add Note Form */}
              <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                <div className="flex gap-3">
                  <div className="w-48">
                    <Label>Type</Label>
                    <Select value={noteForm.note_type} onValueChange={(v) => setNoteForm({ ...noteForm, note_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="coaching">Coaching</SelectItem>
                        <SelectItem value="verbal_warning">Verbal Warning</SelectItem>
                        <SelectItem value="pip">PIP</SelectItem>
                        <SelectItem value="positive">Positive</SelectItem>
                        <SelectItem value="general">General</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1">
                    <Label>Note</Label>
                    <Textarea
                      value={noteForm.content}
                      onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })}
                      placeholder="Add a note about this rep..."
                      rows={2}
                    />
                  </div>
                </div>
                <Button onClick={handleAddNote} disabled={savingNote || !noteForm.content.trim()} size="sm">
                  <Plus className="h-4 w-4 mr-1" /> {savingNote ? "Saving..." : "Add Note"}
                </Button>
              </div>

              <Separator />

              {/* Notes List */}
              <div className="space-y-3">
                {notes.map((n) => (
                  <div key={n.id} className="border rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", noteTypeColors[n.note_type])}>
                        {n.note_type.replace("_", " ")}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        by {n.author_name} &middot; {formatDate(n.created_at)}
                      </span>
                    </div>
                    <p className="text-sm">{n.content}</p>
                  </div>
                ))}
                {notes.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">No notes yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Rep Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Rep</DialogTitle>
            <DialogDescription>Update {rep.full_name}&apos;s information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Full Name</Label>
              <Input value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} />
            </div>
            <div>
              <Label>Commission Rate (%)</Label>
              <Input type="number" step="0.1" value={(parseFloat(editForm.commission_rate) * 100).toString()} onChange={(e) => setEditForm({ ...editForm, commission_rate: (parseFloat(e.target.value) / 100).toString() })} />
            </div>
            <div>
              <Label>Base Pay Weekly ($)</Label>
              <Input type="number" step="0.01" value={editForm.base_pay_weekly} onChange={(e) => setEditForm({ ...editForm, base_pay_weekly: e.target.value })} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v as "active" | "inactive" | "terminated" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="terminated">Terminated</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editForm.status !== "active" && (
              <div>
                <Label>Termination Date</Label>
                <Input type="date" value={editForm.termination_date} onChange={(e) => setEditForm({ ...editForm, termination_date: e.target.value })} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Detail Dialog */}
      <Dialog open={reviewDetailOpen} onOpenChange={setReviewDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Call Review Detail</DialogTitle>
          </DialogHeader>
          {selectedReview && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Rep:</span> {rep.full_name}</div>
                <div><span className="text-muted-foreground">Date:</span> {formatDate(selectedReview.date)}</div>
                <div><span className="text-muted-foreground">Type:</span> <Badge variant={selectedReview.call_type === "setter" ? "default" : "secondary"}>{selectedReview.call_type}</Badge></div>
                <div><span className="text-muted-foreground">Prospect:</span> {selectedReview.prospect_name || "N/A"}</div>
              </div>
              {selectedReview.recording_link && (
                <a href={selectedReview.recording_link} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" /> Recording Link
                </a>
              )}
              <Separator />
              <div className="space-y-1">
                <p className="font-medium text-sm">Scoring Breakdown</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead>Weight</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Contribution</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedReview.call_type === "setter" ? (
                      <>
                        {[
                          { label: "Opening & Rapport", weight: 0.15, score: selectedReview.opening_rapport },
                          { label: "Discovery", weight: 0.30, score: selectedReview.discovery },
                          { label: "Budget Qualification", weight: 0.15, score: selectedReview.budget_qualification },
                          { label: "Transition & Pitch", weight: 0.15, score: selectedReview.transition_pitch },
                          { label: "Booking & Logistics", weight: 0.10, score: selectedReview.booking_logistics },
                          { label: "Professionalism", weight: 0.15, score: selectedReview.professionalism },
                        ].map((row) => (
                          <TableRow key={row.label}>
                            <TableCell className="text-sm">{row.label}</TableCell>
                            <TableCell className="text-sm">{(row.weight * 100).toFixed(0)}%</TableCell>
                            <TableCell className="text-sm font-medium">{row.score || 0}</TableCell>
                            <TableCell className="text-sm">{((row.score || 0) * row.weight).toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </>
                    ) : (
                      <>
                        {[
                          { label: "Rapport & Framing", weight: 0.10, score: selectedReview.rapport_framing },
                          { label: "Deep Discovery", weight: 0.25, score: selectedReview.deep_discovery },
                          { label: "Pitch & Presentation", weight: 0.20, score: selectedReview.pitch_presentation },
                          { label: "Objection Handling", weight: 0.20, score: selectedReview.objection_handling },
                          { label: "Close Execution", weight: 0.15, score: selectedReview.close_execution },
                          { label: "Professionalism", weight: 0.10, score: selectedReview.closer_professionalism },
                        ].map((row) => (
                          <TableRow key={row.label}>
                            <TableCell className="text-sm">{row.label}</TableCell>
                            <TableCell className="text-sm">{(row.weight * 100).toFixed(0)}%</TableCell>
                            <TableCell className="text-sm font-medium">{row.score || 0}</TableCell>
                            <TableCell className="text-sm">{((row.score || 0) * row.weight).toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </>
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Weighted Score</p>
                  <p className={cn("text-2xl font-bold",
                    (selectedReview.weighted_score || 0) >= 4 ? "text-green-600" :
                    (selectedReview.weighted_score || 0) >= 3 ? "text-yellow-600" : "text-red-600"
                  )}>
                    {selectedReview.weighted_score?.toFixed(2) || "0.00"}
                  </p>
                </div>
                {(selectedReview.auto_fail_1 || selectedReview.auto_fail_2 || selectedReview.auto_fail_3 || selectedReview.auto_fail_4) && (
                  <Badge variant="destructive">Auto-Fail Triggered</Badge>
                )}
              </div>
              {selectedReview.coaching_notes && (
                <div>
                  <p className="text-sm font-medium">Coaching Notes</p>
                  <p className="text-sm text-muted-foreground mt-1">{selectedReview.coaching_notes}</p>
                </div>
              )}
              <p className="text-xs text-muted-foreground">Reviewed by {selectedReview.reviewer_name}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
