"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { toast } from "@/components/ui/use-toast"
import { PAYMENT_PLANS } from "@/lib/constants"
import { Plus, Loader2 } from "lucide-react"

interface Props {
  closerId: string
}

export function LogDealDialog({ closerId }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [studentName, setStudentName] = useState("")
  const [parentName, setParentName] = useState("")
  const [dealValue, setDealValue] = useState("")
  const [cashCollected, setCashCollected] = useState("")
  const [paymentPlan, setPaymentPlan] = useState("PIF")
  const [notes, setNotes] = useState("")

  function resetForm() {
    setStudentName("")
    setParentName("")
    setDealValue("")
    setCashCollected("")
    setPaymentPlan("PIF")
    setNotes("")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!studentName || !dealValue) return

    setSaving(true)
    try {
      const res = await fetch("/api/deals/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_name: studentName,
          parent_name: parentName || null,
          deal_value: parseFloat(dealValue),
          cash_collected: parseFloat(cashCollected || dealValue),
          payment_plan: paymentPlan,
          closer_id: closerId,
          notes: notes || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to log deal")
      }

      toast({
        title: "Deal Logged!",
        description: `${studentName} — $${parseFloat(dealValue).toLocaleString()}`,
        variant: "success",
      })

      resetForm()
      setOpen(false)
      router.refresh()
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to log deal",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> Log a Deal
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log a Deal</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="deal-student">Student Name *</Label>
            <Input
              id="deal-student"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="John Smith"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="deal-parent">Parent Name</Label>
            <Input
              id="deal-parent"
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="deal-value">Deal Value ($) *</Label>
              <Input
                id="deal-value"
                type="number"
                min={0}
                step={0.01}
                value={dealValue}
                onChange={(e) => {
                  setDealValue(e.target.value)
                  if (!cashCollected) setCashCollected(e.target.value)
                }}
                placeholder="5000"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deal-cash">Cash Collected ($)</Label>
              <Input
                id="deal-cash"
                type="number"
                min={0}
                step={0.01}
                value={cashCollected}
                onChange={(e) => setCashCollected(e.target.value)}
                placeholder={dealValue || "5000"}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Payment Plan</Label>
            <Select value={paymentPlan} onValueChange={setPaymentPlan}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_PLANS.map((plan) => (
                  <SelectItem key={plan} value={plan}>{plan}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="deal-notes">Notes</Label>
            <Textarea
              id="deal-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !studentName || !dealValue}>
              {saving ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
              ) : (
                "Log Deal"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
