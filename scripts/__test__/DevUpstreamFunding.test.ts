import { describe, expect, it } from 'vitest';
import { planDevUpstreamFunding } from '../../e2e/scripts/devUpstreamServer.ts';

describe('dev upstream funding', () => {
  it('preserves funded accounts when a worker reattaches to a running stack', () => {
    const funding = planDevUpstreamFunding({
      miningBot: {
        address: 'mining-bot',
        microgons: 99_999_999_266_250n,
        micronots: 100_000_000_000_000n,
      },
      treasury: {
        address: 'treasury',
        microgons: 9_999_999_500n,
        micronots: 42n,
      },
    });

    expect(funding).toEqual([]);
  });
});
