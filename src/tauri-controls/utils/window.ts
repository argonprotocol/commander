import type { window } from "@tauri-apps/api"
import { getCurrentWindow } from "@tauri-apps/api/window";
import { platform as getPlatform } from '@tauri-apps/plugin-os';
import { ref } from "vue"

// Throttle utility function
function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false;

  return function(this: any, ...args: Parameters<T>): void {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

export const appWindow = ref<window.Window | null>(null)
export const isWindowMaximized = ref(false)
export const isWindowFullscreen = ref(false)
export const platformType = getPlatformType();

appWindow.value = getCurrentWindow();
appWindow.value.onResized(throttle(async () => {
  const isFullscreen = await getCurrentWindow().isFullscreen();
  isWindowFullscreen.value = isFullscreen;

  if (platformType !== "macos") {
    const isMaximized = await appWindow.value?.isMaximized()
    if (isMaximized !== undefined) {
      isWindowMaximized.value = isMaximized
    }
  }
}, 100));

export const minimizeWindow = async () => {
  await appWindow.value?.minimize()
}

export const maximizeWindow = async () => {
  await appWindow.value?.toggleMaximize()
}

export const fullscreenWindow = async () => {
  if (appWindow) {
    const fullscreen = await appWindow.value?.isFullscreen();
    await appWindow.value?.setFullscreen(!fullscreen);
  }
}

export const closeWindow = async () => {
  await appWindow.value?.close()
}

function getPlatformType() {
  switch (getPlatform()) {
    case "macos":
      return "macos"
    case "linux":
      return "gnome"
    default:
      return "windows"
  }
}
