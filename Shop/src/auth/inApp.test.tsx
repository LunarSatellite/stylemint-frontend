import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { createQueryClient, Providers } from '../App';
import SignInPage from '../pages/SignInPage';
import { guestCart } from '../shop/guestCart';
import { mockApi, PRODUCT_ID, product, renderApp, resetShop, VARIANT_L } from '../test/utils';
import { chromeIntentUrl, detectBrowser, withRestoreToken } from './inApp';

const UA = {
  instagramAndroid:
    'Mozilla/5.0 (Linux; Android 13; Pixel 7 Build/TQ3A.230805.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.193 Mobile Safari/537.36 Instagram 312.0.0.32.112 Android (33/13; 420dpi; 1080x2400; Google/google; Pixel 7; panther; panther; en_US; 548323757)',
  instagramIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 312.0.0.22.114 (iPhone14,5; iOS 17_1; en_US; en; scale=3.00; 1170x2532; 548375166)',
  facebookIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBDV/iPhone14,5;FBMD/iPhone;FBSN/iOS;FBSV/17.1;FBSS/3;FBID/phone;FBLC/en_US;FBOP/5]',
  facebookAndroid:
    'Mozilla/5.0 (Linux; Android 14; SM-S911B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.230 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/447.0.0.37.106;]',
  messengerIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/430.0.0.38.109;FBBV/530000000;FBDV/iPhone13,2;FBMD/iPhone;FBSN/iOS;FBSV/16.6]',
  tiktokAndroid:
    'Mozilla/5.0 (Linux; Android 12; SM-A525F Build/SP1A.210812.016; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/119.0.6045.193 Mobile Safari/537.36 trill_320404 JsSdk/1.0 NetType/WIFI Channel/googleplay AppName/musical_ly app_version/32.4.4 ByteLocale/en BytedanceWebview/d8a21c6',
  snapchat: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Snapchat/12.60.0.40 (like Safari/8616.1.1.0.0, panda)',
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  safariIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
};

describe('in-app browser detection', () => {
  it.each([
    ['instagramAndroid', 'instagram', 'android', false],
    ['instagramIos', 'instagram', 'ios', false],
    ['facebookIos', 'facebook', 'ios', true],
    ['facebookAndroid', 'facebook', 'android', true],
    ['messengerIos', 'messenger', 'ios', true],
    ['tiktokAndroid', 'tiktok', 'android', false],
    ['snapchat', 'snapchat', 'ios', false],
  ] as const)('%s → %s on %s', (key, app, os, facebookWorks) => {
    const b = detectBrowser(UA[key]);
    expect(b.inApp).toBe(app);
    expect(b.os).toBe(os);
    expect(b.googleWorks).toBe(false);
    expect(b.facebookWorks).toBe(facebookWorks);
  });

  it('treats real browsers as real browsers', () => {
    expect(detectBrowser(UA.chromeAndroid)).toMatchObject({ inApp: null, os: 'android', googleWorks: true, facebookWorks: true });
    expect(detectBrowser(UA.safariIos)).toMatchObject({ inApp: null, os: 'ios', googleWorks: true });
  });

  it('builds the Android Chrome intent with the restore token and an encoded fallback', () => {
    const url = chromeIntentUrl('https://stylemint.voyageritnepal.com/shop/p/abc?t=1&ref=MAYA&restore=old', 'TOKEN123');
    expect(url).toBe(
      'intent://stylemint.voyageritnepal.com/shop/p/abc?t=1&ref=MAYA&restore=TOKEN123#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=' +
        encodeURIComponent('https://stylemint.voyageritnepal.com/shop/p/abc?t=1&ref=MAYA&restore=TOKEN123') +
        ';end',
    );
    expect(withRestoreToken('https://x.test/shop/cart?restore=a', null)).toBe('https://x.test/shop/cart');
  });
});

function renderSignIn(ua: string) {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  return render(
    <Providers client={client}>
      <MemoryRouter initialEntries={['/signin?next=%2Fcheckout']}>
        <SignInPage browser={detectBrowser(ua)} />
      </MemoryRouter>
    </Providers>,
  );
}

describe('sign-in page inside an in-app browser', () => {
  beforeEach(() => resetShop('signedOut'));

  it('hides Google, offers "Open in Chrome" on Android, keeps phone sign-in', async () => {
    mockApi({ 'GET /v1/auth/oauth/web-config': { body: { google: { clientId: 'g.apps' }, facebook: { appId: '123', graphVersion: 'v21.0' } } } });
    renderSignIn(UA.instagramAndroid);
    expect(await screen.findByText('Open in your browser to sign in with Google')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open in Chrome' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Continue with Google')).not.toBeInTheDocument();
    // Instagram's webview: Facebook sign-in would not work either.
    expect(screen.queryByRole('button', { name: 'Continue with Facebook' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue with phone number' })).toBeInTheDocument();
  });

  it('keeps Facebook inside Facebook; iOS gets instructions and a copy-link with the hand-off token', async () => {
    guestCart.addLine({ productId: PRODUCT_ID, productVariantId: VARIANT_L, quantity: 1 });
    const calls = mockApi({
      'GET /v1/auth/oauth/web-config': { body: { google: { clientId: 'g.apps' }, facebook: { appId: '123', graphVersion: 'v21.0' } } },
      'POST /v1/public/shop/cart-handoff': { body: { token: 'HANDOFF123' } },
    });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    renderSignIn(UA.facebookIos);
    expect(await screen.findByRole('button', { name: 'Continue with Facebook' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Continue with Google')).not.toBeInTheDocument();
    expect(screen.getAllByText(/Open in browser/).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(String(writeText.mock.calls[0][0])).toContain('restore=HANDOFF123');
    const handoff = calls.find((c) => c.path === '/v1/public/shop/cart-handoff');
    expect(handoff?.body).toMatchObject({ lines: [{ productId: PRODUCT_ID, productVariantId: VARIANT_L, quantity: 1 }], bundles: [] });
  });

  it('copy-link still works when the hand-off endpoint is not deployed (bare 404)', async () => {
    mockApi({});
    guestCart.addLine({ productId: PRODUCT_ID, quantity: 1 });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    renderSignIn(UA.instagramIos);
    await userEvent.click(await screen.findByRole('button', { name: 'Copy link' }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(String(writeText.mock.calls[0][0])).not.toContain('restore=');
  });
});

describe('cart hand-off restore', () => {
  beforeEach(() => resetShop('signedOut'));

  it('redeems ?restore= into the guest cart once and drops it from the URL', async () => {
    const calls = mockApi({
      'GET /v1/public/shop/cart-handoff/TOKEN123456': {
        body: { lines: [{ productId: PRODUCT_ID, productVariantId: VARIANT_L, quantity: 2 }], bundles: [], attr: { t: null, tFor: null, ref: 'MAYA', utm: {} } },
      },
      [`GET /v1/public/products/${PRODUCT_ID}`]: { body: product() },
    });
    renderApp('/cart?restore=TOKEN123456');
    expect(await screen.findByText('Down jacket')).toBeInTheDocument();
    expect(guestCart.items()).toHaveLength(1);
    expect(guestCart.items()[0].body.quantity).toBe(2);
    expect(calls.filter((c) => c.path.startsWith('/v1/public/shop/cart-handoff')).length).toBe(1);
    expect(JSON.parse(localStorage.getItem('sm_shop_attr') ?? '{}').ref).toBe('MAYA');
  });
});
