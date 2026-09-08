import { describe, expect, it, vi } from 'vitest';
import { TxSubmitter } from '../src/TxSubmitter.ts';

const pendingStatus = {
  isBroadcast: false,
  isInBlock: false,
  isRetracted: false,
  isFinalityTimeout: false,
  isFinalized: false,
  isUsurped: false,
  isDropped: false,
  isInvalid: false,
};

describe('TxSubmitter', () => {
  it.each([
    ['finality timeout', { isFinalityTimeout: true }],
    ['usurped', { isUsurped: true, asUsurped: { toHex: () => '0xreplacement' } }],
    ['dropped', { isDropped: true }],
    ['invalid', { isInvalid: true }],
  ])('releases a synchronously completed %s watch exactly once', async (_label, terminalStatus) => {
    const unsubscribe = vi.fn();
    const signedTx = createSignedTx(async callback => {
      callback({
        events: [],
        isError: true,
        isFinalized: false,
        status: { ...pendingStatus, ...terminalStatus },
      });
      await Promise.resolve();
      return unsubscribe;
    });

    await createSubmitter().submitSigned(signedTx as never);

    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('keeps a broadcast and in-block watch until finalization and releases it exactly once', async () => {
    const unsubscribe = vi.fn();
    let onResult!: (result: any) => void;
    const signedTx = createSignedTx(async callback => {
      onResult = callback;
      callback({
        events: [],
        isError: false,
        isFinalized: false,
        status: { ...pendingStatus, isBroadcast: true },
      });
      return unsubscribe;
    });

    await createSubmitter().submitSigned(signedTx as never);
    expect(unsubscribe).not.toHaveBeenCalled();

    onResult({
      events: [],
      isError: false,
      isFinalized: false,
      status: {
        ...pendingStatus,
        isInBlock: true,
        asInBlock: Uint8Array.from([1]),
      },
      txIndex: 0,
    });
    expect(unsubscribe).not.toHaveBeenCalled();

    const finalizedResult = {
      events: [],
      isError: false,
      isFinalized: true,
      status: {
        ...pendingStatus,
        isFinalized: true,
        asFinalized: Uint8Array.from([1]),
      },
      txIndex: 0,
    };
    onResult(finalizedResult);
    onResult(finalizedResult);

    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});

function createSubmitter(): TxSubmitter {
  const client = {
    rpc: {
      chain: {
        getHeader: vi.fn(async () => ({ number: { toNumber: () => 100 } })),
      },
    },
  };
  return new TxSubmitter(client as never, {} as never, { address: '5Alice' } as never);
}

function createSignedTx(send: (callback: (result: any) => void) => Promise<() => void>) {
  return {
    hash: { toHex: () => '0xtransaction' },
    method: { toHuman: () => ({ section: 'balances', method: 'transferAllowDeath' }) },
    nonce: { toNumber: () => 1 },
    send: vi.fn(send),
  };
}
