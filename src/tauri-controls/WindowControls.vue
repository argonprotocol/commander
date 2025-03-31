<script setup lang="ts">
import { twMerge } from "tailwind-merge"
import { onMounted } from "vue"
import { platform as getPlatform } from '@tauri-apps/plugin-os';
import Gnome from "./controls/linux/Gnome.vue"
import MacOs from "./controls/MacOs.vue"
import Windows from "./controls/Windows.vue"
import type { WindowControlsProps } from "./types"

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(defineProps<WindowControlsProps>(), {
  justify: false,
  hide: false,
  hideMethod: "display",
  className: "",
})

let platform = props.platform;

if (!platform) {
  const platformType = getPlatform();
  switch (platformType) {
    case "macos":
      platform = "macos"
      break
    case "linux":
      platform = "gnome"
      break
    default:
      platform = "windows"
  }
}

const customClass = twMerge(
  "flex",
  props.className,
  props.hide && (props.hideMethod === "display" ? "hidden" : "invisible")
);
</script>

<template>
  <Windows
    v-if="platform === 'windows'"
    :class="twMerge(customClass, props.justify && 'ml-auto')"
  />
  <MacOs
    v-else-if="platform === 'macos'"
    :class="twMerge(customClass, props.justify && 'ml-0')"
  />
  <Gnome
    v-else-if="platform === 'gnome'"
    :class="twMerge(customClass, props.justify && 'ml-auto')"
  />
  <Windows v-else :class="twMerge(customClass, props.justify && 'ml-auto')" />
</template>
