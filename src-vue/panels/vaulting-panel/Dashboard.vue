<!-- prettier-ignore -->
<template>
  <div class="flex flex-col h-full">
    <div
      class="flex flex-col h-full px-3.5 py-3 gap-y-2.5 justify-stretch grow"
    >
      <div class="flex flex-row">
        <div class="flex flex-col w-1/2 gap-4 pr-4">
          <div box class="flex flex-col gap-4 p-5 text-gray-800 font-medium">
            <div class="flex flex-col col-span-2 text-fuchsia-800 items-center">
              <span class="text-4xl font-bold">{{ currency.symbol }}{{ microgonToMoneyNm(vaultCapital).formatIfElse('< 1_000', '0,0.00', '0,0') }}</span>
              <label>Capital In Vault</label>
            </div>
            <div class="grid grid-cols-2 flex-row border-t-1 pt-2">
              <label>Capital Waiting for Usage</label>
              <span class="text-right">{{ currency.symbol }}{{ microgonToMoneyNm(vaultCapital - capitalInUse).formatIfElse('< 1_000', '0,0.00', '0,0') }}</span>
            </div>
            <div class="grid grid-cols-2 flex-row border-t-1 pt-2">
              <label>As Securitization ({{ numeral(config.vaultingRules.capitalForSecuritizationPct).format('0.[00]') }}%)</label>
              <span class="text-right" >
                {{ currency.symbol }}{{ microgonToMoneyNm(vault.createdVault!.activatedSecuritization()).formatIfElse('< 1_000', '0,0.00', '0,0') }}
                <span class="pl-5 text-gray-500" v-if="pendingSecuritization > 0">({{ currency.symbol }}{{ microgonToMoneyNm(pendingSecuritization).formatIfElse('< 1_000', '0,0.00', '0,0') }} pending)</span>
              </span>
            </div>
            <div class="grid grid-cols-2 flex-row border-t-1 py-2">
              <label>In Liquidity Pool ({{ numeral(config.vaultingRules.capitalForLiquidityPct).format('0.[00]') }}%)</label>
              <span class="text-right">
                {{ currency.symbol }}{{ microgonToMoneyNm(ownLiquidityPoolCapitalDeployed).formatIfElse('< 1_000', '0,0.00', '0,0') }}
                <span class="pl-5 text-gray-500" v-if="pendingLiquidityPool > 0">({{ currency.symbol }}{{ microgonToMoneyNm(pendingLiquidityPool).formatIfElse('< 1_000', '0,0.00', '0,0') }} pending)</span>
              </span>
            </div>

            <div v-if="isSavingRules || saveRulesErrorMessage" class="text-md font-thin text-center">
              <span class="text-red-700 font-bold text-md" v-if="saveRulesErrorMessage">{{ saveRulesErrorMessage }}</span>
              <div class="mt-4 text-gray-500" v-else>
                Saving vaulting rules...
              </div>
              <ProgressBar
                :hasError="saveRulesErrorMessage != ''"
                :progress="saveRulesProgressPct"
              />
            </div>
          </div>

          <!-- Small metrics -->
          <div class="grid grid-cols-3 gap-4">
            <div box stat-box>
              <span class="text-4xl font-bold">{{ numeral(bitcoinTransactions).format('0,0') }}</span>
              <label>BTC Tx</label>
            </div>
            <div box stat-box>
              <span class="text-4xl font-bold">
                {{ currency.symbol }}{{ microgonToMoneyNm(revenueMicrogons).formatIfElse('< 1_000', '0,0.00', '0,0') }}
              </span>
              <label>Revenue TD</label>
            </div>
            <div box stat-box>
              <span class="text-4xl font-bold">{{ numeral(apy).formatIfElseCapped('< 100', '0,0.[00]', '0,0', 9_999) }}%</span>
              <label>APY</label>
            </div>
          </div>
        </div>
        <!-- Countdown and collect callout -->
        <div box class="flex flex-col items-center text-center py-8 space-y-2 w-1/2">
          <span class="text-red-700 font-thin py-4" v-if="collectError">{{ collectError }}</span>
          <div :class="{ 'opacity-80': isCollecting }">
            <span class="text-gray-500 uppercase text-sm">You have</span>
            <CountdownClock
              :time="nextCollectDueDate"
              v-slot="{ hours, minutes, days }"
            >
              <div class="text-2xl font-bold text-gray-800">
                <span v-if="days > 0">{{ days }} day{{ days === 1 ? '' : 's' }} </span>
                <template v-else>
                  <span class="mr-2" v-if="hours">{{ hours }} hour{{ hours === 1 ? '' : 's' }} </span>
                  <span v-if="minutes">{{ minutes }} minute{{ minutes === 1 ? '' : 's' }}</span>
                </template>
              </div>
            </CountdownClock>
            <div class="text-xl font-semibold px-2">to lock in your <div>{{ currency.symbol }}{{ microgonToMoneyNm(vault.data.pendingCollectRevenue).formatIfElse('< 1_000', '0,0.00', '0,0') }}</div></div>
            <span class="text-gray-500">in compounding profits protecting your {{ currency.symbol }}{{ microgonToMoneyNm(securitization).formatIfElse('< 1_000', '0,0.00', '0,0') }} securitization</span>
            <br/>
            <button class="mt-2 px-6 py-2 rounded bg-purple-600 text-white" @click="collect"
                    :class="[isCollecting?'opacity-80' :'']" :disabled="isCollecting">COLLECT
            </button>
          </div>
          <ProgressBar v-if="isCollecting" class="my-5"
                       :hasError="collectError != ''"
                       :progress="collectProgress"
          />
          <span class="text-sm text-gray-400">Will sign {{ vault.data.pendingCosignUtxoIds.size }} vault transactions</span>
        </div>
      </div>
      <!-- Operational Efficiency -->
      <div box class="flex flex-col items-center text-center py-4">
        <span class="text-4xl font-bold">0%</span>
        <label>Operational Efficiency</label>
        <div class="mt-2 text-purple-600">How to Improve Vault: - Attract BTC</div>
      </div>

      <!-- Personal Bitcoin panel -->
      <div box class="flex flex-col items-center p-6" :class="[ personalUtxo ? '' : 'border-dashed border-2']">
        <h2 class="text-3x font-bold text-gray-600 text-left">Personal Bitcoin</h2>
        <div class="grid grid-cols-5 gap-4 items-center py-4" v-if="personalUtxo">
          <div stat-box class="flex flex-col text-center">
            <span
              class="text-2xl font-bold">{{ numeral(currency.satsToBtc(personalUtxo.satoshis)).format('0,0.[00000000]') }} BTC</span>
            <div class="text-gray-500 text-sm">Market Value = {{ currency.symbol }}{{ microgonToMoneyNm(btcMarketRate).format('0,0.[00]') }}
            </div>
          </div>
          <div stat-box class="flex flex-col text-center">
            <span class="text-2xl font-bold" :class="[personalUtxo.status === 'initialized'? 'text-gray-500': '']">{{ currency.symbol }}{{ microgonToMoneyNm(personalUtxo.lockPrice).format('0,0.[00]') }}</span>
            <label v-if="personalUtxo.status === 'initialized'">Liquidity Promised</label>
            <label v-else>Liquidity Unlocked</label>
            <div v-if="personalUtxo.status === 'initialized' && bitcoinPendingStatus" class="text-sm text-gray-400">({{bitcoinPendingStatus}})</div>
          </div>
          <template v-if="personalUtxo.status === 'initialized'">
            <div stat-box class="text-center flex-flex-col">
              <CountdownClock :time="lockInitializeExpirationTime" v-slot="{ days, hours, minutes }">
                <template v-if="days > 0">
                  <span class="text-2xl font-bold">{{ days }} Days</span>
                </template>
                <template v-else>
                  <span class="text-2xl font-bold">{{ hours }}h {{ minutes }}m</span>
                </template>
              </CountdownClock>
              <label>Bitcoin Funding Due By</label>
            </div>
            <div stat-box class="text-center col-span-2 flex-flex-col">
              <span class="text-2xl font-normal"><button class="px-4 py-2 rounded bg-purple-600 text-white"
                                                         @click="showCompleteLockOverlay = true">Transfer BTC</button></span>
              <label>To Unlock your Liquidity</label>
            </div>
          </template>
          <template v-else-if="personalUtxo.status !== 'released'">
            <div stat-box class="text-center">
              <span class="text-2xl font-bold">{{ numeral(mintPercent).format('0,0.[0]') }}%</span>
              <label>Minted</label>
            </div>
            <div stat-box class="text-center">
              <CountdownClock :time="lockExpirationTime" v-slot="{ hours, minutes, days }">
                <template v-if="days === 0">
                  <span class="text-2xl font-bold">{{ hours }}h {{ minutes }}m</span>
                </template>
                <template v-else>
                    <span class="text-2xl font-bold">{{ days }} Day{{ days > 1 ? 's' : '' }}</span>
                </template>
              </CountdownClock>

              <label>Expires In</label>
            </div>
            <div stat-box class="text-center">
              <button class="px-4 py-2 rounded bg-purple-600 text-white" @click="showReleaseOverlay=true">Release
              </button>
            </div>
          </template>
          <template v-else >
            <div stat-box class="text-right col-span-3">
              <span class="text-md text-fuchsia-800 border-2 border-y-fuchsia-800 p-4 border-dashed opacity-40">Released</span>
            </div>
          </template>
        </div>
        <div v-else-if="!vaultingRules.personalBtcInMicrogons" class="text-2xl font-bold text-center">
          Configure a personal bitcoin amount to capture your Vault's liquidity
        </div>
        <div v-else class="text-md font-bold text-gray-400 text-center">
          Initializing your personal bitcoin lock...
        </div>
      </div>
    </div>
  </div>

  <!-- Overlays -->
  <BitcoinLockCompleteOverlay
    v-if="showCompleteLockOverlay && personalUtxo"
    :lock="personalUtxo"
    @close="showCompleteLockOverlay = false" />

  <BitcoinReleaseOverlay
    v-if="showReleaseOverlay && personalUtxo"
    :lock="personalUtxo"
    @close="showReleaseOverlay = false"
  />
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import utc from 'dayjs/plugin/utc';
import { useCurrency } from '../../stores/currency';
import numeral, { createNumeralHelpers } from '../../lib/numeral';
import { useMyVault, useVaults } from '../../stores/vaults.ts';
import { useConfig } from '../../stores/config.ts';
import { MyVault } from '../../lib/MyVault.ts';
import CountdownClock from '../../components/CountdownClock.vue';
import { useBitcoinLocks } from '../../stores/bitcoin.ts';
import ProgressBar from '../../components/ProgressBar.vue';
import BitcoinLockCompleteOverlay from '../../overlays/BitcoinLockCompleteOverlay.vue';
import BitcoinReleaseOverlay from '../../overlays/BitcoinReleaseOverlay.vue';

dayjs.extend(relativeTime);
dayjs.extend(utc);

const vault = useMyVault();
const vaults = useVaults();
const bitcoinLocks = useBitcoinLocks();
const config = useConfig();
const currency = useCurrency();

const { microgonToMoneyNm } = createNumeralHelpers(currency);

// For the Vault UI countdown clock
const nextCollectDueDate = Vue.computed(() => {
  return dayjs(vault.data.nextCollectDueDate);
});

const personalUtxo = Vue.computed(() => {
  const utxoId = vault.metadata?.personalUtxoId;
  if (!utxoId) return null;
  return bitcoinLocks.data.locksById[utxoId];
});

Vue.watch(personalUtxo, async () => {
  const utxo = personalUtxo.value;
  if (!utxo) return;
  bitcoinLocks.confirmAddress(utxo);
  bitcoinLocks.load().then(() => {
    lockInitializeExpirationTime.value = dayjs(bitcoinLocks.verifyExpirationTime(utxo));
  });
  btcMarketRate.value = await vaults.getMarketRate(personalUtxo.value.satoshis).catch(() => 0n);
});

const lockInitializeExpirationTime = Vue.ref(dayjs().add(1, 'day'));

const lockExpirationTime = Vue.ref(dayjs());

function updateLockExpiration() {
  if (personalUtxo.value) {
    const utxo = personalUtxo.value;
    bitcoinLocks.load().then(() => {
      const expirationMillis = bitcoinLocks.approximateExpirationTime(utxo);
      lockExpirationTime.value = dayjs(expirationMillis);
    });
  }
}

const btcMarketRate = Vue.ref(0n);

const mintPercent = Vue.computed(() => {
  const utxo = personalUtxo.value;
  if (!utxo) return 0n;
  const { mintAmount, mintPending } = utxo.ratchets[0];
  if (mintPending === 0n) return 100;
  return Number(mintAmount - mintPending) / Number(mintAmount);
});

const vaultCapital = Vue.computed(() => {
  const { microgonsForVaulting } = MyVault.getMicrogoonSplit(config.vaultingRules);
  return microgonsForVaulting;
});

const pendingSecuritization = Vue.computed(() => {
  const { microgonsForSecuritization } = MyVault.getMicrogoonSplit(config.vaultingRules);
  return microgonsForSecuritization - (vault.createdVault?.activatedSecuritization() ?? 0n);
});

const pendingLiquidityPool = Vue.computed(() => {
  const { microgonsForLiquidity } = MyVault.getMicrogoonSplit(config.vaultingRules);
  return microgonsForLiquidity - ownLiquidityPoolCapitalDeployed.value;
});

const ownLiquidityPoolCapitalDeployed = Vue.computed(() => {
  const liquidityPool = vault.data.stats;
  if (!liquidityPool) return 0n;
  return liquidityPool.changesByFrame
    .slice(0, 10)
    .reduce((acc, change) => acc + (change.liquidityPool.vaultCapital ?? 0n), 0n);
});
const capitalInUse = Vue.computed(() => {
  let activatedSecuritization = vault.createdVault?.activatedSecuritization() ?? 0n;
  return activatedSecuritization + ownLiquidityPoolCapitalDeployed.value;
});

const apy = Vue.computed(() => {
  const stats = vault.data.stats;
  if (!stats) return 0;
  let ytdRevenue = 0n;
  const capitalDeployed: bigint[] = [];
  let framesRemaining = 365; // Assuming 365 frames for a year
  for (const change of stats.changesByFrame) {
    ytdRevenue += change.bitcoinFeeRevenue;
    ytdRevenue += change.liquidityPool.vaultEarnings;
    capitalDeployed.push(change.securitization + change.liquidityPool.vaultCapital);
    framesRemaining -= 1;
    if (framesRemaining <= 0) break;
  }
  console.log({ ytdRevenue, capitalDeployed });
  if (framesRemaining > 0) {
    ytdRevenue += stats.baseline.feeRevenue;
  }
  const averageCapitalDeployed =
    capitalDeployed.reduce((acc, val) => acc + val, 0n) / BigInt(capitalDeployed.length || 1);
  return (Number(ytdRevenue) * 100) / Number(averageCapitalDeployed);
});

const revenueMicrogons = Vue.computed(() => {
  const stats = vault.data.stats;
  if (!stats) return 0n;
  let sum = stats.baseline.feeRevenue ?? 0n;
  for (const change of stats.changesByFrame) {
    sum += change.bitcoinFeeRevenue ?? 0n;
    sum += change.liquidityPool.vaultEarnings ?? 0n;
  }
  return sum;
});

const bitcoinTransactions = Vue.computed(() => {
  const stats = vault.data.stats;
  if (!stats) return 0;
  let sum = stats.baseline.bitcoinLocks ?? 0;
  for (const change of stats.changesByFrame) {
    sum += change.bitcoinLocksCreated ?? 0;
  }
  return sum;
});

const isCollecting = Vue.ref(false);
const collectProgress = Vue.ref(0);
const collectError = Vue.ref('');

const showCompleteLockOverlay = Vue.ref(false);
const showReleaseOverlay = Vue.ref(false);

async function collect() {
  isCollecting.value = true;
  collectProgress.value = 0;
  try {
    const { bitcoinXprivSeed, vaultingAccount } = config;
    await vault.collect(
      { argonKeyring: vaultingAccount, xprivSeed: bitcoinXprivSeed },
      (totalComplete, inProgressPctComplete, toComplete) => {
        collectProgress.value = totalComplete + inProgressPctComplete * (1 / toComplete);
      },
    );
    collectProgress.value = 100;
  } catch (error) {
    console.error('Error collecting pending revenue:', error);
    collectError.value = error instanceof Error ? error.message : `${error}`;
  } finally {
    isCollecting.value = false;
  }
}

const securitization = Vue.computed(() => {
  return vault.createdVault?.securitization ?? 0n;
});

const vaultingRules = config.vaultingRules;
const isSavingRules = Vue.ref(false);
const saveRulesErrorMessage = Vue.ref('');
const saveRulesProgressPct = Vue.ref(0); // 0-100

const bitcoinPendingStatus = Vue.ref('');
let checkUnverifiedStatusInterval: ReturnType<typeof setInterval> | null = null;
async function checkUnverifiedBitcoinStatus() {
  if (!personalUtxo.value) return;
  if (personalUtxo.value.status !== 'initialized') {
    if (checkUnverifiedStatusInterval) clearInterval(checkUnverifiedStatusInterval);
    return;
  }
  try {
    const utxo = personalUtxo.value;
    const status = await bitcoinLocks.checkFundingStatus(utxo);
    if (status?.isConfirmed) {
      const pendingBlocks = status.blockHeight - bitcoinLocks.data.bitcoinBlockHeight;
      bitcoinPendingStatus.value =
        pendingBlocks > 0
          ? `Waiting for ${pendingBlocks} more bitcoin block${pendingBlocks > 1 ? 's' : ''}`
          : 'Funding confirmed';
      showCompleteLockOverlay.value = false;
    } else if (status) {
      bitcoinPendingStatus.value = `In bitcoin mempool`;
      showCompleteLockOverlay.value = false;
    } else {
      bitcoinPendingStatus.value = `Waiting for funding...`;
    }
    console.log(bitcoinPendingStatus.value, status);
  } catch (error) {
    console.error('Error checking UTXO status:', error);
    bitcoinPendingStatus.value = `Waiting for funding...`;
  }
}

Vue.onMounted(async () => {
  await vault.load();
  await vault.subscribe();
  await bitcoinLocks.load();
  await bitcoinLocks.subscribe();
  updateLockExpiration();

  try {
    saveRulesErrorMessage.value = '';

    await vault.saveVaultRules({
      argonKeyring: config.vaultingAccount,
      bitcoinLocksStore: bitcoinLocks,
      bip39Seed: config.bitcoinXprivSeed,
      rules: vaultingRules,
      txProgressCallback(progress: number) {
        if (progress > 0) {
          isSavingRules.value = true;
        }
        saveRulesProgressPct.value = progress;
      },
    });
    saveRulesProgressPct.value = 100;
    if (isSavingRules.value) {
      setTimeout(() => (isSavingRules.value = false), 60000);
    }
  } catch (error) {
    console.error('Error prebonding liquidity pool:', error);
    saveRulesErrorMessage.value = error instanceof Error ? error.message : `${error}`;
    saveRulesProgressPct.value = 100;
  }

  if (personalUtxo.value) {
    const utxo = personalUtxo.value;
    btcMarketRate.value = await vaults.getMarketRate(utxo.satoshis).catch(() => 0n);
    if (utxo.status === 'releaseRequested' || utxo.status === 'vaultCosigned') {
      showReleaseOverlay.value = true;
    }
    if (utxo.status === 'initialized') {
      checkUnverifiedStatusInterval = setInterval(checkUnverifiedBitcoinStatus, 1000);
    }
    lockInitializeExpirationTime.value = dayjs(bitcoinLocks.verifyExpirationTime(utxo));
  }
});

Vue.onUnmounted(() => {
  vault.unsubscribe();
  bitcoinLocks.unsubscribe();
  if (checkUnverifiedStatusInterval) clearInterval(checkUnverifiedStatusInterval);
});
</script>

<style scoped>
@reference "../../main.css";

[box] {
  @apply min-h-20 rounded border-[1px] border-slate-400/30 bg-white py-2 shadow;
}

[stat-box] {
  @apply flex flex-col items-center justify-center text-[#963EA7];

  span {
    @apply text-4xl font-bold;
  }

  label {
    @apply mt-1 text-sm text-gray-500;
  }
}
</style>
