import { vi } from 'vitest';

export const sshMockFn = () => {
  return {
    SSH: {
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
