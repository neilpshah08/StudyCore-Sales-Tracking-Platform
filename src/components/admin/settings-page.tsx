"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Save, Plus, Pencil } from "lucide-react"
import type { CommissionRate } from "@/types/database"

interface Props {
  settings: Record<string, unknown>
  commissionRates: CommissionRate[]
}

export function SettingsPage({ settings, commissionRates }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

  const [leaderboardMode, setLeaderboardMode] = useState(settings.leaderboard_mode === "anonymous")
  const [monthlyTarget, setMonthlyTarget] = useState(String(settings.monthly_revenue_target || 150000))
  const [saving, setSaving] = useState(false)

  const [benchmarks, setBenchmarks] = useState({
    setter_weekly_dials_target: String(settings.setter_weekly_dials_target || 350),
    setter_weekly_conversations_target: String(settings.setter_weekly_conversations_target || 40),
    setter_weekly_bookings_target: String(settings.setter_weekly_bookings_target || 20),
    setter_contact_rate_target: String(((settings.setter_contact_rate_target as number) || 0.5) * 100),
    setter_book_rate_target: String(((settings.setter_book_rate_target as number) || 0.4) * 100),
    setter_intro_demo_rate_target: String(((settings.setter_intro_demo_rate_target as number) || 0.6) * 100),
    closer_weekly_demos_target: String(settings.closer_weekly_demos_target || 15),
    closer_weekly_cash_target: String(settings.closer_weekly_cash_target || 30000),
    closer_close_rate_target: String(((settings.closer_close_rate_target as number) || 0.3) * 100),
    closer_offer_rate_target: String(((settings.closer_offer_rate_target as number) || 0.85) * 100),
    closer_avg_deal_size_target: String(settings.closer_avg_deal_size_target || 5000),
  })

  const [rateDialogOpen, setRateDialogOpen] = useState(false)
  const [editingRate, setEditingRate] = useState<CommissionRate | null>(null)
  const [rateForm, setRateForm] = useState({
    role: "setter" as string,
    label: "",
    rate: "",
    pif_bonus_rate: "",
    min_close_rate: "",
    effective_date: new Date().toISOString().split("T")[0],
  })

  async function saveSetting(key: string, value: unknown) {
    const { error } = await supabase.from("app_settings").upsert({ key, value }, { onConflict: "key" })
    return !error
  }

  async function handleSaveGeneral() {
    setSaving(true)
    const results = await Promise.all([
      saveSetting("leaderboard_mode", leaderboardMode ? "anonymous" : "named"),
      saveSetting("monthly_revenue_target", Number(monthlyTarget)),
    ])
    setSaving(false)
    if (results.every(Boolean)) {
      toast({ title: "Settings saved" })
      router.refresh()
    } else {
      toast({ title: "Error saving settings", variant: "destructive" })
    }
  }

  async function handleSaveBenchmarks() {
    setSaving(true)
    const entries = [
      ["setter_weekly_dials_target", Number(benchmarks.setter_weekly_dials_target)],
      ["setter_weekly_conversations_target", Number(benchmarks.setter_weekly_conversations_target)],
      ["setter_weekly_bookings_target", Number(benchmarks.setter_weekly_bookings_target)],
      ["setter_contact_rate_target", Number(benchmarks.setter_contact_rate_target) / 100],
      ["setter_book_rate_target", Number(benchmarks.setter_book_rate_target) / 100],
      ["setter_intro_demo_rate_target", Number(benchmarks.setter_intro_demo_rate_target) / 100],
      ["closer_weekly_demos_target", Number(benchmarks.closer_weekly_demos_target)],
      ["closer_weekly_cash_target", Number(benchmarks.closer_weekly_cash_target)],
      ["closer_close_rate_target", Number(benchmarks.closer_close_rate_target) / 100],
      ["closer_offer_rate_target", Number(benchmarks.closer_offer_rate_target) / 100],
      ["closer_avg_deal_size_target", Number(benchmarks.closer_avg_deal_size_target)],
    ] as const
    const results = await Promise.all(entries.map(([k, v]) => saveSetting(k, v)))
    setSaving(false)
    if (results.every(Boolean)) {
      toast({ title: "Benchmarks saved" })
      router.refresh()
    } else {
      toast({ title: "Error saving benchmarks", variant: "destructive" })
    }
  }

  function openAddRate() {
    setEditingRate(null)
    setRateForm({ role: "setter", label: "", rate: "", pif_bonus_rate: "", min_close_rate: "", effective_date: new Date().toISOString().split("T")[0] })
    setRateDialogOpen(true)
  }

  function openEditRate(rate: CommissionRate) {
    setEditingRate(rate)
    setRateForm({
      role: rate.role,
      label: rate.label,
      rate: String(rate.rate * 100),
      pif_bonus_rate: String((rate.pif_bonus_rate || 0) * 100),
      min_close_rate: rate.min_close_rate ? String(rate.min_close_rate * 100) : "",
      effective_date: rate.effective_date,
    })
    setRateDialogOpen(true)
  }

  async function handleSaveRate() {
    setSaving(true)
    const payload = {
      role: rateForm.role,
      label: rateForm.label,
      rate: Number(rateForm.rate) / 100,
      pif_bonus_rate: Number(rateForm.pif_bonus_rate || 0) / 100,
      min_close_rate: rateForm.min_close_rate ? Number(rateForm.min_close_rate) / 100 : null,
      effective_date: rateForm.effective_date,
    }

    const { error } = editingRate
      ? await supabase.from("commission_rates").update(payload).eq("id", editingRate.id)
      : await supabase.from("commission_rates").insert(payload)

    setSaving(false)
    if (error) {
      toast({ title: "Error saving rate", variant: "destructive" })
    } else {
      toast({ title: "Commission rate saved" })
      setRateDialogOpen(false)
      router.refresh()
    }
  }

  return (
    <Tabs defaultValue="general">
      <TabsList>
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="benchmarks">Benchmarks</TabsTrigger>
        <TabsTrigger value="rates">Commission Rates</TabsTrigger>
      </TabsList>

      <TabsContent value="general">
        <Card>
          <CardHeader><CardTitle>General Settings</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Anonymous Leaderboard</Label>
                <p className="text-sm text-white/55">Show rep names as &ldquo;Rep 1&rdquo;, &ldquo;Rep 2&rdquo; etc.</p>
              </div>
              <Switch checked={leaderboardMode} onCheckedChange={setLeaderboardMode} />
            </div>
            <Separator />
            <div>
              <Label>Monthly Revenue Target ($)</Label>
              <Input type="number" value={monthlyTarget} onChange={(e) => setMonthlyTarget(e.target.value)} className="w-48 mt-1" />
            </div>
            <Button onClick={handleSaveGeneral} disabled={saving}>
              <Save className="h-4 w-4 mr-2" /> {saving ? "Saving..." : "Save Settings"}
            </Button>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="benchmarks">
        <Card>
          <CardHeader><CardTitle>Setter Benchmarks (Weekly)</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { key: "setter_weekly_dials_target", label: "Dials" },
                { key: "setter_weekly_conversations_target", label: "Conversations" },
                { key: "setter_weekly_bookings_target", label: "Bookings" },
                { key: "setter_contact_rate_target", label: "Contact Rate (%)" },
                { key: "setter_book_rate_target", label: "Book Rate (%)" },
                { key: "setter_intro_demo_rate_target", label: "Intro→Demo Rate (%)" },
              ].map((b) => (
                <div key={b.key}>
                  <Label>{b.label}</Label>
                  <Input type="number" value={benchmarks[b.key as keyof typeof benchmarks]} onChange={(e) => setBenchmarks({ ...benchmarks, [b.key]: e.target.value })} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="mt-4">
          <CardHeader><CardTitle>Closer Benchmarks (Weekly)</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { key: "closer_weekly_demos_target", label: "Demos" },
                { key: "closer_weekly_cash_target", label: "Cash Target ($)" },
                { key: "closer_close_rate_target", label: "Close Rate (%)" },
                { key: "closer_offer_rate_target", label: "Offer Rate (%)" },
                { key: "closer_avg_deal_size_target", label: "Avg Deal Size ($)" },
              ].map((b) => (
                <div key={b.key}>
                  <Label>{b.label}</Label>
                  <Input type="number" value={benchmarks[b.key as keyof typeof benchmarks]} onChange={(e) => setBenchmarks({ ...benchmarks, [b.key]: e.target.value })} />
                </div>
              ))}
            </div>
            <Button className="mt-4" onClick={handleSaveBenchmarks} disabled={saving}>
              <Save className="h-4 w-4 mr-2" /> {saving ? "Saving..." : "Save Benchmarks"}
            </Button>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="rates">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Commission Rate Tiers</CardTitle>
              <Button size="sm" onClick={openAddRate}><Plus className="h-4 w-4 mr-1" /> Add Tier</Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>PIF Bonus</TableHead>
                  <TableHead>Min Close Rate</TableHead>
                  <TableHead>Effective Date</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commissionRates.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell><Badge variant={r.role === "setter" ? "default" : "secondary"}>{r.role}</Badge></TableCell>
                    <TableCell>{r.label}</TableCell>
                    <TableCell>{(r.rate * 100).toFixed(1)}%</TableCell>
                    <TableCell>{((r.pif_bonus_rate || 0) * 100).toFixed(1)}%</TableCell>
                    <TableCell>{r.min_close_rate ? `${(r.min_close_rate * 100).toFixed(0)}%` : "—"}</TableCell>
                    <TableCell>{r.effective_date}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => openEditRate(r)}><Pencil className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Rate Dialog */}
      <Dialog open={rateDialogOpen} onOpenChange={setRateDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingRate ? "Edit" : "Add"} Commission Rate</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Role</Label>
              <Select value={rateForm.role} onValueChange={(v) => setRateForm({ ...rateForm, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="setter">Setter</SelectItem>
                  <SelectItem value="closer">Closer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Label</Label>
              <Input value={rateForm.label} onChange={(e) => setRateForm({ ...rateForm, label: e.target.value })} placeholder="e.g., Base, 30%+ close rate" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Rate (%)</Label>
                <Input type="number" step="0.1" value={rateForm.rate} onChange={(e) => setRateForm({ ...rateForm, rate: e.target.value })} />
              </div>
              <div>
                <Label>PIF Bonus (%)</Label>
                <Input type="number" step="0.1" value={rateForm.pif_bonus_rate} onChange={(e) => setRateForm({ ...rateForm, pif_bonus_rate: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Min Close Rate (%)</Label>
                <Input type="number" step="1" value={rateForm.min_close_rate} onChange={(e) => setRateForm({ ...rateForm, min_close_rate: e.target.value })} placeholder="Optional" />
              </div>
              <div>
                <Label>Effective Date</Label>
                <Input type="date" value={rateForm.effective_date} onChange={(e) => setRateForm({ ...rateForm, effective_date: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveRate} disabled={saving || !rateForm.label || !rateForm.rate}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Tabs>
  )
}
