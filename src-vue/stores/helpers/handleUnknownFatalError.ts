import { message } from '@tauri-apps/plugin-dialog';

export default async function handleUnknownFatalError(error?: Error) {
  if (error) {
    console.error(error);
  }

  await message('An unknown server error occurred. Please restart the application.', {
    title: 'Unknown Server Error',
    kind: 'error',
  });
}
