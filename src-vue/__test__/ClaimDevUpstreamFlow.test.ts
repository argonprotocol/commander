import { expect, it, vi } from 'vitest';
import claimDevUpstream from '../../e2e/flows/operations/App.flow.claimDevUpstream.ts';

it('finishes E2E Operations access when an upstream claim was already persisted', async () => {
  const config = {
    upstreamOperator: { name: 'Dev Upstream' },
    hasExtensionOperations: false,
    save: vi.fn(async () => undefined),
  };
  const flow = {
    queryApp: async (query: (refs: { config: typeof config }) => unknown) => await query({ config }),
    run: vi.fn(async () => undefined),
    click: vi.fn(async () => {
      throw new Error('The persisted upstream claim should not be repeated.');
    }),
  };
  const context = { flow: flow as never };

  const state = await claimDevUpstream.inspect(context);
  expect(state.state).toBe('runnable');

  await claimDevUpstream.run(context, state);

  expect(config.hasExtensionOperations).toBe(true);
  expect(config.save).toHaveBeenCalledOnce();
  expect((await claimDevUpstream.inspect(context)).state).toBe('complete');
});
