import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup, configure } from '@testing-library/react';

configure({ asyncUtilTimeout: 4000 });

afterEach(() => {
  cleanup();
  try {
    sessionStorage.clear();
    localStorage.clear();
  } catch {
    // jsdom always has storage; guarded for parity with the app
  }
});

// Mantine relies on matchMedia and ResizeObserver, neither of which jsdom implements.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
});

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
window.HTMLElement.prototype.scrollIntoView = vi.fn();
Object.defineProperty(window, 'scrollTo', { writable: true, value: vi.fn() });
