import { GHL_CONFIG, getGhlApiKey, getGhlLocationId } from "./config"

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE"

async function ghlFetch<T>(
  path: string,
  method: HttpMethod = "GET",
  body?: unknown,
  params?: Record<string, string>
): Promise<T> {
  const url = new URL(`${GHL_CONFIG.baseUrl}${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v)
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${getGhlApiKey()}`,
    Version: GHL_CONFIG.apiVersion,
    Accept: "application/json",
  }
  if (body) headers["Content-Type"] = "application/json"

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`GHL API ${method} ${path} failed (${res.status}): ${text}`)
  }

  const text = await res.text()
  if (!text) return {} as T
  return JSON.parse(text)
}

// --- Contacts ---

export interface GhlContact {
  id: string
  locationId: string
  firstName: string
  lastName: string
  name: string
  email: string
  phone: string
  dateAdded: string
  customFields: { id: string; value: unknown }[]
  tags: string[]
  source: string
}

interface ContactsSearchResponse {
  contacts: GhlContact[]
  total: number
}

// Use POST /contacts/search which supports date filtering
export async function getContacts(
  startDate?: string,
  endDate?: string,
  limit = 100
): Promise<GhlContact[]> {
  const locationId = getGhlLocationId()

  const filters: Record<string, unknown>[] = []
  if (startDate) {
    filters.push({
      field: "dateAdded",
      operator: "after",
      value: new Date(startDate).toISOString(),
    })
  }
  if (endDate) {
    filters.push({
      field: "dateAdded",
      operator: "before",
      value: new Date(endDate).toISOString(),
    })
  }

  const all: GhlContact[] = []
  let page = 1

  while (true) {
    const body: Record<string, unknown> = {
      locationId,
      page,
      pageLimit: limit,
    }
    if (filters.length > 0) {
      body.filters = filters
    }

    try {
      const res = await ghlFetch<ContactsSearchResponse>(
        "/contacts/search",
        "POST",
        body
      )
      const contacts = res.contacts ?? []
      all.push(...contacts)
      if (contacts.length < limit || all.length >= (res.total || 0)) break
      page++
    } catch (err) {
      // If search endpoint fails, fall back to simple list
      if (page === 1) {
        return await getContactsFallback(limit)
      }
      break
    }
  }

  return all
}

// Fallback: simple GET /contacts/ without date filtering
async function getContactsFallback(limit = 100): Promise<GhlContact[]> {
  const locationId = getGhlLocationId()
  const res = await ghlFetch<{ contacts: GhlContact[]; meta?: { total: number } }>(
    "/contacts/",
    "GET",
    undefined,
    { locationId, limit: String(limit) }
  )
  return res.contacts ?? []
}

export async function getContact(contactId: string): Promise<GhlContact> {
  const res = await ghlFetch<{ contact: GhlContact }>(
    `/contacts/${contactId}`
  )
  return res.contact
}

// --- Opportunities (Pipeline) ---

export interface GhlOpportunity {
  id: string
  name: string
  monetaryValue: number
  pipelineId: string
  pipelineStageId: string
  status: string
  contact: { id: string; name: string; email: string }
  assignedTo: string
  customFields: { id: string; key: string; value: unknown }[]
  createdAt: string
  updatedAt: string
}

interface OpportunitiesResponse {
  opportunities: GhlOpportunity[]
  meta?: { total: number; currentPage: number; nextPage: number | null }
}

export async function getOpportunities(
  pipelineId?: string,
  stageId?: string,
  limit = 100
): Promise<GhlOpportunity[]> {
  const locationId = getGhlLocationId()

  // Try POST /opportunities/search first (newer API)
  try {
    const body: Record<string, unknown> = {
      location_id: locationId,
      pipeline_id: pipelineId || GHL_CONFIG.pipelineId,
    }
    if (stageId) body.pipeline_stage_id = stageId

    const res = await ghlFetch<OpportunitiesResponse>(
      "/opportunities/search",
      "POST",
      body
    )
    return res.opportunities ?? []
  } catch {
    // Fall back to GET /opportunities/ with query params
  }

  // Fallback: GET with query params
  const params: Record<string, string> = {
    locationId,
    limit: String(limit),
  }
  if (pipelineId) params.pipelineId = pipelineId

  const all: GhlOpportunity[] = []
  let page = 1

  while (true) {
    params.page = String(page)

    try {
      const res = await ghlFetch<OpportunitiesResponse>(
        "/opportunities/",
        "GET",
        undefined,
        params
      )
      const opps = res.opportunities ?? []
      all.push(...opps)
      if (!res.meta?.nextPage || opps.length < limit) break
      page = res.meta.nextPage
    } catch {
      break
    }
  }

  return all
}

export async function getOpportunity(id: string): Promise<GhlOpportunity> {
  const res = await ghlFetch<{ opportunity: GhlOpportunity }>(
    `/opportunities/${id}`
  )
  return res.opportunity
}

// --- Pipeline stages ---

export interface GhlPipelineStage {
  id: string
  name: string
  position: number
}

export interface GhlPipeline {
  id: string
  name: string
  stages: GhlPipelineStage[]
}

export async function getPipelines(): Promise<GhlPipeline[]> {
  const locationId = getGhlLocationId()
  const res = await ghlFetch<{ pipelines: GhlPipeline[] }>(
    "/opportunities/pipelines",
    "GET",
    undefined,
    { locationId }
  )
  return res.pipelines ?? []
}

// --- Calendars ---

export interface GhlCalendar {
  id: string
  locationId: string
  name: string
}

interface CalendarsResponse {
  calendars: GhlCalendar[]
}

export async function getCalendars(): Promise<GhlCalendar[]> {
  const locationId = getGhlLocationId()
  const res = await ghlFetch<CalendarsResponse>(
    "/calendars/",
    "GET",
    undefined,
    { locationId }
  )
  return res.calendars ?? []
}

// --- Appointments ---

export interface GhlAppointment {
  id: string
  calendarId: string
  locationId: string
  contactId: string
  title: string
  status: string
  appointmentStatus: string
  assignedUserId: string
  startTime: string
  endTime: string
  dateAdded: string
}

interface AppointmentsResponse {
  events: GhlAppointment[]
}

export async function getAppointments(
  startDate: string,
  endDate: string
): Promise<GhlAppointment[]> {
  const locationId = getGhlLocationId()
  const allAppointments: GhlAppointment[] = []

  // GHL v2 requires calendarId — fetch all calendars first, then events per calendar
  let calendars: GhlCalendar[] = []
  try {
    calendars = await getCalendars()
  } catch {
    // If calendars listing fails, return empty
    return []
  }

  if (calendars.length === 0) return []

  const startTime = new Date(startDate).toISOString()
  const endTime = new Date(endDate).toISOString()

  for (const calendar of calendars) {
    try {
      const res = await ghlFetch<AppointmentsResponse>(
        `/calendars/events`,
        "GET",
        undefined,
        {
          locationId,
          calendarId: calendar.id,
          startTime,
          endTime,
        }
      )
      if (res.events) {
        allAppointments.push(...res.events)
      }
    } catch {
      // Skip individual calendar errors
    }
  }

  return allAppointments
}

// --- Webhooks ---

export interface GhlWebhook {
  id?: string
  name: string
  url: string
  events: string[]
  active: boolean
}

export async function listWebhooks(): Promise<GhlWebhook[]> {
  const locationId = getGhlLocationId()
  const res = await ghlFetch<{ webhooks: GhlWebhook[] }>(
    "/webhooks/",
    "GET",
    undefined,
    { locationId }
  )
  return res.webhooks ?? []
}

export async function createWebhook(
  url: string,
  events: string[]
): Promise<GhlWebhook> {
  const locationId = getGhlLocationId()
  return ghlFetch<GhlWebhook>("/webhooks/", "POST", {
    locationId,
    name: "StudyCore Sales Tracker",
    url,
    events,
    active: true,
  })
}

export async function deleteWebhook(webhookId: string): Promise<void> {
  await ghlFetch<unknown>(`/webhooks/${webhookId}`, "DELETE")
}

// --- Users (GHL sub-accounts) ---

export interface GhlUser {
  id: string
  name: string
  email: string
  firstName: string
  lastName: string
}

export async function getGhlUsers(): Promise<GhlUser[]> {
  const locationId = getGhlLocationId()
  const res = await ghlFetch<{ users: GhlUser[] }>(
    "/users/",
    "GET",
    undefined,
    { locationId }
  )
  return res.users ?? []
}

// --- Health check ---

export async function checkConnection(): Promise<{
  connected: boolean
  error?: string
  locationName?: string
}> {
  try {
    const locationId = getGhlLocationId()
    const res = await ghlFetch<{ location: { name: string } }>(
      `/locations/${locationId}`
    )
    return { connected: true, locationName: res.location?.name }
  } catch (err) {
    return {
      connected: false,
      error: err instanceof Error ? err.message : "Unknown error",
    }
  }
}

// --- Helper: extract custom field value ---

export function getCustomFieldValue(
  fields: { id: string; value: unknown }[],
  fieldId: string
): string | null {
  const field = fields?.find((f) => f.id === fieldId)
  if (!field || field.value === null || field.value === undefined) return null
  return String(field.value)
}

// --- Diagnostic: test each endpoint individually ---

export async function testEndpoints(): Promise<Record<string, { ok: boolean; error?: string; data?: unknown }>> {
  const results: Record<string, { ok: boolean; error?: string; data?: unknown }> = {}

  // Test location
  try {
    const loc = await checkConnection()
    results.location = { ok: loc.connected, error: loc.error, data: { name: loc.locationName } }
  } catch (err) {
    results.location = { ok: false, error: err instanceof Error ? err.message : String(err) }
  }

  // Test contacts
  try {
    const contacts = await getContactsFallback(1)
    results.contacts = { ok: true, data: { count: contacts.length } }
  } catch (err) {
    results.contacts = { ok: false, error: err instanceof Error ? err.message : String(err) }
  }

  // Test calendars
  try {
    const cals = await getCalendars()
    results.calendars = { ok: true, data: { count: cals.length, ids: cals.map((c) => c.id) } }
  } catch (err) {
    results.calendars = { ok: false, error: err instanceof Error ? err.message : String(err) }
  }

  // Test pipelines
  try {
    const pipes = await getPipelines()
    results.pipelines = { ok: true, data: { count: pipes.length, names: pipes.map((p) => ({ id: p.id, name: p.name, stages: p.stages?.map((s) => ({ id: s.id, name: s.name })) })) } }
  } catch (err) {
    results.pipelines = { ok: false, error: err instanceof Error ? err.message : String(err) }
  }

  // Test users
  try {
    const users = await getGhlUsers()
    results.users = { ok: true, data: { count: users.length, names: users.map((u) => u.name) } }
  } catch (err) {
    results.users = { ok: false, error: err instanceof Error ? err.message : String(err) }
  }

  // Test opportunities (simple GET)
  try {
    const opps = await getOpportunities(GHL_CONFIG.pipelineId, undefined, 5)
    results.opportunities = { ok: true, data: { count: opps.length } }
  } catch (err) {
    results.opportunities = { ok: false, error: err instanceof Error ? err.message : String(err) }
  }

  return results
}
