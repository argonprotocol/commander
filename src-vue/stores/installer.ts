import { useConfig, type Config } from './config';
import Installer from '../lib/Installer';
import handleUnknownFatalError from './helpers/handleUnknownFatalError';

let installer: Installer;

export type { Installer };

export function useInstaller(): Installer {
  if (!installer) {
    const config = useConfig();
    installer = new Installer(config as Config);
    installer.load().catch(handleUnknownFatalError);
  }

  return installer;
};