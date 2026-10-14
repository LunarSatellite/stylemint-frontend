import { useState } from 'react';
import { Divider, Stack } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { establish } from '../../auth/session';
import { fetchSocialConfig, PROVIDER_NAME, socialError, socialSignIn, type SocialProvider, type SocialToken } from '../../auth/social';
import { AppleSignInButton, FacebookSignInButton, GoogleSignInButton, type ProviderProblem } from './ProviderButtons';

export const SOCIAL_CONFIG_KEY = ['social-web-config'] as const;

function problemText(provider: SocialProvider, problem: ProviderProblem): { kind: 'error' | 'info'; text: string } {
  const name = PROVIDER_NAME[provider];
  switch (problem) {
    case 'cancelled':
      return { kind: 'info', text: `${name} sign-in was cancelled — the window was closed before it finished. Nothing changed; try again whenever you are ready.` };
    case 'declinedEmail':
      return {
        kind: 'error',
        text: 'Creator Studio needs the email address on your Facebook account to find your creator account. Try again and allow access to your email, or sign in with the phone number or email of your StyleMint account.',
      };
    default:
      return { kind: 'error', text: `${name} sign-in did not finish. Please try again.` };
  }
}

/**
 * "Continue with Google / Apple / Facebook" above the email/phone form, for the providers the server reports as
 * web-ready. Nothing renders (and no provider script loads) for a provider without a public id, or when the
 * web-config endpoint is missing.
 */
export function SocialSignIn({
  remember,
  disabled,
  onStart,
  onError,
  onInfo,
  onBusyChange,
}: {
  remember: boolean;
  disabled: boolean;
  onStart: () => void;
  onError: (message: string) => void;
  onInfo: (message: string) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const config = useQuery({
    queryKey: SOCIAL_CONFIG_KEY,
    queryFn: ({ signal }) => fetchSocialConfig(signal),
    staleTime: 5 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const [busy, setBusy] = useState<SocialProvider | null>(null);

  const cfg = config.data;
  if (!cfg || (!cfg.google && !cfg.apple && !cfg.facebook)) return null;

  const signIn = async (provider: SocialProvider, token: SocialToken) => {
    onStart();
    setBusy(provider);
    onBusyChange(true);
    try {
      const res = await socialSignIn(provider, token);
      // No forced "create your password" step: the provider is the credential. The route gate takes over from here
      // (Creator Studio, or the application / "not a creator account" screen).
      await establish(res, { remember, checkPassword: false, method: provider });
    } catch (e) {
      onError(socialError(e, provider));
    } finally {
      setBusy(null);
      onBusyChange(false);
    }
  };

  const problem = (provider: SocialProvider) => (p: ProviderProblem) => {
    onStart();
    const { kind, text } = problemText(provider, p);
    if (kind === 'info') onInfo(text);
    else onError(text);
  };

  const locked = disabled || busy !== null;

  return (
    <Stack gap="sm" data-testid="social-sign-in">
      {cfg.google && (
        <GoogleSignInButton clientId={cfg.google.clientId} onToken={(t) => void signIn('google', t)} busy={busy === 'google'} disabled={locked} />
      )}
      {cfg.apple && (
        <AppleSignInButton
          servicesId={cfg.apple.servicesId}
          redirectUri={cfg.apple.redirectUri}
          onToken={(t) => void signIn('apple', t)}
          onProblem={problem('apple')}
          busy={busy === 'apple'}
          disabled={locked && busy !== 'apple'}
        />
      )}
      {cfg.facebook && (
        <FacebookSignInButton
          appId={cfg.facebook.appId}
          graphVersion={cfg.facebook.graphVersion}
          onToken={(t) => void signIn('facebook', t)}
          onProblem={problem('facebook')}
          busy={busy === 'facebook'}
          disabled={locked && busy !== 'facebook'}
        />
      )}
      <Divider label="or" labelPosition="center" mt={4} />
    </Stack>
  );
}
