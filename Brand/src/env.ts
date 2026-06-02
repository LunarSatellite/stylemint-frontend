/// <reference types="vite/client" />

export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL as string,
}

for (const [k, v] of Object.entries(env)) {
  if (!v) throw new Error(`Missing env variable: ${k}`)
}
