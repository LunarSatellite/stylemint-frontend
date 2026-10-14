import { describe, expect, it } from 'vitest';
import { embedUrlOf } from './ReelPlayer';

const reel = (sourcePlatform: number, sourceUrl: string, externalId = '') => ({ sourcePlatform, sourceUrl, externalId });

describe('embedUrlOf', () => {
  it('embeds YouTube Shorts with the privacy-enhanced player', () => {
    expect(embedUrlOf(reel(3, 'https://www.youtube.com/shorts/abcDEF12345'))).toBe(
      'https://www.youtube-nocookie.com/embed/abcDEF12345?playsinline=1&rel=0',
    );
    expect(embedUrlOf(reel(3, 'https://youtu.be/abcDEF12345'))).toContain('/embed/abcDEF12345');
  });
  it('embeds TikTok by video id', () => {
    expect(embedUrlOf(reel(2, 'https://www.tiktok.com/@me/video/7301234567890123456'))).toBe(
      'https://www.tiktok.com/player/v1/7301234567890123456?rel=0',
    );
  });
  it('embeds Instagram reels and posts by shortcode', () => {
    expect(embedUrlOf(reel(1, 'https://www.instagram.com/reel/C1a2B3c4D5e/'))).toBe('https://www.instagram.com/reel/C1a2B3c4D5e/embed/');
    expect(embedUrlOf(reel(1, 'https://instagram.com/p/C1a2B3c4D5e'))).toContain('/C1a2B3c4D5e/embed/');
  });
  it('embeds Facebook through the video plugin', () => {
    expect(embedUrlOf(reel(4, 'https://www.facebook.com/reel/123456789'))).toContain('plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2Freel%2F123456789');
  });
  it('returns null for links it cannot read', () => {
    expect(embedUrlOf(reel(1, 'not a url'))).toBeNull();
    expect(embedUrlOf(reel(2, 'https://www.tiktok.com/@me'))).toBeNull();
  });
});
