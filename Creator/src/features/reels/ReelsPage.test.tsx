import { fireEvent, screen, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { __resetSessionForTests } from '../../auth/session';
import { mockApi, renderWithProviders } from '../../test/utils';
import ReelsPage from './ReelsPage';

/** A ReelDto exactly as StyleMint.Modules.Reels serialises it (camelCase, enums as ints). */
function wireReel(extra: Record<string, unknown> = {}) {
  return {
    id: '3f0c2a8e-1b7d-4c55-9a1e-0d9b7c6f1a01',
    creatorAccountId: '9b1d7a40-5e2c-4f1a-8b3d-6c0e2f7a9d11',
    sourcePlatform: 1,
    sourceUrl: 'https://www.instagram.com/reel/DAbc123xyz/',
    externalId: 'DAbc123xyz',
    durationSeconds: 27,
    musicTrackTitle: null,
    musicArtistName: null,
    musicProviderUrl: null,
    caption: 'Dashain look',
    thumbnailCdnUrl: 'https://scontent-del1-1.cdninstagram.com/v/t51.29350-15/1_n.jpg?oe=66F00000',
    videoCdnUrl: null,
    isAiGenerated: null,
    state: 3,
    publishedAtUtc: '2026-10-10T10:00:00+00:00',
    viewsSnapshot: 120,
    likesSnapshot: 9,
    styleMintLikeCount: 1,
    likeCount: 10,
    styleMintViewCount: 80,
    viewCount: 200,
    saveCount: 3,
    shareCount: 1,
    commentsSnapshot: 0,
    engagementRefreshedAtUtc: null,
    isDropPartyLivePinned: false,
    createdUtc: '2026-10-10T09:00:00+00:00',
    updatedUtc: '2026-10-10T10:00:00+00:00',
    rowVersion: '12345',
    taggedProducts: [],
    creatorDisplayName: 'Asha',
    creatorAvatarUrl: null,
    creatorAvatarUrls: [],
    isLikedByMe: null,
    isSavedByMe: null,
    ...extra,
  };
}

function page(items: unknown[]) {
  return { items, totalCount: items.length, nextCursor: null, previousCursor: null, pageSize: 48, hasMore: false };
}

const renderList = () => renderWithProviders(<Routes><Route path="/reels" element={<ReelsPage />} /></Routes>, { route: '/reels' });

describe('reels list', () => {
  beforeEach(() => __resetSessionForTests());

  it('lists the creator reels from a real ReelDto page', async () => {
    const calls = mockApi({ 'GET /v1/creator/reels': { body: page([wireReel(), wireReel({ id: 'r2', state: 1, caption: null, thumbnailCdnUrl: null, taggedProducts: null })]) } });
    renderList();
    const grid = await screen.findByTestId('reels-grid');
    expect(within(grid).getByText('Dashain look')).toBeInTheDocument();
    expect(within(grid).getByText('No caption')).toBeInTheDocument();
    expect(calls[0].search).toBe('?pageSize=48');
  });
});

describe('reel covers', () => {
  beforeEach(() => __resetSessionForTests());

  it('loads the CDN cover without a referrer, upgrades http, and falls back when the CDN refuses it', async () => {
    mockApi({
      'GET /v1/creator/reels': {
        body: page([wireReel(), wireReel({ id: 'r2', caption: 'Old one', thumbnailCdnUrl: 'http://p16-sign.tiktokcdn.com/x.jpeg' })]),
      },
    });
    const { container } = renderList();
    await screen.findByTestId('reels-grid');
    const imgs = container.querySelectorAll('img');
    expect(imgs).toHaveLength(2);
    imgs.forEach((i) => expect(i.getAttribute('referrerpolicy')).toBe('no-referrer'));
    expect(imgs[1].getAttribute('src')).toBe('https://p16-sign.tiktokcdn.com/x.jpeg');
    // An expired Meta CDN link (403) must leave a placeholder, not a broken image.
    fireEvent.error(imgs[0]);
    expect(await screen.findByTestId('reel-thumb-fallback')).toBeInTheDocument();
    expect(container.querySelectorAll('img')).toHaveLength(1);
  });
});
