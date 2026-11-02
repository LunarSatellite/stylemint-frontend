import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  sessionStorage.clear();
  localStorage.clear();
});

// jsdom does not implement these.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).ResizeObserver = ResizeObserverStub;
window.HTMLElement.prototype.scrollIntoView = function () {};
Object.defineProperty(window, 'scrollTo', { writable: true, value: () => {} });
// jsdom's HTMLMediaElement has no playback.
Object.defineProperty(window.HTMLMediaElement.prototype, 'play', { writable: true, value: () => Promise.resolve() });
Object.defineProperty(window.HTMLMediaElement.prototype, 'pause', { writable: true, value: () => {} });
