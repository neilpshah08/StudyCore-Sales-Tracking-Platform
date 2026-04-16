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

interface ContactsResponse {
  contacts: GhlContact[]
  meta: { total: number; currentPage: number; nextPage: number | null; nextPageUrl: string | null }
}

export async function getContacts(
  startDate?: string,
  endDate?: string,
  limit = 100
): Promise<GhlContact[]> {
  const locationId = getGhlLocationId()
  const params: Record<string, string> = {
    locationId,
    limit: String(limit),
  }
  // GHL v2 uses startAfter as a Unix timestamp in milliseconds for date filtering
  if (startDate) {
    params.startAfter = String(new Date(startDate).getTime())
  }

  const all: GhlContact[] = []
  let hasMore = true

  while (hasMore) {
    const res = await ghlFetch<ContactsResponse>(
      "/contacts/",
      "GET",
      undefined,
      params
    )
    const contacts = res.contacts ?? []
    all.push(...contacts)

    if (res.meta?.nextPageUrl && contacts.length > 0) {
      // Use the last contact's ID for cursor-based pagination
      params.startAfterId = contacts[contacts.length - 1].id
    } else {
      hasMore = false
    }

    // Filter by endDate client-side since GHL doesn't have an endDate param
    if (endDate) {
      const endTs = new Date(endDate).getTime()
      const filtered = all.filter((c) => new Date(c.dateAdded).getTime() <= endTs)
      if (filtered.length < all.length) {
        return filtered
      }
    }

    if (contacts.length < limit) hasMore = false
  }

  return all
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
  meta: { total: number; currentPage: number; nextPage: number | null }
}

export async function getOpportunities(
  pipelineId?: string,
  stageId?: string,
  limit = 100
): Promise<GhlOpportunity[]> {
  const locationId = getGhlLocationId()
  // GHL v2 opportunities search uses location_id (snake_case)
  const params: Record<string, string> = {
    location_id: locationId,
    limit: String(limit),
  }
  if (pipelineId) params.pipeline_id = pipelineId
  if (stageId) params.pipeline_stage_id = stageId

  const all: GhlOpportunity[] = []
  let page = 1

  while (true) {
    params.page = String(page)
    const res = await ghlFetch<OpportunitiesResponse>(
      "/opportunities/search",
      "GET",
      undefined,
      params
    )
    const opps = res.opportunities ?? []
    all.push(...opps)
    if (!res.meta?.nextPage || opps.length < limit) break
    page = res.meta.nextPage
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

  // GHL v2 requires calendarId, userId, or groupId — fetch all calendars first
  const calendars = await getCalendars()
  if (calendars.length === 0) return []

  const allAppointments: GhlAppointment[] = []

  for (const calendar of calendars) {
    try {
      const res = await ghlFetch<AppointmentsResponse>(
        "/calendars/events",
        "GET",
        undefined,
        {
          locationId,
          calendarId: calendar.id,
          startTime: new Date(startDate).toISOString(),
          endTime: new Date(endDate).toISOString(),
        }
      )
      if (res.events) {
        allAppointments.push(...res.events)
      }
    } catch {
      // Skip calendars that error (e.g., deleted or inaccessible)
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
