export const env = {
  apiBaseUrl:     import.meta.env.VITE_API_BASE_URL as string,
  ssoAuthority:   import.meta.env.VITE_SSO_AUTHORITY as string,
  ssoClientId:    import.meta.env.VITE_SSO_CLIENT_ID as string,
  ssoRedirectUri: import.meta.env.VITE_SSO_REDIRECT_URI as string,
}


for (const [k, v] of Object.entries(env)) {
  if (!v) throw new Error(`Missing env variable: ${k}`)
}
