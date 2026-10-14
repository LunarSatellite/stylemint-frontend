import { Image, Stack } from '@mantine/core';
import { IconMovie } from '@tabler/icons-react';
import { useEffect, useState, type ReactNode } from 'react';

/**
 * A reel cover served from the source platform's CDN (StyleMint never hosts reel media: the URL is
 * whatever was captured at import — Instagram/Facebook `scontent…cdninstagram.com` / `fbcdn.net`,
 * TikTok `p16-sign…`, `i.ytimg.com`).
 *
 * In a browser those URLs regularly fail where the mobile app's native HTTP client succeeds:
 * - Meta CDN links are signed (`oe=` expiry) and stop working days after import (403);
 * - TikTok's CDN refuses requests carrying a foreign `Referer`;
 * - an `http:` URL (the import validator accepts any absolute http(s) URL) is blocked as mixed
 *   content / by the `img-src https:` CSP.
 * So: no referrer, `http:` upgraded to `https:`, and a placeholder instead of a broken image.
 */
export function safeThumbUrl(url: string | null | undefined): string | null {
  const u = url?.trim();
  if (!u) return null;
  if (u.startsWith('//')) return `https:${u}`;
  if (/^http:\/\//i.test(u)) return `https://${u.slice(7)}`;
  if (/^https:\/\//i.test(u) || u.startsWith('/')) return u;
  return null;
}

export function ReelThumb({ src, alt = '', lazy = true, fallback }: { src: string | null | undefined; alt?: string; lazy?: boolean; fallback?: ReactNode }) {
  const url = safeThumbUrl(src);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  if (!url || failed) {
    return (
      <Stack align="center" justify="center" h="100%" data-testid="reel-thumb-fallback">
        {fallback ?? <IconMovie size={30} opacity={0.4} aria-hidden />}
      </Stack>
    );
  }
  return (
    <Image
      src={url}
      alt={alt}
      h="100%"
      w="100%"
      fit="cover"
      loading={lazy ? 'lazy' : undefined}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
