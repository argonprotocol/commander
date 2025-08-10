<template>
  <div class="px-4">
    <p class="text-md font-light pt-2 pb-1">
      There are multiple restart options available. It begins with a simple relaod of the app, but you can go as far as
      completely wiping and reinstalling your cloud machine.
    </p>
    <ol>
      <li>
        <header
          @click="toggleOption(Option.ReloadAppUi)"
          class="flex flex-row items-center space-x-2 font-bold mt-2 cursor-pointer"
        >
          <Checkbox :isChecked="options[Option.ReloadAppUi].isChecked" :size="5" />
          <span>Reload App Interface</span>
        </header>
        <p class="ml-7 text-md font-light">This refreshes the UI. It does not affect the server or the database.</p>
      </li>
      <li :class="[options[Option.RecreateLocalDatabase].isDisabled ? 'opacity-50 pointer-events-none' : '']">
        <header
          @click="toggleOption(Option.RecreateLocalDatabase)"
          class="flex flex-row items-center space-x-2 font-bold mt-2 cursor-pointer"
        >
          <Checkbox :isChecked="options[Option.RecreateLocalDatabase].isChecked" :size="5" />
          <span>Recreate App Database</span>
        </header>
        <p class="ml-7 text-md font-light">
          This deletes your local database and resyncs from the server. This is sometimes helpful if data structure has
          gotten out of sync between the server and your app.
        </p>
      </li>
      <li :class="[options[Option.RestartDockers].isDisabled ? 'opacity-50 pointer-events-none' : '']">
        <header
          @click="toggleOption(Option.RestartDockers)"
          class="flex flex-row items-center space-x-2 font-bold mt-2 cursor-pointer"
        >
          <Checkbox :isChecked="options[Option.RestartDockers].isChecked" :size="5" />
          <span>Restart Dockers on Cloud Machine</span>
        </header>
        <p class="ml-7 text-md font-light">
          This restarts your bitcoin and argon nodes as well as your bidding bot. No data will be touched. This can
          sometimes fix issues where one of the server processes is stuck.
        </p>
      </li>

      <li :class="[options[Option.ResyncBiddingDataOnCloudMachine].isDisabled ? 'opacity-50 pointer-events-none' : '']">
        <header
          @click="toggleOption(Option.ResyncBiddingDataOnCloudMachine)"
          class="flex flex-row items-center space-x-2 font-bold mt-2 cursor-pointer"
        >
          <Checkbox :isChecked="options[Option.ResyncBiddingDataOnCloudMachine].isChecked" :size="5" />
          <span>Resync Bidding Data on Cloud Machine</span>
        </header>
        <p class="ml-7 text-md font-light">
          This will delete the data on your cloud machine and recreate it from data on the Argon mainchain.
        </p>
      </li>

      <li
        :class="[options[Option.ResyncBitcoinBlocksOnCloudMachine].isDisabled ? 'opacity-50 pointer-events-none' : '']"
      >
        <header
          @click="toggleOption(Option.ResyncBitcoinBlocksOnCloudMachine)"
          class="flex flex-row items-center space-x-2 font-bold mt-2 cursor-pointer"
        >
          <Checkbox :isChecked="options[Option.ResyncBitcoinBlocksOnCloudMachine].isChecked" :size="5" />
          <span>Resync Bitcoin Block Data on Cloud Machine</span>
        </header>
        <p class="ml-7 text-md font-light">
          This will shutdown and restart your server. No data will be touched. This can sometimes fix issues where the
          server has run into a bug and is stuck.
        </p>
      </li>

      <li :class="[options[Option.ResyncArgonBlocksOnCloudMachine].isDisabled ? 'opacity-50 pointer-events-none' : '']">
        <header
          @click="toggleOption(Option.ResyncArgonBlocksOnCloudMachine)"
          class="flex flex-row items-center space-x-2 font-bold mt-2 cursor-pointer"
        >
          <Checkbox :isChecked="options[Option.ResyncArgonBlocksOnCloudMachine].isChecked" :size="5" />
          <span>Resync Argon Block Data on Cloud Machine</span>
        </header>
        <p class="ml-7 text-md font-light">
          This will shutdown and restart your server. No data will be touched. This can sometimes fix issues where the
          server has run into a bug and is stuck.
        </p>
      </li>

      <li
        :class="[
          options[Option.CompletelyWipeAndReinstallCloudMachine].isDisabled ? 'opacity-50 pointer-events-none' : '',
        ]"
      >
        <header
          @click="toggleOption(Option.CompletelyWipeAndReinstallCloudMachine)"
          class="flex flex-row items-center space-x-2 font-bold mt-2 cursor-pointer"
        >
          <Checkbox :isChecked="options[Option.CompletelyWipeAndReinstallCloudMachine].isChecked" :size="5" />
          <span>Completely Wipe and Reinstall Cloud Machine</span>
        </header>
        <p class="ml-7 text-md font-light">
          This will shutdown and restart your server. No data will be touched. This can sometimes fix issues where the
          server has run into a bug and is stuck.
        </p>
      </li>
    </ol>

    <button
      @click="runSelectedOptions"
      class="w-full bg-argon-button text-white py-2 rounded-lg mt-4 mb-3 cursor-pointer focus:outline-none"
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

const config = useConfig();
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

function runSelectedOptions() {
  restarter.run();
}
</script>
