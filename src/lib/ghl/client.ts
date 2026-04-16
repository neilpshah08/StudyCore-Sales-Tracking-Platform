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

  const res = await fetch(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${getGhlApiKey()}`,
      Version: GHL_CONFIG.apiVersion,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`GHL API ${method} ${path} failed (${res.status}): ${text}`)
  }

  return res.json()
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
  meta: { total: number; currentPage: number; nextPage: number | null }
}

export async function getContacts(
  startDate?: string,
  endDate?: string,
  limit = 100
): Promise<GhlContact[]> {
  const locationId = getGhlLocationId()
  const params: Record<string, string> = { locationId, limit: String(limit) }
  if (startDate) params.startAfter = new Date(startDate).toISOString()
  if (endDate) params.endAt = new Date(endDate).toISOString()

  const all: GhlContact[] = []
  let page = 1

  while (true) {
    const res = await ghlFetch<ContactsResponse>(
      "/contacts/",
      "GET",
      undefined,
      { ...params, page: String(page) }
    )
    all.push(...res.contacts)
    if (!res.meta.nextPage || all.length >= res.meta.total) break
    page = res.meta.nextPage
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
  const params: Record<string, string> = { locationId, limit: String(limit) }
  if (pipelineId) params.pipelineId = pipelineId
  if (stageId) params.pipelineStageId = stageId

  const all: GhlOpportunity[] = []
  let page = 1

  while (true) {
    const res = await ghlFetch<OpportunitiesResponse>(
      "/opportunities/search",
      "GET",
      undefined,
      { ...params, page: String(page) }
    )
    all.push(...res.opportunities)
    if (!res.meta.nextPage || all.length >= res.meta.total) break
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
  return res.pipelines
}

// --- Calendars / Appointments ---

export interface GhlAppointment {
  id: string
  calendarId: string
  locationId: string
  contactId: string
  title: string
  status: string // "confirmed" | "showed" | "noshow" | "cancelled" | "invalid"
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
  const res = await ghlFetch<AppointmentsResponse>(
    "/calendars/events",
    "GET",
    undefined,
    {
      locationId,
      startTime: new Date(startDate).toISOString(),
      endTime: new Date(endDate).toISOString(),
    }
  )
  return res.events ?? []
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
