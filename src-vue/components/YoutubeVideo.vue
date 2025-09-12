<template>
  <div>
    <iframe
      class="aspect-video w-full rounded-md border border-black/40 object-contain"
      :src="`https://www.youtube-nocookie.com/embed/${videoId}?rel=0&fs=0`"
      :title="title"
      frameborder="0"
      allow="clipboard-write; encrypted-media; web-share"
      referrerpolicy="strict-origin-when-cross-origin"
      allowfullscreen></iframe>
    <button
      @click="openYouTubePopout($event)"
      class="mt-4 ml-auto flex cursor-pointer flex-row flex-nowrap items-center justify-center gap-3 rounded-md bg-[#A600D4] px-4 py-2 text-center text-sm font-bold text-white hover:bg-[#8700b8]">
      Open in New Window
      <PopoutIcon class="inline-flex w-5 text-white" />
    </button>
  </div>
</template>
<script lang="ts">
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
// put this in one-per-load context
let youtubeVideo: WebviewWindow | null = null;
</script>
<script setup lang="ts">
import PopoutIcon from '../assets/popout.svg?component';

const props = defineProps<{
  videoId: string;
  title: string;
}>();

function openYouTubePopout(event: Event) {
  if (youtubeVideo) {
    try {
      youtubeVideo.close();
      return;
    } catch (e) {
      console.error('error closing youtube video', e);
    }
  }
  event.preventDefault();
  event.stopPropagation();
  youtubeVideo = new WebviewWindow(`popup-youtube`, {
    url: `/popup-youtube.html?vid=${encodeURIComponent(props.videoId)}`,
    width: 420,
    height: 236,
    decorations: true,
    transparent: true,
    alwaysOnTop: true,
    hiddenTitle: false,
    titleBarStyle: 'overlay',
    resizable: true,
    visible: true,
    focus: true,
  });
  youtubeVideo.once('tauri://close-requested', () => {
    youtubeVideo = null;
  });

  youtubeVideo.once('tauri://created', () => {});
  youtubeVideo.once('tauri://error', e => console.error('popout error', e));
  return false;
}
</script>
