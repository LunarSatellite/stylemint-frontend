export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL as string,
}

if (!env.apiBaseUrl) throw new Error('Missing env variable: VITE_API_BASE_URL')
