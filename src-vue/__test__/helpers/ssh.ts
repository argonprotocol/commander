import { vi } from 'vitest';

export const sshMockFn = () => {
  return {
    SSH: {
      getConnection: () =>
        Promise.resolve({
          runCommandWithTimeout: vi.fn((command: string, timeout: number) => {
            console.log('SSH.runCommandWithTimeout', command, timeout);
            return Promise.resolve(['', 0]);
          }),
        }),
      tryConnection: vi.fn(),
      closeConnection: vi.fn(),
      ensureConnection: vi.fn(),
      runCommand: vi.fn((command: string) => {
        console.log('SSH.runCommand', command);
        return ['', 0];
      }),
      runHttpGet: vi.fn(),
      uploadFile: vi.fn(),
      uploadDirectory: vi.fn(),
    },
  };
};
