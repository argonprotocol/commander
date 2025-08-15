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
          @click="toggleOption(Option.ReloadAppUi)"
          class="mt-2 flex cursor-pointer flex-row items-center space-x-2 font-bold"
        >
          <Checkbox :isChecked="options[Option.ReloadAppUi].isChecked" :size="5" />
          <span>Reload App Interface</span>
        </header>
        <p class="text-md ml-7 font-light">This refreshes the UI. It does not affect the server or the database.</p>
      </li>
      <li :class="[options[Option.RecreateLocalDatabase].isDisabled ? 'pointer-events-none opacity-50' : '']">
        <header
          @click="toggleOption(Option.RecreateLocalDatabase)"
          class="mt-2 flex cursor-pointer flex-row items-center space-x-2 font-bold"
        >
          <Checkbox :isChecked="options[Option.RecreateLocalDatabase].isChecked" :size="5" />
          <span>Recreate App Database</span>
        </header>
        <p class="text-md ml-7 font-light">
          This deletes your local database and resyncs from the server. This is sometimes helpful if data structure has
          gotten out of sync between the server and your app.
        </p>
      </li>
      <li :class="[options[Option.RestartDockers].isDisabled ? 'pointer-events-none opacity-50' : '']">
        <header
          @click="toggleOption(Option.RestartDockers)"
          class="mt-2 flex cursor-pointer flex-row items-center space-x-2 font-bold"
        >
          <Checkbox :isChecked="options[Option.RestartDockers].isChecked" :size="5" />
          <span>Restart Dockers on Cloud Machine</span>
        </header>
        <p class="text-md ml-7 font-light">
          This restarts your bitcoin and argon nodes as well as your bidding bot. No data will be touched. This can
          sometimes fix issues where one of the server processes is stuck.
        </p>
      </li>

      <li :class="[options[Option.ResyncBiddingDataOnCloudMachine].isDisabled ? 'pointer-events-none opacity-50' : '']">
        <header
          @click="toggleOption(Option.ResyncBiddingDataOnCloudMachine)"
          class="mt-2 flex cursor-pointer flex-row items-center space-x-2 font-bold"
        >
          <Checkbox :isChecked="options[Option.ResyncBiddingDataOnCloudMachine].isChecked" :size="5" />
          <span>Resync Bidding Data on Cloud Machine</span>
        </header>
        <p class="text-md ml-7 font-light">
          This will delete the data on your cloud machine and recreate it from data on the Argon mainchain.
        </p>
      </li>

      <li
        :class="[options[Option.ResyncBitcoinBlocksOnCloudMachine].isDisabled ? 'pointer-events-none opacity-50' : '']"
      >
        <header
          @click="toggleOption(Option.ResyncBitcoinBlocksOnCloudMachine)"
          class="mt-2 flex cursor-pointer flex-row items-center space-x-2 font-bold"
        >
          <Checkbox :isChecked="options[Option.ResyncBitcoinBlocksOnCloudMachine].isChecked" :size="5" />
          <span>Resync Bitcoin Node on Cloud Machine</span>
        </header>
        <p class="text-md ml-7 font-light">
          This will shutdown and restart your server. No data will be touched. This can sometimes fix issues where the
          server has run into a bug and is stuck.
        </p>
      </li>

      <li :class="[options[Option.ResyncArgonBlocksOnCloudMachine].isDisabled ? 'pointer-events-none opacity-50' : '']">
        <header
          @click="toggleOption(Option.ResyncArgonBlocksOnCloudMachine)"
          class="mt-2 flex cursor-pointer flex-row items-center space-x-2 font-bold"
        >
          <Checkbox :isChecked="options[Option.ResyncArgonBlocksOnCloudMachine].isChecked" :size="5" />
          <span>Resync Argon Node on Cloud Machine</span>
        </header>
        <p class="text-md ml-7 font-light">
          This will shutdown and restart your server. No data will be touched. This can sometimes fix issues where the
          server has run into a bug and is stuck.
        </p>
      </li>

      <li
        :class="[
          options[Option.CompletelyWipeAndReinstallCloudMachine].isDisabled ? 'pointer-events-none opacity-50' : '',
        ]"
      >
        <header
          @click="toggleOption(Option.CompletelyWipeAndReinstallCloudMachine)"
          class="mt-2 flex cursor-pointer flex-row items-center space-x-2 font-bold"
        >
          <Checkbox :isChecked="options[Option.CompletelyWipeAndReinstallCloudMachine].isChecked" :size="5" />
          <span>Completely Wipe and Reinstall Cloud Machine</span>
        </header>
        <p class="text-md ml-7 font-light">
          This will shutdown and restart your server. No data will be touched. This can sometimes fix issues where the
          server has run into a bug and is stuck.
        </p>
      </li>
    </ol>

    <button
      @click="runSelectedOptions"
      class="bg-argon-button mt-4 mb-3 w-full cursor-pointer rounded-lg py-2 text-white focus:outline-none"
    >
      Run Restart
    </button>
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import Checkbox from '../../components/Checkbox.vue';
import Restarter from '../../lib/Restarter';
import { getDbPromise } from '../../stores/helpers/dbPromise';
import { useConfig } from '../../stores/config';
import { useInstaller } from '../../stores/installer';
import { useBot } from '../../stores/bot';

const config = useConfig();
const installer = useInstaller();
const bot = useBot();

const dbPromise = getDbPromise();
const restarter = new Restarter(dbPromise);

enum Option {
  ReloadAppUi = 'ReloadAppUi',
  RecreateLocalDatabase = 'RecreateLocalDatabase',
  RestartDockers = 'RestartDockers',
  ResyncBiddingDataOnCloudMachine = 'ResyncBiddingDataOnCloudMachine',
  ResyncBitcoinBlocksOnCloudMachine = 'ResyncBitcoinBlocksOnCloudMachine',
  ResyncArgonBlocksOnCloudMachine = 'ResyncArgonBlocksOnCloudMachine',
  CompletelyWipeAndReinstallCloudMachine = 'CompletelyWipeAndReinstallCloudMachine',
}

const options = Vue.ref({
  [Option.ReloadAppUi]: {
    isChecked: false,
    isDisabled: false,
    checkedBy: '',
  },
  [Option.RecreateLocalDatabase]: {
    isChecked: false,
    isDisabled: false,
    checkedBy: '',
  },
  [Option.RestartDockers]: {
    isChecked: false,
    isDisabled: !config.isServerInstalled,
    checkedBy: '',
  },
  [Option.ResyncBiddingDataOnCloudMachine]: {
    isChecked: false,
    isDisabled: !config.isServerInstalled,
    checkedBy: '',
  },
  [Option.ResyncBitcoinBlocksOnCloudMachine]: {
    isChecked: false,
    isDisabled: !config.isServerInstalled,
    checkedBy: '',
  },
  [Option.ResyncArgonBlocksOnCloudMachine]: {
    isChecked: false,
    isDisabled: !config.isServerInstalled,
    checkedBy: '',
  },
  [Option.CompletelyWipeAndReinstallCloudMachine]: {
    isChecked: false,
    isDisabled: !config.isServerInstalled,
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

function toggleOption(key: Option) {
  const isChecked = !options.value[key].isChecked;
  options.value[key].isChecked = isChecked;
  options.value[key].checkedBy = isChecked ? 'user' : '';

  if (key === Option.RecreateLocalDatabase) {
    handleSubOption(Option.RecreateLocalDatabase, Option.ReloadAppUi, isChecked);
  } else if (key === Option.RestartDockers) {
    handleSubOption(Option.RestartDockers, Option.ReloadAppUi, isChecked);
  } else if (key === Option.ResyncBiddingDataOnCloudMachine) {
    handleSubOption(Option.ResyncBiddingDataOnCloudMachine, Option.RestartDockers, isChecked);
  } else if (key === Option.ResyncBitcoinBlocksOnCloudMachine) {
    handleSubOption(Option.ResyncBitcoinBlocksOnCloudMachine, Option.RestartDockers, isChecked);
  } else if (key === Option.ResyncArgonBlocksOnCloudMachine) {
    handleSubOption(Option.ResyncArgonBlocksOnCloudMachine, Option.RestartDockers, isChecked);
    handleSubOption(Option.ResyncArgonBlocksOnCloudMachine, Option.ResyncBiddingDataOnCloudMachine, isChecked);
  } else if (key === Option.CompletelyWipeAndReinstallCloudMachine) {
    handleSubOption(Option.CompletelyWipeAndReinstallCloudMachine, Option.ReloadAppUi, isChecked);
    handleSubOption(Option.CompletelyWipeAndReinstallCloudMachine, Option.RecreateLocalDatabase, isChecked);
    handleSubOption(Option.CompletelyWipeAndReinstallCloudMachine, Option.RestartDockers, isChecked);
    handleSubOption(Option.CompletelyWipeAndReinstallCloudMachine, Option.ResyncBiddingDataOnCloudMachine, isChecked);
    handleSubOption(Option.CompletelyWipeAndReinstallCloudMachine, Option.ResyncBitcoinBlocksOnCloudMachine, isChecked);
    handleSubOption(Option.CompletelyWipeAndReinstallCloudMachine, Option.ResyncArgonBlocksOnCloudMachine, isChecked);
  }
}

async function runSelectedOptions() {
  await restarter.run();
}

function updateDisabledOptions() {
  if (!installer.isRunning && !bot.isSyncing) return;

  options.value[Option.RestartDockers].isDisabled = true;
  options.value[Option.ResyncBiddingDataOnCloudMachine].isDisabled = true;
  options.value[Option.ResyncBitcoinBlocksOnCloudMachine].isDisabled = true;
  options.value[Option.ResyncArgonBlocksOnCloudMachine].isDisabled = true;
}

Vue.watch(() => installer.isRunning, updateDisabledOptions, { immediate: true });
Vue.watch(() => bot.isSyncing, updateDisabledOptions, { immediate: true });
</script>
