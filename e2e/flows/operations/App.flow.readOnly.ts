import { OperationalFlow } from './index.ts';
import type { IE2EFlowRuntime, IE2EOperationInspectState } from '../types.ts';

interface IReadOnlyFlowContext {
  flow: IE2EFlowRuntime;
}

type IReadOnlyFlowState = IE2EOperationInspectState<
  Record<string, never>,
  {
    canSign: boolean;
    defaultArgonAddress?: string;
    expectedDefaultArgonAddress?: string;
    defaultEthereumAddress?: string;
    expectedEthereumAddress?: string;
    expectsOperations?: boolean;
    badgeVisible: boolean;
    hasOperationsAccess: boolean;
    configuredServerLoaded: boolean;
    serverUnavailableVisible: boolean;
    recoveryInProgress: boolean;
    upstreamName?: string;
    upstreamVisible: boolean;
    vaultId?: number;
    bitcoinLockEntryVisible: boolean;
  }
>;

export default new OperationalFlow<IReadOnlyFlowContext, IReadOnlyFlowState>(import.meta, {
  description: 'Verify that an operational account loads its available state without signing or server access.',
  defaultTimeoutMs: 60_000,
  createContext: flow => ({ flow }),
  async inspect({ flow }) {
    const appState = await flow.queryApp(refs => ({
      canSign: refs.canSign,
      defaultArgonAddress: refs.defaultArgonAddress,
      defaultEthereumAddress: refs.defaultEthereumAddress,
      hasOperationsAccess: refs.config.hasExtensionOperations,
      configuredServerLoaded: refs.config.isServerAdded,
      recoveryInProgress: refs.config.isBootingUpPreviousWalletHistory,
      upstreamName: refs.config.upstreamOperator?.name,
      vaultId: refs.myVault.vaultId,
    }));
    const badgeVisible = (await flow.isVisible({ selector: '[data-read-only]' })).visible;
    const serverUnavailableVisible = (await flow.isVisible({ selector: '[data-server-unavailable]' })).visible;
    const upstreamVisible = (await flow.isVisible({ selector: '[data-upstream-operator]' })).visible;
    const bitcoinLockEntryVisible = (await flow.isVisible({ selector: '[data-testid^="BitcoinLocks.lockEntry."]' }))
      .visible;
    const expectedDefaultArgonAddress = String(flow.input.expectedDefaultArgonAddress ?? '');
    const expectedEthereumAddress = String(flow.input.expectedEthereumAddress ?? '');
    const expectsConfiguredServer = flow.input.expectsConfiguredServer !== false;
    const expectsUpstream = flow.input.expectsUpstream !== false;
    const expectsVault = flow.input.expectsVault !== false;
    const expectsOperations = flow.input.expectsOperations !== false;
    const expectsBitcoinLock = flow.input.expectsBitcoinLock === true;
    const hasExpectedIdentity = expectedDefaultArgonAddress
      ? appState?.defaultArgonAddress === expectedDefaultArgonAddress
      : !!expectedEthereumAddress &&
        appState?.defaultEthereumAddress.toLowerCase() === expectedEthereumAddress.toLowerCase();
    const hasExpectedServerState = expectsConfiguredServer
      ? appState?.configuredServerLoaded && serverUnavailableVisible
      : !appState?.configuredServerLoaded && !serverUnavailableVisible;
    const hasExpectedUpstreamState = expectsUpstream
      ? !!appState?.upstreamName && upstreamVisible
      : !appState?.upstreamName && !upstreamVisible;
    const isComplete =
      appState?.canSign === false &&
      badgeVisible &&
      !appState?.recoveryInProgress &&
      appState?.hasOperationsAccess === expectsOperations &&
      hasExpectedIdentity &&
      hasExpectedServerState &&
      hasExpectedUpstreamState &&
      (!expectsVault || appState?.vaultId != null) &&
      (!expectsBitcoinLock || bitcoinLockEntryVisible);

    return {
      chainState: {},
      uiState: {
        canSign: appState?.canSign ?? true,
        defaultArgonAddress: appState?.defaultArgonAddress,
        expectedDefaultArgonAddress,
        defaultEthereumAddress: appState?.defaultEthereumAddress,
        expectedEthereumAddress,
        badgeVisible,
        hasOperationsAccess: appState?.hasOperationsAccess ?? false,
        configuredServerLoaded: appState?.configuredServerLoaded ?? false,
        serverUnavailableVisible,
        recoveryInProgress: appState?.recoveryInProgress ?? false,
        upstreamName: appState?.upstreamName,
        upstreamVisible,
        vaultId: appState?.vaultId,
        bitcoinLockEntryVisible,
      },
      state: isComplete ? 'complete' : 'runnable',
      blockers: [
        ...(appState?.canSign === false ? [] : ['app still reports signing access']),
        ...(badgeVisible ? [] : ['readonly badge is not visible']),
        ...(!appState?.recoveryInProgress ? [] : ['blockchain history recovery is still in progress']),
        ...(appState?.hasOperationsAccess === expectsOperations
          ? []
          : [`operations access should be ${expectsOperations ? 'enabled' : 'disabled'}`]),
        ...(hasExpectedIdentity ? [] : ['wallet metadata identity was not loaded']),
        ...(hasExpectedServerState ? [] : ['configured server state does not match the account package']),
        ...(hasExpectedUpstreamState ? [] : ['upstream operator state does not match the account package']),
        ...(!expectsVault || appState?.vaultId != null ? [] : ['on-chain vault state was not loaded']),
        ...(!expectsBitcoinLock || bitcoinLockEntryVisible ? [] : ['Bitcoin lock is not visible']),
      ],
    };
  },
  async run({ flow }) {
    if (flow.input.expectsBitcoinLock === true) {
      await flow.poll<IReadOnlyFlowState>(
        latest => latest.blockers.every(blocker => blocker === 'Bitcoin lock is not visible'),
        {
          pollMs: 1_000,
          timeoutMs: 60_000,
          timeoutMessage: 'Account did not finish loading its readonly state before Bitcoin navigation.',
        },
      );
      const bitcoinLocksScreen = await flow.isVisible('BitcoinLocksScreen');
      if (!bitcoinLocksScreen.visible) {
        await flow.click('LeftBar.goto(TopTab.BitcoinLocks)', { timeoutMs: 10_000 });
        await flow.waitFor('BitcoinLocksScreen', { timeoutMs: 10_000 });
      }
    }
    await flow.poll<IReadOnlyFlowState>(latest => latest.state === 'complete', {
      pollMs: 1_000,
      timeoutMs: 60_000,
      timeoutMessage: 'Account did not finish loading its readonly state.',
    });
  },
});
