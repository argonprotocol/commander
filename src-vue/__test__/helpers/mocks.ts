import { vi } from 'vitest';

vi.mock('../../lib/SSH', async () => {
  const { sshMockFn } = await import('./ssh');
  return sshMockFn();
});

vi.mock('../../lib/Countries', async () => {
  const actual = await vi.importActual('../../lib/Countries');
  return {
    ...actual,
    getUserJurisdiction: vi.fn(() => Promise.resolve('US')),
  };
});

vi.mock('../../lib/tauriApi', async () => {
  return {
    invokeWithTimeout: vi.fn((command: string, args: any) => {
      console.log('invokeWithTimeout', command, args);

      return Promise.resolve();
    }),
  };
});

vi.mock('@tauri-apps/plugin-dialog', () => {
  return { message: vi.fn() };
});
