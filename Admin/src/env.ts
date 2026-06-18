export const env = {
  apiBaseUrl:     import.meta.env.VITE_API_BASE_URL     as string,
  // SSO vars are optional — only needed when clicking "Sign in with SSO"
  ssoAuthority:   import.meta.env.VITE_SSO_AUTHORITY    as string | undefined,
  ssoClientId:    import.meta.env.VITE_SSO_CLIENT_ID    as string | undefined,
  ssoRedirectUri: import.meta.env.VITE_SSO_REDIRECT_URI as string | undefined,
}

if (env.apiBaseUrl === undefined) throw new Error('Missing env variable: VITE_API_BASE_URL')
