<template>
  <div class="px-4">
    <p class="text-md pt-2 pb-1 font-light">
      Select the components you want to restart and then click the run button.
      <template v-if="bot.isSyncing || installer.isRunning">
        Some options are disabled because your app is in the process of {{ bot.isSyncing ? 'syncing' : 'installing' }}.
      </template>
    </p>
    <ol>
      <li>
        <header
          @click="toggleOption(AdvancedRestartOption.ReloadAppUi)"
          class="mt-2 flex cursor-pointer flex-row items-center space-x-2 font-bold"
        >
          <Checkbox :isChecked="options[AdvancedRestartOption.ReloadAppUi].isChecked" :size="5" />
          <span>Reload App Interface</span>
        </header>
        <p class="text-md ml-7 font-light">This refreshes the UI. It does not affect the server or the database.</p>
      </li>
      <li
        :class="[
          options[AdvancedRestartOption.RecreateLocalDatabase].isDisabled ? 'pointer-events-none opacity-50' : '',
        ]"
      >
        <header
          @click="toggleOption(AdvancedRestartOption.RecreateLocalDatabase)"
          class="mt-2 flex cursor-pointer flex-row items-center space-x-2 font-bold"
        >
          <Checkbox :isChecked="options[AdvancedRestartOption.RecreateLocalDatabase].isChecked" :size="5" />
          <span>Recreate App Database</span>
        </header>
        <p class="text-md ml-7 font-light">
          This deletes your local database and resyncs from the server. This is sometimes helpful if data structure has
          gotten out of sync between the server and your app.
        </p>
      </li>
      <li :class="[options[AdvancedRestartOption.RestartDockers].isDisabled ? 'pointer-events-none opacity-50' : '']">
        <header
          @click="toggleOption(AdvancedRestartOption.RestartDockers)"
          class="mt-2 flex cursor-pointer flex-row items-center space-x-2 font-bold"
        >
          <Checkbox :isChecked="options[AdvancedRestartOption.RestartDockers].isChecked" :size="5" />
          <span>Restart Dockers on Cloud Machine</span>
        </header>
        <p class="text-md ml-7 font-light">
          This restarts your bitcoin and argon nodes as well as your bidding bot. No data will be touched. This can
          sometimes fix issues where one of the server processes is stuck.
        </p>
      </li>

      <li
        :class="[
          options[AdvancedRestartOption.ResyncBiddingDataOnCloudMachine].isDisabled
            ? 'pointer-events-none opacity-50'
            : '',
        ]"
      >
        <header
          @click="toggleOption(AdvancedRestartOption.ResyncBiddingDataOnCloudMachine)"
          class="mt-2 flex cursor-pointer flex-row items-center space-x-2 font-bold"
        >
          <Checkbox :isChecked="options[AdvancedRestartOption.ResyncBiddingDataOnCloudMachine].isChecked" :size="5" />
          <span>Resync Bidding Data on Cloud Machine</span>
        </header>
        <p class="text-md ml-7 font-light">
          This will delete the data on your cloud machine and recreate it from data on the Argon mainchain.
        </p>
      </li>

      <li
        :class="[
          options[AdvancedRestartOption.ResyncBitcoinBlocksOnCloudMachine].isDisabled
            ? 'pointer-events-none opacity-50'
            : '',
        ]"
      >
        <header
          @click="toggleOption(AdvancedRestartOption.ResyncBitcoinBlocksOnCloudMachine)"
          class="mt-2 flex cursor-pointer flex-row items-center space-x-2 font-bold"
        >
          <Checkbox :isChecked="options[AdvancedRestartOption.ResyncBitcoinBlocksOnCloudMachine].isChecked" :size="5" />
          <span>Resync Bitcoin Node on Cloud Machine</span>
        </header>
        <p class="text-md ml-7 font-light">
          This will shutdown and restart your server. No data will be touched. This can sometimes fix issues where the
          server has run into a bug and is stuck.
        </p>
      </li>

      <li
        :class="[
          options[AdvancedRestartOption.ResyncArgonBlocksOnCloudMachine].isDisabled
            ? 'pointer-events-none opacity-50'
            : '',
        ]"
      >
        <header
          @click="toggleOption(AdvancedRestartOption.ResyncArgonBlocksOnCloudMachine)"
          class="mt-2 flex cursor-pointer flex-row items-center space-x-2 font-bold"
        >
          <Checkbox :isChecked="options[AdvancedRestartOption.ResyncArgonBlocksOnCloudMachine].isChecked" :size="5" />
          <span>Resync Argon Node on Cloud Machine</span>
        </header>
        <p class="text-md ml-7 font-light">
          This will shutdown and restart your server. No data will be touched. This can sometimes fix issues where the
          server has run into a bug and is stuck.
        </p>
      </li>

      <li
        :class="[
          options[AdvancedRestartOption.CompletelyWipeAndReinstallCloudMachine].isDisabled
            ? 'pointer-events-none opacity-50'
            : '',
        ]"
      >
        <header
          @click="toggleOption(AdvancedRestartOption.CompletelyWipeAndReinstallCloudMachine)"
          class="mt-2 flex cursor-pointer flex-row items-center space-x-2 font-bold"
        >
          <Checkbox
            :isChecked="options[AdvancedRestartOption.CompletelyWipeAndReinstallCloudMachine].isChecked"
            :size="5"
          />
          <span>Completely Wipe and Reinstall Cloud Machine</span>
        </header>
        <p class="text-md ml-7 font-light">
          This will completley wipe everything on your server and reinstall it. This is a last resort option when all
          else fails.
        </p>
      </li>
    </ol>

    <button
      @click="runSelectedOptions"
      :class="[isRestarting ? 'pointer-events-none opacity-50' : '']"
      class="bg-argon-button mt-4 mb-3 w-full cursor-pointer rounded-lg py-2 text-white focus:outline-none"
    >
      {{ isRestarting ? 'Restarting...' : 'Run Restart' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import Checkbox from '../../components/Checkbox.vue';
import Restarter from '../../lib/Restarter';
import { AdvancedRestartOption } from '../../interfaces/IAdvancedRestartOption';
import { getDbPromise } from '../../stores/helpers/dbPromise';
import { useConfig } from '../../stores/config';
import { useInstaller } from '../../stores/installer';
import { useBot } from '../../stores/bot';

const config = useConfig();
const installer = useInstaller();
const bot = useBot();

const dbPromise = getDbPromise();
const restarter = new Restarter(dbPromise);
const isRestarting = Vue.ref(false);

const options = Vue.ref({
  [AdvancedRestartOption.ReloadAppUi]: {
    isChecked: false,
    isDisabled: false,
    checkedBy: '',
  },
  [AdvancedRestartOption.RecreateLocalDatabase]: {
    isChecked: false,
    isDisabled: installer.isRunning,
    checkedBy: '',
  },
  [AdvancedRestartOption.RestartDockers]: {
    isChecked: false,
    isDisabled: !config.isServerInstalled,
    checkedBy: '',
  },
  [AdvancedRestartOption.ResyncBiddingDataOnCloudMachine]: {
    isChecked: false,
    isDisabled: !config.isServerInstalled,
    checkedBy: '',
  },
  [AdvancedRestartOption.ResyncBitcoinBlocksOnCloudMachine]: {
    isChecked: false,
    isDisabled: !config.isServerInstalled,
    checkedBy: '',
  },
  [AdvancedRestartOption.ResyncArgonBlocksOnCloudMachine]: {
    isChecked: false,
    isDisabled: !config.isServerInstalled,
    checkedBy: '',
  },
  [AdvancedRestartOption.CompletelyWipeAndReinstallCloudMachine]: {
    isChecked: false,
    isDisabled: !config.isServerInstalled && !installer.isRunning,
    checkedBy: '',
  },
});

function handleSubOption(key: keyof typeof options.value, subKey: keyof typeof options.value, isChecked: boolean) {
  const option = options.value[key];
  const subOption = options.value[subKey];

  if (isChecked) {
    subOption.checkedBy = subOption.isChecked ? subOption.checkedBy : key;
    subOption.isChecked = true;
  } else {
    if (subOption.checkedBy === key) {
      subOption.isChecked = false;
      subOption.checkedBy = '';
    }
  }
}

function toggleOption(key: AdvancedRestartOption) {
  const isChecked = !options.value[key].isChecked;
  options.value[key].isChecked = isChecked;
  options.value[key].checkedBy = isChecked ? 'user' : '';

  if (key === AdvancedRestartOption.RecreateLocalDatabase) {
    handleSubOption(AdvancedRestartOption.RecreateLocalDatabase, AdvancedRestartOption.ReloadAppUi, isChecked);
  } else if (key === AdvancedRestartOption.RestartDockers) {
    handleSubOption(AdvancedRestartOption.RestartDockers, AdvancedRestartOption.ReloadAppUi, isChecked);
  } else if (key === AdvancedRestartOption.ResyncBiddingDataOnCloudMachine) {
    handleSubOption(
      AdvancedRestartOption.ResyncBiddingDataOnCloudMachine,
      AdvancedRestartOption.RestartDockers,
      isChecked,
    );
  } else if (key === AdvancedRestartOption.ResyncBitcoinBlocksOnCloudMachine) {
    handleSubOption(
      AdvancedRestartOption.ResyncBitcoinBlocksOnCloudMachine,
      AdvancedRestartOption.RestartDockers,
      isChecked,
    );
  } else if (key === AdvancedRestartOption.ResyncArgonBlocksOnCloudMachine) {
    handleSubOption(
      AdvancedRestartOption.ResyncArgonBlocksOnCloudMachine,
      AdvancedRestartOption.RestartDockers,
      isChecked,
    );
    handleSubOption(
      AdvancedRestartOption.ResyncArgonBlocksOnCloudMachine,
      AdvancedRestartOption.ResyncBiddingDataOnCloudMachine,
      isChecked,
    );
  } else if (key === AdvancedRestartOption.CompletelyWipeAndReinstallCloudMachine) {
    handleSubOption(
      AdvancedRestartOption.CompletelyWipeAndReinstallCloudMachine,
      AdvancedRestartOption.ReloadAppUi,
      isChecked,
    );
    handleSubOption(
      AdvancedRestartOption.CompletelyWipeAndReinstallCloudMachine,
      AdvancedRestartOption.RecreateLocalDatabase,
      isChecked,
    );
    handleSubOption(
      AdvancedRestartOption.CompletelyWipeAndReinstallCloudMachine,
      AdvancedRestartOption.RestartDockers,
      isChecked,
    );
    handleSubOption(
      AdvancedRestartOption.CompletelyWipeAndReinstallCloudMachine,
      AdvancedRestartOption.ResyncBiddingDataOnCloudMachine,
      isChecked,
    );
    handleSubOption(
      AdvancedRestartOption.CompletelyWipeAndReinstallCloudMachine,
      AdvancedRestartOption.ResyncBitcoinBlocksOnCloudMachine,
      isChecked,
    );
    handleSubOption(
      AdvancedRestartOption.CompletelyWipeAndReinstallCloudMachine,
      AdvancedRestartOption.ResyncArgonBlocksOnCloudMachine,
      isChecked,
    );
  }
}

async function runSelectedOptions() {
  isRestarting.value = true;
  const toRestart = new Set<AdvancedRestartOption>();
  for (const [key, { isChecked }] of Object.entries(options.value)) {
    if (isChecked) {
      toRestart.add(key as AdvancedRestartOption);
    }
  }
  await restarter.run(toRestart);
  isRestarting.value = false;
}

function updateDisabledOptions() {
  if (!installer.isRunning && !bot.isSyncing) return;

  options.value[AdvancedRestartOption.RestartDockers].isDisabled = true;
  options.value[AdvancedRestartOption.ResyncBiddingDataOnCloudMachine].isDisabled = true;
  options.value[AdvancedRestartOption.ResyncBitcoinBlocksOnCloudMachine].isDisabled = true;
  options.value[AdvancedRestartOption.ResyncArgonBlocksOnCloudMachine].isDisabled = true;
}

Vue.watch(() => installer.isRunning, updateDisabledOptions, { immediate: true });
Vue.watch(() => bot.isSyncing, updateDisabledOptions, { immediate: true });
</script>
