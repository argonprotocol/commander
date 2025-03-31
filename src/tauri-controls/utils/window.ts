import type { window } from "@tauri-apps/api"
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ref } from "vue"

export const appWindow = ref<window.Window | null>(null)
export const isWindowMaximized = ref(false)

appWindow.value = getCurrentWindow();
appWindow.value.onResized(async () => {
  const isMaximized = await appWindow.value?.isMaximized()
  if (isMaximized !== undefined) {
    isWindowMaximized.value = isMaximized
  }
});

export const minimizeWindow = async () => {
  await appWindow.value?.minimize()
}

export const maximizeWindow = async () => {
  await appWindow.value?.toggleMaximize()
}

export const fullscreenWindow = async () => {
  if (appWindow) {
    const fullscreen = await appWindow.value?.isFullscreen()
    await appWindow.value?.setFullscreen(!fullscreen)
  }
}

export const closeWindow = async () => {
  await appWindow.value?.close()
}
