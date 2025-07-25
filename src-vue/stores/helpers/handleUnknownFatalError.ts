import { message } from '@tauri-apps/plugin-dialog';

let hasUnknownFatalError = false;

export default async function handleUnknownFatalError(error?: Error) {
  console.error(error);

  if (hasUnknownFatalError) return;
  hasUnknownFatalError = true;

  await message('An unknown server error occurred. Please restart the application.', {
    title: 'Unknown Server Error',
    kind: 'error',
  });
}
