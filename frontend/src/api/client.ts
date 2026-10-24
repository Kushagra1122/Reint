const configuredBase = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '')
const API_BASE = configuredBase || ''

export async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { headers: { Accept: 'application/json' } })
  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: response.statusText }))
    throw new Error(body.detail || `Request failed (${response.status})`)
  }
  return response.json() as Promise<T>
}

export function query(params: Record<string, string>) {
  return new URLSearchParams(params).toString()
}

