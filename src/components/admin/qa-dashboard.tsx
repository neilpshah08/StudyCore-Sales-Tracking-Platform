"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { cn, formatDate, exportToCsv } from "@/lib/utils"
import { SETTER_WEIGHTS, CLOSER_WEIGHTS } from "@/lib/constants"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts"
import { Plus, FileDown, ExternalLink, Star, AlertTriangle, Eye } from "lucide-react"

interface ReviewWithNames {
  id: string
  reviewed_by: string
  rep_id: string
  call_type: "setter" | "closer"
  date: string
  prospect_name: string | null
  recording_link: string | null
  opening_rapport: number | null
  discovery: number | null
  budget_qualification: number | null
  transition_pitch: number | null
  booking_logistics: number | null
  professionalism: number | null
  rapport_framing: number | null
  deep_discovery: number | null
  pitch_presentation: number | null
  objection_handling: number | null
  close_execution: number | null
  closer_professionalism: number | null
  auto_fail_1: boolean
  auto_fail_2: boolean
  auto_fail_3: boolean
  auto_fail_4: boolean
  weighted_score: number | null
  coaching_notes: string | null
  created_at: string
  rep_name: string | null
  rep_role: string | null
  reviewer_name: string | null
}

interface Props {
  reviews: ReviewWithNames[]
  reps: { id: string; full_name: string; role: string }[]
  repAverages: { repName: string; avgScore: number; reviewCount: number }[]
}

const AUTO_FAIL_LABELS = [
  "Rude or disrespectful to prospect",
  "Misrepresented product/pricing",
  "Failed to follow script/process",
  "Unprofessional conduct",
]

const SETTER_RUBRIC = [
  { key: "opening_rapport", label: "Opening & Rapport", weight: SETTER_WEIGHTS.opening_rapport },
  { key: "discovery", label: "Discovery", weight: SETTER_WEIGHTS.discovery },
  { key: "budget_qualification", label: "Budget Qualification", weight: SETTER_WEIGHTS.budget_qualification },
  { key: "transition_pitch", label: "Transition & Pitch", weight: SETTER_WEIGHTS.transition_pitch },
  { key: "booking_logistics", label: "Booking & Logistics", weight: SETTER_WEIGHTS.booking_logistics },
  { key: "professionalism", label: "Professionalism", weight: SETTER_WEIGHTS.professionalism },
]

const CLOSER_RUBRIC = [
  { key: "rapport_framing", label: "Rapport & Framing", weight: CLOSER_WEIGHTS.rapport_framing },
  { key: "deep_discovery", label: "Deep Discovery", weight: CLOSER_WEIGHTS.deep_discovery },
  { key: "pitch_presentation", label: "Pitch & Presentation", weight: CLOSER_WEIGHTS.pitch_presentation },
  { key: "objection_handling", label: "Objection Handling", weight: CLOSER_WEIGHTS.objection_handling },
  { key: "close_execution", label: "Close Execution", weight: CLOSER_WEIGHTS.close_execution },
  { key: "closer_professionalism", label: "Professionalism", weight: CLOSER_WEIGHTS.closer_professionalism },
]

export function QADashboard({ reviews, reps, repAverages }: Props) {
  const router = useRouter()
  const { toast } = useToast()

  const [scoreOpen, setScoreOpen] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const [selectedReview, setSelectedReview] = useState<ReviewWithNames | null>(null)
  const [saving, setSaving] = useState(false)

  // Score form state
  const [formRepId, setFormRepId] = useState("")
  const [formCallType, setFormCallType] = useState<"setter" | "closer">("setter")
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0])
  const [formProspect, setFormProspect] = useState("")
  const [formRecording, setFormRecording] = useState("")
  const [formScores, setFormScores] = useState<Record<string, number>>({})
  const [formAutoFails, setFormAutoFails] = useState([false, false, false, false])
  const [formNotes, setFormNotes] = useState("")

  // Filters
  const [filterRep, setFilterRep] = useState("all")
  const [filterStartDate, setFilterStartDate] = useState("")
  const [filterEndDate, setFilterEndDate] = useState("")
  const [filterAutoFail, setFilterAutoFail] = useState("all")

  const rubric = formCallType === "setter" ? SETTER_RUBRIC : CLOSER_RUBRIC
  const hasAutoFail = formAutoFails.some(Boolean)

  const weightedScore = hasAutoFail ? 0 : rubric.reduce((sum, r) => {
    return sum + (formScores[r.key] || 0) * r.weight
  }, 0)

  function resetForm() {
    setFormRepId("")
    setFormCallType("setter")
    setFormDate(new Date().toISOString().split("T")[0])
    setFormProspect("")
    setFormRecording("")
    setFormScores({})
    setFormAutoFails([false, false, false, false])
    setFormNotes("")
  }

  function handleRepSelect(repId: string) {
    setFormRepId(repId)
    const rep = reps.find((r) => r.id === repId)
    if (rep) {
      setFormCallType(rep.role === "closer" ? "closer" : "setter")
    }
  }

  async function handleSubmitScore() {
    if (!formRepId) return
    setSaving(true)

    const body: Record<string, unknown> = {
      rep_id: formRepId,
      call_type: formCallType,
      date: formDate,
      prospect_name: formProspect || null,
      recording_link: formRecording || null,
      auto_fail_1: formAutoFails[0],
      auto_fail_2: formAutoFails[1],
      auto_fail_3: formAutoFails[2],
      auto_fail_4: formAutoFails[3],
      coaching_notes: formNotes || null,
    }

    for (const r of rubric) {
      body[r.key] = formScores[r.key] || 1
    }

    const res = await fetch("/api/qa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    setSaving(false)
    if (res.ok) {
      toast({ title: "Call scored successfully", variant: "default" })
      setScoreOpen(false)
      resetForm()
      router.refresh()
    } else {
      const data = await res.json().catch(() => ({}))
      toast({ title: data.error || "Error scoring call", variant: "destructive" })
    }
  }

  const filteredReviews = reviews.filter((r) => {
    if (filterRep !== "all" && r.rep_id !== filterRep) return false
    if (filterStartDate && r.date < filterStartDate) return false
    if (filterEndDate && r.date > filterEndDate) return false
    if (filterAutoFail === "yes" && !(r.auto_fail_1 || r.auto_fail_2 || r.auto_fail_3 || r.auto_fail_4)) return false
    if (filterAutoFail === "no" && (r.auto_fail_1 || r.auto_fail_2 || r.auto_fail_3 || r.auto_fail_4)) return false
    return true
  })

  function handleExport() {
    exportToCsv(
      filteredReviews.map((r) => ({
        Date: r.date,
        Rep: r.rep_name || "",
        "Call Type": r.call_type,
        Prospect: r.prospect_name || "",
        Score: r.weighted_score?.toFixed(2) || "0",
        "Auto-Fail": (r.auto_fail_1 || r.auto_fail_2 || r.auto_fail_3 || r.auto_fail_4) ? "Yes" : "No",
        Reviewer: r.reviewer_name || "",
      })),
      `call_reviews_${new Date().toISOString().split("T")[0]}.csv`
    )
  }

  const barData = repAverages.map((r) => ({
    name: r.repName,
    score: r.avgScore,
    count: r.reviewCount,
  }))

  return (
    <div className="space-y-6">
      {/* Score a Call Button */}
      <div className="flex justify-end">
        <Button onClick={() => { resetForm(); setScoreOpen(true) }}>
          <Plus className="h-4 w-4 mr-2" /> Score a Call
        </Button>
      </div>

      {/* Rep Averages Chart */}
      {barData.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Average QA Scores by Rep</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis domain={[0, 5]} fontSize={12} />
                <Tooltip formatter={(value) => [Number(value).toFixed(2), "Avg Score"]} />
                <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                  {barData.map((entry, index) => (
                    <Cell key={index} fill={entry.score >= 4 ? "#16A34A" : entry.score >= 3 ? "#F59E0B" : "#DC2626"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Review History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Review History ({filteredReviews.length})</CardTitle>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <FileDown className="h-4 w-4 mr-1" /> Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <Select value={filterRep} onValueChange={setFilterRep}>
              <SelectTrigger className="w-48"><SelectValue placeholder="All Reps" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Reps</SelectItem>
                {reps.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="date" className="w-40" value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)} placeholder="Start Date" />
            <Input type="date" className="w-40" value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)} placeholder="End Date" />
            <Select value={filterAutoFail} onValueChange={setFilterAutoFail}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="yes">Auto-Fail Only</SelectItem>
                <SelectItem value="no">No Auto-Fail</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Rep</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Prospect</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Auto-Fail</TableHead>
                <TableHead>Reviewer</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredReviews.map((r) => {
                const af = r.auto_fail_1 || r.auto_fail_2 || r.auto_fail_3 || r.auto_fail_4
                return (
                  <TableRow key={r.id}>
                    <TableCell>{formatDate(r.date)}</TableCell>
                    <TableCell>{r.rep_name || "Unknown"}</TableCell>
                    <TableCell><Badge variant={r.call_type === "setter" ? "default" : "secondary"}>{r.call_type}</Badge></TableCell>
                    <TableCell>{r.prospect_name || "N/A"}</TableCell>
                    <TableCell>
                      <span className={cn("font-bold", (r.weighted_score || 0) >= 4 ? "text-green-600" : (r.weighted_score || 0) >= 3 ? "text-yellow-600" : "text-red-600")}>
                        {r.weighted_score?.toFixed(2) || "0.00"}
                      </span>
                    </TableCell>
                    <TableCell>{af ? <Badge variant="destructive">Yes</Badge> : <Badge variant="success">No</Badge>}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.reviewer_name}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => { setSelectedReview(r); setViewOpen(true) }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
              {filteredReviews.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">No reviews found</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Score a Call Dialog */}
      <Dialog open={scoreOpen} onOpenChange={setScoreOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Score a Call</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Rep</Label>
                <Select value={formRepId} onValueChange={handleRepSelect}>
                  <SelectTrigger><SelectValue placeholder="Select rep" /></SelectTrigger>
                  <SelectContent>
                    {reps.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.full_name} ({r.role})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Call Type</Label>
                <Select value={formCallType} onValueChange={(v) => setFormCallType(v as "setter" | "closer")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="setter">Setter</SelectItem>
                    <SelectItem value="closer">Closer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
              </div>
              <div>
                <Label>Prospect Name</Label>
                <Input value={formProspect} onChange={(e) => setFormProspect(e.target.value)} placeholder="Optional" />
              </div>
              <div className="col-span-2">
                <Label>Recording Link</Label>
                <Input value={formRecording} onChange={(e) => setFormRecording(e.target.value)} placeholder="https://..." />
              </div>
            </div>

            <Separator />

            {/* Scoring Rubric */}
            <div className="space-y-4">
              <h3 className="font-semibold">{formCallType === "setter" ? "Setter" : "Closer"} Rubric</h3>
              {rubric.map((r) => (
                <div key={r.key} className="flex items-center gap-4">
                  <div className="w-44 flex-shrink-0">
                    <p className="text-sm font-medium">{r.label}</p>
                    <p className="text-xs text-muted-foreground">{(r.weight * 100).toFixed(0)}% weight</p>
                  </div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((score) => (
                      <button
                        key={score}
                        type="button"
                        className={cn(
                          "w-10 h-10 rounded-lg border text-sm font-medium transition-colors",
                          formScores[r.key] === score
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                        )}
                        onClick={() => setFormScores({ ...formScores, [r.key]: score })}
                      >
                        {score}
                      </button>
                    ))}
                  </div>
                  <span className="text-sm text-muted-foreground w-24 text-right">
                    {formScores[r.key] ? `${formScores[r.key]} × ${(r.weight * 100).toFixed(0)}% = ${(formScores[r.key] * r.weight).toFixed(2)}` : "—"}
                  </span>
                </div>
              ))}
            </div>

            <Separator />

            {/* Auto-Fail */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" /> Auto-Fail Flags
              </h3>
              {AUTO_FAIL_LABELS.map((label, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Checkbox
                    checked={formAutoFails[i]}
                    onCheckedChange={(checked) => {
                      const next = [...formAutoFails]
                      next[i] = !!checked
                      setFormAutoFails(next)
                    }}
                  />
                  <span className="text-sm">{label}</span>
                </div>
              ))}
              {hasAutoFail && (
                <p className="text-sm text-red-600 font-medium">Auto-fail triggered — score will be 0</p>
              )}
            </div>

            <Separator />

            {/* Coaching Notes */}
            <div>
              <Label>Coaching Notes</Label>
              <Textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Feedback and coaching points..." rows={4} />
            </div>

            {/* Score Display */}
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Weighted Score</p>
              <p className={cn("text-4xl font-bold",
                hasAutoFail ? "text-red-600" :
                weightedScore >= 4 ? "text-green-600" :
                weightedScore >= 3 ? "text-yellow-600" : "text-red-600"
              )}>
                {weightedScore.toFixed(2)}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setScoreOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmitScore} disabled={saving || !formRepId}>
              {saving ? "Saving..." : "Submit Score"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Scorecard Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Call Review Detail</DialogTitle>
          </DialogHeader>
          {selectedReview && (() => {
            const reviewRubric = selectedReview.call_type === "setter" ? [
              { label: "Opening & Rapport", weight: 0.15, score: selectedReview.opening_rapport },
              { label: "Discovery", weight: 0.30, score: selectedReview.discovery },
              { label: "Budget Qualification", weight: 0.15, score: selectedReview.budget_qualification },
              { label: "Transition & Pitch", weight: 0.15, score: selectedReview.transition_pitch },
              { label: "Booking & Logistics", weight: 0.10, score: selectedReview.booking_logistics },
              { label: "Professionalism", weight: 0.15, score: selectedReview.professionalism },
            ] : [
              { label: "Rapport & Framing", weight: 0.10, score: selectedReview.rapport_framing },
              { label: "Deep Discovery", weight: 0.25, score: selectedReview.deep_discovery },
              { label: "Pitch & Presentation", weight: 0.20, score: selectedReview.pitch_presentation },
              { label: "Objection Handling", weight: 0.20, score: selectedReview.objection_handling },
              { label: "Close Execution", weight: 0.15, score: selectedReview.close_execution },
              { label: "Professionalism", weight: 0.10, score: selectedReview.closer_professionalism },
            ]
            const af = selectedReview.auto_fail_1 || selectedReview.auto_fail_2 || selectedReview.auto_fail_3 || selectedReview.auto_fail_4
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Rep:</span> {selectedReview.rep_name}</div>
                  <div><span className="text-muted-foreground">Date:</span> {formatDate(selectedReview.date)}</div>
                  <div><span className="text-muted-foreground">Type:</span> <Badge variant={selectedReview.call_type === "setter" ? "default" : "secondary"}>{selectedReview.call_type}</Badge></div>
                  <div><span className="text-muted-foreground">Prospect:</span> {selectedReview.prospect_name || "N/A"}</div>
                </div>
                {selectedReview.recording_link && (
                  <a href={selectedReview.recording_link} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 flex items-center gap-1">
                    <ExternalLink className="h-3 w-3" /> Recording
                  </a>
                )}
                <Separator />
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead>Weight</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Points</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reviewRubric.map((r) => (
                      <TableRow key={r.label}>
                        <TableCell className="text-sm">{r.label}</TableCell>
                        <TableCell className="text-sm">{(r.weight * 100).toFixed(0)}%</TableCell>
                        <TableCell className="text-sm font-medium">{r.score || 0}</TableCell>
                        <TableCell className="text-sm">{((r.score || 0) * r.weight).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
                  {af && <Badge variant="destructive">Auto-Fail</Badge>}
                </div>
                {selectedReview.coaching_notes && (
                  <div>
                    <p className="text-sm font-medium">Coaching Notes</p>
                    <p className="text-sm text-muted-foreground mt-1">{selectedReview.coaching_notes}</p>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Reviewed by {selectedReview.reviewer_name}</p>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}
