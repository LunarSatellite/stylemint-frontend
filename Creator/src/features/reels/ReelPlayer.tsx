import { useState, type ReactNode } from 'react';
import { Anchor, Box, Stack, Text } from '@mantine/core';
import { IconExternalLink, IconPlayerPlay } from '@tabler/icons-react';
import { platformLabel, ReelPlatform } from './api';
import { ReelThumb } from './ReelThumb';

interface PlayableReel {
  sourcePlatform: number;
  sourceUrl: string;
  externalId: string;
  videoCdnUrl: string | null;
  thumbnailCdnUrl: string | null;
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{6,20}$/;
const TIKTOK_ID = /^\d{6,25}$/;
const SHORTCODE = /^[A-Za-z0-9_-]{5,40}$/;

function segmentsOf(url: URL) {
  return url.pathname.split('/').filter(Boolean);
}

function after(segments: string[], marker: string) {
  const i = segments.indexOf(marker);
  return i >= 0 ? segments[i + 1] : undefined;
}

/**
 * The platform's official embed URL for a reel, as the mobile app plays it (`platform_video_id.dart`):
 * YouTube and TikTok always embed; Instagram and Facebook embed when the stored video cannot play.
 */
export function embedUrlOf(r: Pick<PlayableReel, 'sourcePlatform' | 'sourceUrl' | 'externalId'>): string | null {
  let url: URL;
  try {
    url = new URL(r.sourceUrl.trim());
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^www\.|^m\./, '');
  const seg = segmentsOf(url);
  switch (r.sourcePlatform) {
    case ReelPlatform.YouTubeShorts: {
      const id = host === 'youtu.be' ? seg[0] : (url.searchParams.get('v') ?? after(seg, 'shorts') ?? after(seg, 'embed') ?? r.externalId);
      return id && YOUTUBE_ID.test(id) ? `https://www.youtube-nocookie.com/embed/${id}?playsinline=1&rel=0` : null;
    }
    case ReelPlatform.TikTok: {
      const id = after(seg, 'video') ?? after(seg, 'v1') ?? r.externalId;
      return id && TIKTOK_ID.test(id) ? `https://www.tiktok.com/player/v1/${id}?rel=0` : null;
    }
    case ReelPlatform.Instagram: {
      const code = after(seg, 'reel') ?? after(seg, 'reels') ?? after(seg, 'p') ?? after(seg, 'tv');
      return code && SHORTCODE.test(code) ? `https://www.instagram.com/reel/${code}/embed/` : null;
    }
    case ReelPlatform.Facebook:
      return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(r.sourceUrl)}&show_text=false`;
    default:
      return null;
  }
}

/**
 * Plays an imported reel. Instagram first tries the stored Meta CDN video (signed links expire, so a
 * failure falls back to the official embed); TikTok and YouTube always use their embed player. If nothing can
 * play, the cover stays with a link to the original post.
 */
export function ReelPlayer({ reel, fallback }: { reel: PlayableReel; fallback?: ReactNode }) {
  const embed = embedUrlOf(reel);
  // As the app (reel_playback_resolver.dart): only Instagram plays the stored video; Facebook, TikTok and YouTube embed.
  const meta = reel.sourcePlatform === ReelPlatform.Instagram;
  const [mode, setMode] = useState<'video' | 'embed' | 'none'>(meta && reel.videoCdnUrl ? 'video' : embed ? 'embed' : 'none');
  const label = platformLabel[reel.sourcePlatform] ?? 'the platform';

  if (mode === 'video' && reel.videoCdnUrl)
    return (
      <video
        key={reel.videoCdnUrl}
        src={reel.videoCdnUrl}
        poster={reel.thumbnailCdnUrl ?? undefined}
        controls
        playsInline
        preload="metadata"
        style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000', display: 'block' }}
        onError={() => setMode(embed ? 'embed' : 'none')}
        aria-label="Reel video"
      />
    );

  if (mode === 'embed' && embed)
    return (
      <iframe
        src={embed}
        title={`Reel on ${label}`}
        style={{ width: '100%', height: '100%', border: 0, display: 'block', background: '#000' }}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        loading="lazy"
      />
    );

  return (
    <Box pos="relative" h="100%">
      <ReelThumb src={reel.thumbnailCdnUrl} alt="Reel cover" lazy={false} fallback={fallback} />
      <Stack pos="absolute" inset={0} align="center" justify="center" gap={6} style={{ background: 'rgba(0,0,0,0.35)' }}>
        <IconPlayerPlay size={32} color="white" aria-hidden />
        <Text size="sm" c="white" ta="center" px="sm">
          This reel can't play here.
        </Text>
        <Anchor href={reel.sourceUrl} target="_blank" rel="noopener noreferrer" size="sm" c="white" fw={600}>
          Watch on {label} <IconExternalLink size={12} />
        </Anchor>
      </Stack>
    </Box>
  );
}
