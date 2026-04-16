export const GHL_CONFIG = {
  baseUrl: "https://services.leadconnectorhq.com",
  apiVersion: "2021-07-28",
  pipelineId: "naAeSXlFlM03Hq3v1hIk",
  customFields: {
    studentName: "FKCO39QPqjh9uCAl50at",
    currentSatScore: "GmiUilvdg8NHzFQhA7K1",
    targetSatScore: "oT7nyr4iL3X5sIbGY1AG",
    purchasePrice: "ECPPpEzJpjmRkfGJ68Uu",
    amountPaid: "QgbNOTl9lUAcBc6En7tg",
    paymentMethod: "tCRm1ZjucADg9MKk72di",
    closerName: "1jF87kf6iPR9LdeHi6YA",
  },
  webhookEvents: [
    "ContactCreate",
    "OpportunityStageUpdate",
    "AppointmentCreate",
  ] as const,
} as const

export function getGhlApiKey(): string {
  const key = process.env.GHL_API_KEY
  if (!key) throw new Error("GHL_API_KEY environment variable is not set")
  return key
}

export function getGhlLocationId(): string {
  const id = process.env.GHL_LOCATION_ID
  if (!id) throw new Error("GHL_LOCATION_ID environment variable is not set")
  return id
}

export function getGhlWebhookSecret(): string {
  return process.env.GHL_WEBHOOK_SECRET || ""
}
