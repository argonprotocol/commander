import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { ask } from '@tauri-apps/plugin-dialog';

let existingCheck = false;
export async function checkForUpdates(onProgress?: (percent: number) => void) {
  if (existingCheck) {
    return;
  }
  existingCheck = true;
  try {
    const update = await check();
    if (update) {
      const yes = await ask(
        `Update to ${update.version} is available!\n\nRelease notes: ${update.body}`,
        {
          title: 'Update Available',
          kind: 'info',
          okLabel: 'Update Now',
          cancelLabel: 'Cancel',
        },
      );
      if (!yes) {
        return;
      }

      let downloaded = 0;
      let contentLength = 0;
      // alternatively we could also call update.download() and update.install() separately
      await update.downloadAndInstall(event => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength ?? 0;
            console.log(`started downloading ${event.data.contentLength} bytes`);
            break;
          case 'Progress':
            downloaded += event.data.chunkLength;
            onProgress?.(downloaded / contentLength);
            console.log(`downloaded ${downloaded} from ${contentLength}`);
            break;
          case 'Finished':
            console.log('download finished');
            onProgress?.(1);
            break;
        }
      });

      console.log('update installed');
      await relaunch();
    }
  } catch (e) {
    console.error('Error checking for updates', e);
  } finally {
    existingCheck = false;
  }
}
