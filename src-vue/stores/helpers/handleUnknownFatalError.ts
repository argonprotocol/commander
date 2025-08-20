import { message as tauriMessage } from '@tauri-apps/plugin-dialog';

let hasUnknownFatalError = false;

export default async function handleUnknownFatalError(error?: Error) {
  console.error(`Unknown error occurred`, error);

  if (hasUnknownFatalError) return;
  hasUnknownFatalError = true;

  await tauriMessage('An unknown server error occurred. Please restart the application.', {
    title: 'Unknown Server Error',
    kind: 'error',
  });
}
