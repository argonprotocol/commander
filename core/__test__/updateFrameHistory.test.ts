import { afterEach, describe, expect, it, vi } from 'vitest';

const getClient = vi.hoisted(() => vi.fn());

vi.mock('@argonprotocol/mainchain', async importOriginal => ({
  ...(await importOriginal<typeof import('@argonprotocol/mainchain')>()),
  getClient,
}));

describe('updateFrameHistory', () => {
  const originalNetworkName = process.env.ARGON_NETWORK_NAME;

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.resetModules();
    getClient.mockReset();
    if (originalNetworkName === undefined) {
      delete process.env.ARGON_NETWORK_NAME;
    } else {
      process.env.ARGON_NETWORK_NAME = originalNetworkName;
    }
  });

  it('finishes after an archive connection times out without settling', async () => {
    vi.useFakeTimers();
    process.env.ARGON_NETWORK_NAME = 'mainnet';
    getClient.mockImplementation(() => new Promise(() => undefined));
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await import('../src/scripts/updateFrameHistory.ts');
    await vi.advanceTimersByTimeAsync(1_000);

    expect(warning).toHaveBeenCalledWith('[mainnet]', expect.objectContaining({ message: 'Connection timeout' }));
    expect(exit).toHaveBeenCalledWith(0);
  });
});
