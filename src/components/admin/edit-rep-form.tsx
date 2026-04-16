"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { cn, formatDate } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AlertTriangle, ArrowLeft, Save, Loader2 } from "lucide-react"
import type { User } from "@/types/database"
import Link from "next/link"

interface Props {
  rep: User
}

export function EditRepForm({ rep }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)

  const [fullName, setFullName] = useState(rep.full_name)
  const [email, setEmail] = useState(rep.email)
  const [role, setRole] = useState(rep.role)
  const [status, setStatus] = useState(rep.status)
  const [commissionRate, setCommissionRate] = useState(
    rep.commission_rate != null ? String(rep.commission_rate * 100) : ""
  )
  const [basePayWeekly, setBasePayWeekly] = useState(
    rep.base_pay_weekly != null ? String(rep.base_pay_weekly) : ""
  )
  const [hireDate, setHireDate] = useState(rep.hire_date || "")
  const [terminationDate, setTerminationDate] = useState(rep.termination_date || "")

  const roleChanged = role !== rep.role
  const originalRole = rep.role

  async function handleSave() {
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        full_name: fullName,
        email,
        role,
        status,
        commission_rate: commissionRate ? parseFloat(commissionRate) / 100 : null,
        base_pay_weekly: basePayWeekly ? parseFloat(basePayWeekly) : null,
        hire_date: hireDate || null,
        termination_date: status === "terminated" || status === "inactive"
          ? terminationDate || new Date().toISOString().split("T")[0]
          : null,
      }

      const res = await fetch(`/api/reps/${rep.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        toast({
          title: "Error saving changes",
          description: data.error || "Something went wrong",
          variant: "destructive",
        })
        setSaving(false)
        return
      }

      toast({ title: "Rep updated successfully" })
      router.push(`/admin/reps/${rep.id}`)
      router.refresh()
    } catch {
      toast({ title: "Error saving changes", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href={`/admin/reps/${rep.id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to {rep.full_name}
      </Link>

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="hireDate">Hire Date</Label>
              <Input
                id="hireDate"
                type="date"
                value={hireDate}
                onChange={(e) => setHireDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Role & Commission */}
      <Card>
        <CardHeader>
          <CardTitle>Role & Commission</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Current Role</Label>
              <div className="flex items-center gap-2">
                <Badge variant={rep.role === "setter" ? "default" : "secondary"} className="capitalize">
                  {rep.role}
                </Badge>
                <span className="text-sm text-muted-foreground">since {rep.hire_date ? formatDate(rep.hire_date) : "start"}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as "setter" | "closer")}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="setter">Setter</SelectItem>
                  <SelectItem value="closer">Closer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="commissionRate">Commission Rate (%)</Label>
              <Input
                id="commissionRate"
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={commissionRate}
                onChange={(e) => setCommissionRate(e.target.value)}
                placeholder="e.g. 10"
              />
              <p className="text-xs text-muted-foreground">
                Enter as a whole number (e.g. 5 for 5%, 10 for 10%)
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="basePay">Base Pay Weekly ($)</Label>
            <Input
              id="basePay"
              type="number"
              min={0}
              step={0.01}
              value={basePayWeekly}
              onChange={(e) => setBasePayWeekly(e.target.value)}
              placeholder="Optional"
              className="max-w-xs"
            />
          </div>

          {/* Role change warning */}
          {roleChanged && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-amber-800">Role Change: {originalRole} → {role}</p>
                <ul className="mt-1 text-sm text-amber-700 space-y-1">
                  <li>All historical {originalRole} data (activity, deals, commissions) will be preserved.</li>
                  <li>The rep will start fresh on {role} metrics going forward.</li>
                  <li>Their daily activity form will switch to show {role} fields.</li>
                  <li>Leaderboard ranking will move to the {role} board.</li>
                  <li>A role change note will be automatically added to the rep&apos;s record.</li>
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status */}
      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as "active" | "inactive" | "terminated")}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="terminated">Terminated</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(status === "inactive" || status === "terminated") && (
              <div className="space-y-2">
                <Label htmlFor="terminationDate">
                  {status === "terminated" ? "Termination Date" : "Deactivation Date"}
                </Label>
                <Input
                  id="terminationDate"
                  type="date"
                  value={terminationDate}
                  onChange={(e) => setTerminationDate(e.target.value)}
                />
              </div>
            )}
          </div>

          {status !== "active" && (
            <p className="text-sm text-amber-600">
              {status === "terminated"
                ? "Terminated reps cannot log in. Their data will be preserved."
                : "Inactive reps cannot log in. Reactivate them to restore access."}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Link href={`/admin/reps/${rep.id}`}>
          <Button variant="outline">Cancel</Button>
        </Link>
        <Button onClick={handleSave} disabled={saving || !fullName || !email}>
          {saving ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
          ) : (
            <><Save className="h-4 w-4 mr-2" /> Save Changes</>
          )}
        </Button>
      </div>
    </div>
  )
}
