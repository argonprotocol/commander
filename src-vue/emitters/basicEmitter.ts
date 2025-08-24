import mitt, { type Emitter } from 'mitt';
import { ComputedRef } from 'vue';
import Importer from '../lib/Importer';

type IBasicEmitter = {
  openWalletOverlay: { walletId: string; screen: string };
  openBotOverlay: void;
  openServerRemoveOverlay: void;
  openSecuritySettingsOverlay: void;
  openVaultOverlay: void;
  showTooltip: {
    parentLeft: number;
    parentTop: number;
    parentWidth: number;
    parentHeight: number;
    label: string | ComputedRef<string>;
    width: 'parent' | 'auto' | 'auto-plus';
    widthPlus: number;
    horizontalPosition: 'left' | 'center' | 'right';
    verticalPosition: 'above' | 'below';
  };
  hideTooltip: void;
  openProvisioningCompleteOverlay: void;
  openServerConnectOverlay: void;
  closeAllOverlays: void;
  openServerConfigureOverlay: void;
  openAboutOverlay: void;
  openComplianceOverlay: void;
  openTroubleshootingOverlay: {
    screen: 'server-diagnostics' | 'data-and-log-files' | 'options-for-restart';
  };
  openImportingOverlay: { importer: Importer; dataRaw: string };
  openCheckForAppUpdatesOverlay: void;
};

const basicEmitter: Emitter<IBasicEmitter> = mitt<IBasicEmitter>();

export default basicEmitter;
