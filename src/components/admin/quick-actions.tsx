"use client"

import { useState } from "react"
import Link from "next/link"
import { UserPlus, Handshake, PhoneCall, DollarSign, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { getWeekStart } from "@/lib/utils"

export function QuickActions() {
  const [adSpendOpen, setAdSpendOpen] = useState(false)
  const [weekStart, setWeekStart] = useState(getWeekStart(new Date()))
  const [spendAmount, setSpendAmount] = useState("")
  const [platform, setPlatform] = useState("Meta")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const handleSaveAdSpend = async () => {
    if (!spendAmount || isNaN(Number(spendAmount))) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid spend amount.",
        variant: "destructive",
      })
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/settings/ad-spend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          week_start: weekStart,
          spend_amount: Number(spendAmount),
          platform,
          notes: notes || null,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to save ad spend")
      }

      toast({
        title: "Ad spend saved",
        description: `$${Number(spendAmount).toLocaleString()} for week of ${weekStart}`,
        variant: "success",
      })

      setAdSpendOpen(false)
      setSpendAmount("")
      setNotes("")
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to save",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Button asChild>
        <Link href="/register">
          <UserPlus className="mr-2 h-4 w-4" />
          Add New Rep
        </Link>
      </Button>

      <Button variant="outline" asChild>
        <Link href="/admin/deals?action=new">
          <Handshake className="mr-2 h-4 w-4" />
          Log a Deal
        </Link>
      </Button>

      <Button variant="outline" asChild>
        <Link href="/admin/qa?action=new">
          <PhoneCall className="mr-2 h-4 w-4" />
          Score a Call
        </Link>
      </Button>

      <Dialog open={adSpendOpen} onOpenChange={setAdSpendOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">
            <DollarSign className="mr-2 h-4 w-4" />
            Update Ad Spend
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Weekly Ad Spend</DialogTitle>
            <DialogDescription>
              Enter the advertising spend for a specific week.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="week-start">Week Starting</Label>
              <Input
                id="week-start"
                type="date"
                value={weekStart}
                onChange={(e) => setWeekStart(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="spend-amount">Spend Amount ($)</Label>
              <Input
                id="spend-amount"
                type="number"
                placeholder="0.00"
                min="0"
                step="0.01"
                value={spendAmount}
                onChange={(e) => setSpendAmount(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="platform">Platform</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger id="platform">
                  <SelectValue placeholder="Select platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Meta">Meta</SelectItem>
                  <SelectItem value="Google">Google</SelectItem>
                  <SelectItem value="TikTok">TikTok</SelectItem>
                  <SelectItem value="YouTube">YouTube</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ad-notes">Notes</Label>
              <Textarea
                id="ad-notes"
                placeholder="Optional notes about this spend..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAdSpendOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveAdSpend} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
