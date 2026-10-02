import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { server } from './server';
import { fakeApi } from './fakeApi';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(() => {
  cleanup();
  server.resetHandlers();
  fakeApi.reset();
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-bs-theme');
  vi.useRealTimers();
});

afterAll(() => server.close());

// jsdom gaps the app touches.
window.scrollTo = () => {};
window.print = vi.fn();
if (!URL.createObjectURL) URL.createObjectURL = () => 'blob:test';
if (!URL.revokeObjectURL) URL.revokeObjectURL = () => {};
