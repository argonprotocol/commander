import appPrepareAccess from './App.op.prepareAccess.ts';
import { OperationalFlow } from './index.ts';
import type { IE2EFlowRuntime, IE2EOperationInspectState } from '../types.ts';
import { pollEvery } from '../helpers/utils.ts';

interface IClaimDevUpstreamContext {
  flow: IE2EFlowRuntime;
}

type IClaimDevUpstreamState = IE2EOperationInspectState<
  Record<string, never>,
  {
    upstreamName?: string;
  }
>;

export default new OperationalFlow<IClaimDevUpstreamContext, IClaimDevUpstreamState>(import.meta, {
  description: 'Claim an invite from the live dev upstream operator.',
  defaultTimeoutMs: 60_000,
  createContext: flow => ({ flow }),
  async inspect({ flow }) {
    const upstreamName = await flow.queryApp(refs => refs.config.upstreamOperator?.name);
    return {
      chainState: {},
      uiState: { upstreamName },
      state: upstreamName ? 'complete' : 'runnable',
      blockers: [],
    };
  },
  async run({ flow }) {
    const inviteCode = flow.getData<string>('devUpstreamInviteCode');
    if (!inviteCode) throw new Error('The dev upstream fixture did not provide an invite code.');

    await flow.run(appPrepareAccess);
    await flow.click('LeftBar.openUpgradeToTreasuryOverlay()', { timeoutMs: 30_000 });
    const inviteInput = { selector: '[data-testid="UpgradeToTreasuryOverlay"] input[type="text"]' };
    await flow.waitFor(inviteInput, { timeoutMs: 30_000 });
    await flow.type(inviteInput, inviteCode, { timeoutMs: 10_000 });
    await flow.click('UpgradeToTreasuryOverlay.connectToNetwork()', { timeoutMs: 10_000 });

    await pollEvery(
      500,
      async () => {
        const upstreamName = await flow.queryApp(refs => refs.config.upstreamOperator?.name, { timeoutMs: 2_000 });
        return upstreamName ? true : false;
      },
      {
        timeoutMs: 30_000,
        timeoutMessage: 'The app did not persist the claimed upstream operator.',
      },
    );

    const welcome = await flow.isVisible('WelcomeToTreasuryOverlay.closeOverlay()');
    if (welcome.clickable) {
      await flow.click('WelcomeToTreasuryOverlay.closeOverlay()', { timeoutMs: 10_000 });
    }
  },
});
