import { mnemonicGenerate } from '@argonprotocol/mainchain';
import ISecurity from './src-vue/interfaces/ISecurity';

globalThis.__ARGON_NETWORK_NAME__ = 'dev-docker';
globalThis.__COMMANDER_INSTANCE__ = 'test-instance';
globalThis.__COMMANDER_ENABLE_AUTOUPDATE__ = false;
globalThis.__COMMANDER_SECURITY__ = {
  masterMnemonic: mnemonicGenerate(),
  sshPrivateKeyPath: '',
  sshPublicKey: '',
} as ISecurity;
