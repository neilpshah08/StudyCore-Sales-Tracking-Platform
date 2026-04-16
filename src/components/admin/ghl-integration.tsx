"use client"

import { useState, useEffect, useCallback } from "react"
import { cn, formatDate } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  RefreshCw, CheckCircle2, XCircle, AlertTriangle, Webhook,
  Plug, Clock, Zap, Globe, Loader2, Trash2,
} from "lucide-react"

interface GhlStatus {
  configured: boolean
  connected: boolean
  locationName?: string
  error?: string
  webhooks: { id: string; name: string; url: string; events: string[]; active: boolean }[]
  syncTimes: Record<string, string | null>
}

interface SyncResult {
  contactsAdded: number
  appointmentsProcessed: number
  dealsCreated: number
  lostDealsLogged: number
  errors: string[]
}

export function GhlIntegrationPage() {
  const { toast } = useToast()
  const [status, setStatus] = useState<GhlStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [registeringWebhook, setRegisteringWebhook] = useState(false)
  const [webhookUrl, setWebhookUrl] = useState("")

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/ghl/status")
      if (res.ok) {
        const data = await res.json()
        setStatus(data)
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  async function handleSync() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch("/api/admin/ghl/sync", { method: "POST" })
      const data = await res.json()
      if (res.ok) {
        setSyncResult(data)
        toast({ title: "Sync completed", variant: "default" })
        fetchStatus()
      } else {
        toast({ title: data.error || "Sync failed", variant: "destructive" })
      }
    } catch {
      toast({ title: "Sync failed", variant: "destructive" })
    } finally {
      setSyncing(false)
    }
  }

  async function handleRegisterWebhook() {
    if (!webhookUrl) return
    setRegisteringWebhook(true)
    try {
      const res = await fetch("/api/admin/ghl/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl }),
      })
      const data = await res.json()
      if (res.ok) {
        toast({ title: "Webhook registered" })
        setWebhookUrl("")
        fetchStatus()
      } else {
        toast({ title: data.error || "Failed to register", variant: "destructive" })
      }
    } catch {
      toast({ title: "Failed to register webhook", variant: "destructive" })
    } finally {
      setRegisteringWebhook(false)
    }
  }

  async function handleDeleteWebhook(webhookId: string) {
    try {
      const res = await fetch("/api/admin/ghl/webhooks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookId }),
      })
      if (res.ok) {
        toast({ title: "Webhook removed" })
        fetchStatus()
      }
    } catch {
      toast({ title: "Failed to remove webhook", variant: "destructive" })
    }
  }

  function formatSyncTime(isoString: string | null): string {
    if (!isoString) return "Never"
    const date = new Date(isoString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMin = Math.floor(diffMs / 60000)

    if (diffMin < 1) return "Just now"
    if (diffMin < 60) return `${diffMin}m ago`
    if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`
    return date.toLocaleString("en-US", {
      timeZone: "America/Los_Angeles",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Plug className="h-5 w-5" />
              GoHighLevel Connection
            </CardTitle>
            <Badge
              variant={status?.connected ? "success" : status?.configured ? "warning" : "destructive"}
            >
              {status?.connected ? "Connected" : status?.configured ? "Disconnected" : "Not Configured"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {status?.connected ? (
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-green-800">Connected to GHL</p>
                {status.locationName && (
                  <p className="text-sm text-green-700">Location: {status.locationName}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
              <XCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-red-800">
                  {status?.configured ? "Connection Failed" : "Not Configured"}
                </p>
                {status?.error && (
                  <p className="text-sm text-red-700">{status.error}</p>
                )}
              </div>
            </div>
          )}

          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium">Environment Variables</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                {status?.configured ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                <code className="text-xs">GHL_API_KEY</code>
              </div>
              <div className="flex items-center gap-2">
                {status?.configured ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                <code className="text-xs">GHL_LOCATION_ID</code>
              </div>
            </div>
            {!status?.configured && (
              <p className="text-xs text-muted-foreground mt-2">
                Set <code>GHL_API_KEY</code> and <code>GHL_LOCATION_ID</code> in your .env.local file or Vercel environment variables.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sync Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Sync Status
            </CardTitle>
            <Button
              onClick={handleSync}
              disabled={syncing || !status?.connected}
              size="sm"
            >
              {syncing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Syncing...</>
              ) : (
                <><RefreshCw className="h-4 w-4 mr-2" /> Sync Now</>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { label: "Last Full Sync", key: "ghl_last_full_sync", icon: RefreshCw },
              { label: "Last Contact Sync", key: "ghl_last_contact_sync", icon: Globe },
              { label: "Last Appointment Sync", key: "ghl_last_appointment_sync", icon: Clock },
              { label: "Last Opportunity Sync", key: "ghl_last_opportunity_sync", icon: Zap },
              { label: "Last Webhook Event", key: "ghl_last_webhook_received", icon: Webhook },
            ].map(({ label, key, icon: Icon }) => (
              <div key={key} className="border rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
                <p className={cn("text-sm font-medium", !status?.syncTimes?.[key] && "text-muted-foreground")}>
                  {formatSyncTime(status?.syncTimes?.[key] ?? null)}
                </p>
              </div>
            ))}
          </div>

          {/* Sync Result */}
          {syncResult && (
            <>
              <Separator />
              <div className="bg-blue-50 rounded-lg p-4 space-y-2">
                <p className="font-medium text-blue-800">Last Sync Result</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-blue-600">Contacts</p>
                    <p className="font-bold text-lg">{syncResult.contactsAdded}</p>
                  </div>
                  <div>
                    <p className="text-blue-600">Appointments</p>
                    <p className="font-bold text-lg">{syncResult.appointmentsProcessed}</p>
                  </div>
                  <div>
                    <p className="text-blue-600">Deals Created</p>
                    <p className="font-bold text-lg text-green-600">{syncResult.dealsCreated}</p>
                  </div>
                  <div>
                    <p className="text-blue-600">Lost Deals</p>
                    <p className="font-bold text-lg text-red-600">{syncResult.lostDealsLogged}</p>
                  </div>
                </div>
                {syncResult.errors.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {syncResult.errors.map((e, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-red-600">
                        <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span>{e}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Webhooks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Webhook Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Webhooks receive real-time events from GHL (contact created, opportunity stage changed, appointment status).
            Enter your app&apos;s public URL to register the webhook endpoint.
          </p>

          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                placeholder="https://your-app.vercel.app/api/webhooks/ghl"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
              />
            </div>
            <Button
              onClick={handleRegisterWebhook}
              disabled={registeringWebhook || !webhookUrl || !status?.connected}
            >
              {registeringWebhook ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Register Webhook"
              )}
            </Button>
          </div>

          {/* Existing Webhooks */}
          {status?.webhooks && status.webhooks.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Events</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {status.webhooks.map((wh) => (
                  <TableRow key={wh.id}>
                    <TableCell className="font-medium">{wh.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {wh.url}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {wh.events.map((e) => (
                          <Badge key={e} variant="outline" className="text-xs">
                            {e}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={wh.active ? "success" : "secondary"}>
                        {wh.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => wh.id && handleDeleteWebhook(wh.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {(!status?.webhooks || status.webhooks.length === 0) && (
            <div className="border border-dashed rounded-lg p-6 text-center text-muted-foreground">
              <Webhook className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No webhooks registered yet</p>
              <p className="text-xs mt-1">Register a webhook to receive real-time events from GHL</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Custom Field Mapping Reference */}
      <Card>
        <CardHeader>
          <CardTitle>Custom Field Mapping</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            These GHL custom fields are used to extract deal data when opportunities close.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Field</TableHead>
                <TableHead>GHL Field ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { label: "Student Name", id: "FKCO39QPqjh9uCAl50at" },
                { label: "Current SAT Score", id: "GmiUilvdg8NHzFQhA7K1" },
                { label: "Target SAT Score", id: "oT7nyr4iL3X5sIbGY1AG" },
                { label: "Purchase Price", id: "ECPPpEzJpjmRkfGJ68Uu" },
                { label: "Amount Paid", id: "QgbNOTl9lUAcBc6En7tg" },
                { label: "Payment Method", id: "tCRm1ZjucADg9MKk72di" },
                { label: "Closer Name", id: "1jF87kf6iPR9LdeHi6YA" },
              ].map(({ label, id }) => (
                <TableRow key={id}>
                  <TableCell className="font-medium">{label}</TableCell>
                  <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{id}</code></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
