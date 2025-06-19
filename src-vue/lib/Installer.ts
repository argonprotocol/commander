import { SSH } from './SSH';
import {
  InstallStepErrorType,
  InstallStepStatus,
  InstallStepKey,
  type IConfigInstallStep,
} from '../interfaces/IConfig';
import { Config, DEPLOY_ENV_FILE, NETWORK_NAME } from './Config';
import { app } from '@tauri-apps/api';
import { invoke } from '@tauri-apps/api/core';
import { InstallerCheck } from './InstallerCheck';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

let IS_INITIALIZED = false;

export function resetInstaller(): void {
  IS_INITIALIZED = false;
}

export default class Installer {
  public isFreshInstall: boolean = false;
  public remoteFilesNeedUpdating: boolean = false;

  public isLoaded: boolean = false;
  public isLoadedPromise: Promise<void>;
  public isRunnable: boolean = false;

  public isRunning = false;

  public reasonToSkipInstall: string = '';
  public reasonToSkipInstallData: any = null;

  private hasApprovedUpgrade = false;

  private loadingFns!: { resolve: () => void; reject: (error: Error) => void };
  private config: Config;
  private installerCheck: InstallerCheck;

  constructor(config: Config) {
    if (IS_INITIALIZED) throw new Error('Installer already initialized');
    IS_INITIALIZED = true;

    this.config = config;
    this.installerCheck = new InstallerCheck(config);

    this.isLoadedPromise = new Promise((resolve, reject) => {
      this.loadingFns = { resolve, reject };
    });
  }

  public async load(): Promise<void> {
    await this.config.isLoadedPromise;

    this.isLoaded = true;
    this.loadingFns.resolve();
  }

  public async run(): Promise<boolean> {
    await this.isLoadedPromise;

    if ((this.isRunning ||= await this.calculateIsRunning())) {
      console.log('CANNOT run because Installer is already running');
      return false;
    }

    if (!(this.isRunnable ||= await this.calculateIsRunnable(false))) {
      console.log(
        'CANNOT run because Installer is not runnable',
        this.reasonToSkipInstall,
        this.reasonToSkipInstallData,
      );
      this.isRunning = false;
      return false;
    }

    if (this.reasonToSkipInstall) {
      console.info('Skipping Installer:', this.reasonToSkipInstall, this.reasonToSkipInstallData);
      this.isRunning = false;
      return false;
    }

    try {
      await SSH.ensureConnection(this.config.serverDetails);

      this.config.isWaitingForUpgradeApproval = false;
      this.config.isServerUpToDate = false;
      await this.config.save();

      console.info('Starting install process');
      await this.startInstallSteps();
    } catch (e) {
      console.error(`Installer failed: ${e}`);
      this.isRunning = false;
      throw e;
    }

    return true;
  }

  public async runFailedStep(stepKey: string): Promise<void> {
    await this.isLoadedPromise;

    if ((this.isRunning ||= await this.calculateIsRunning())) {
      console.log('CANNOT runFailedStep because install is already running');
      return;
    }

    await this.clearStepFiles([stepKey], { setFirstStepToWorking: true });

    for (const step of Object.values(this.config.installDetails) as any) {
      if (!step?.status) continue;
      if (step.status === InstallStepStatus.Hidden) {
        step.status = InstallStepStatus.Pending;
        step.startDate = dayjs.utc().toISOString();
      }
    }
    this.config.installDetails = this.config.installDetails;
    await this.config.save();

    this.installerCheck.clearCachedFilenames();
    this.installerCheck.bypassCachedFilenames = false;

    this.removeReasonsToSkipInstall();
    this.run();
  }

  public async runUpgrade(): Promise<void> {
    await this.isLoadedPromise;

    if ((this.isRunning ||= await this.calculateIsRunning())) {
      console.log('CANNOT runFailedStep because install is already running');
      return;
    }

    this.hasApprovedUpgrade = true;

    console.info('Clearing step files');
    const stepsToClear = [
      InstallStepErrorType.FileCheck,
      InstallStepErrorType.BitcoinInstall,
      InstallStepErrorType.ArgonInstall,
      InstallStepErrorType.MiningLaunch,
    ];
    await this.clearStepFiles(stepsToClear, { setFirstStepToWorking: true });

    this.installerCheck.clearCachedFilenames();
    this.installerCheck.bypassCachedFilenames = false;

    this.removeReasonsToSkipInstall();
    this.config.resetField('installDetails');
    this.config.isWaitingForUpgradeApproval = false;
    await this.config.save();

    this.run();
  }

  public async upgradeBiddingBotFiles(): Promise<void> {
    await this.isLoadedPromise;
    console.log('Upgrading bidding bot files');

    if ((this.isRunning ||= await this.calculateIsRunning())) {
      console.log('CANNOT runFailedStep because install is already running');
      return;
    }

    this.isRunning = true;
    try {
      this.config.isServerReadyForBidding = true;
      await this.uploadBotConfigFiles();
      await this.restartBotDocker();
    } catch (e) {
      console.error(`Failed to upgrade bidding bot files: ${e}`);
      throw e;
    } finally {
      this.isRunning = false;
    }

    await this.config.save();
  }

  public async calculateIsRunnable(checkIfIsRunning: boolean = true): Promise<boolean> {
    await this.isLoadedPromise;
    this.reasonToSkipInstall = '';
    this.reasonToSkipInstallData = {};

    if (!this.config.isServerConnected) {
      this.reasonToSkipInstall = 'ServerNotConnected';
      this.reasonToSkipInstallData = { isServerConnected: this.config.isServerConnected };
      this.config.isServerUpToDate = false;
      this.config.isWaitingForUpgradeApproval = false;
      await this.config.save();
      this.isRunnable = false;
      return false;
    }

    const localFilesAreValid = await this.doLocalFilesMatchLocalShasums();
    if (!localFilesAreValid) {
      this.reasonToSkipInstall = 'LocalShasumsNotAccurate';
      this.reasonToSkipInstallData = { localFilesAreValid };
      await this.config.save();
      this.isRunnable = false;
      return false;
    }

    await SSH.ensureConnection(this.config.serverDetails);

    if (checkIfIsRunning) {
      // If the install process is currently running, we don't need to start it again.
      const installProcessIsRunning = await this.calculateIsRunning();
      if (installProcessIsRunning) {
        this.reasonToSkipInstall = 'InstallAlreadyRunning';
        this.reasonToSkipInstallData = { installProcessIsRunning };
        this.config.isWaitingForUpgradeApproval = false;
        await this.config.save();
        this.isRunnable = false;
        return false;
      }
    }

    // We will begin by running through a series of checks to determine if the install process
    // should be started. We don't use serverDetails.isInstalling because the local value could
    // be out of date with the server.
    const tmpInstallChecks = await this.extractTmpInstallChecks();
    const isFreshInstall = tmpInstallChecks.isFreshInstall;
    const isServerInstallComplete = tmpInstallChecks.isServerInstallComplete;
    const remoteFilesNeedUpdating = tmpInstallChecks.remoteFilesNeedUpdating;

    this.isFreshInstall = isFreshInstall;
    this.remoteFilesNeedUpdating = remoteFilesNeedUpdating;

    if (isServerInstallComplete && !remoteFilesNeedUpdating) {
      this.reasonToSkipInstall = 'ServerUpToDate';
      this.reasonToSkipInstallData = { isServerInstallComplete, remoteFilesNeedUpdating };
      this.config.isServerUpToDate = true;
      this.config.isWaitingForUpgradeApproval = false;
      await this.config.save();
      return false;
    }

    const requiresExplicitUpgradeApproval = isServerInstallComplete && !isFreshInstall && !this.config.isServerUpToDate;
    console.info('requiresExplicitUpgradeApproval =', requiresExplicitUpgradeApproval, {
      isServerInstallComplete,
      isFreshInstall,
      isServerUpToDate: this.config.isServerUpToDate,
      hasApprovedUpgrade: this.hasApprovedUpgrade,
    });

    if (requiresExplicitUpgradeApproval && !this.hasApprovedUpgrade) {
      this.reasonToSkipInstall = 'UpgradeRequiresApproval';
      this.reasonToSkipInstallData = {
        isServerInstallComplete,
        isFreshInstall,
        isServerUpToDate: this.config.isServerUpToDate,
      };
      this.config.isWaitingForUpgradeApproval = true;
      await this.config.save();
      return false;
    }

    if (isFreshInstall) {
      // If the server is fresh, we need to reset the install details, and we can't skip the install process
      // even if next two conditions are met.
      this.removeReasonsToSkipInstall();
      this.config.resetField('installDetails');
      this.config.isWaitingForUpgradeApproval = false;
      await this.config.save();
      return true;
    }

    console.log('this.installerCheck.hasError', this.installerCheck.hasError);
    if (this.installerCheck.hasError) {
      this.reasonToSkipInstall = 'InstallHasError';
      this.reasonToSkipInstallData = { hasInstallError: this.installerCheck.hasError };
      this.config.isServerUpToDate = false;
      await this.config.save();
      return false;
    }

    const isWaitingForMinersToSync = this.config.installDetails.MiningLaunch.progress > 0.0;
    if (isWaitingForMinersToSync && !remoteFilesNeedUpdating) {
      this.reasonToSkipInstall = 'MinersAreSyncing';
      this.reasonToSkipInstallData = { isWaitingForMinersToSync, remoteFilesNeedUpdating };
      await this.config.save();
      return false;
    }

    return true;
  }

  private removeReasonsToSkipInstall(): void {
    this.reasonToSkipInstall = '';
    this.reasonToSkipInstallData = {};
  }

  private async calculateIsRunning(): Promise<boolean> {
    if (this.isRunning) {
      console.log('Install process IS running 1');
      return true;
    }

    try {
      const [pid] = await SSH.runCommand('pgrep -f ~/scripts/install_server.sh');
      const isRunningRemotely = pid.trim() !== '';
      if (isRunningRemotely) {
        console.log('Install process IS running remotely');
      }
      this.isRunning = isRunningRemotely;
    } catch {
      this.isRunning = false;
    }

    return this.isRunning;
  }

  private async extractTmpInstallChecks(): Promise<TmpInstallChecks> {
    const isFreshInstall = !(await this.serverHasSha256File());

    if (isFreshInstall) {
      return {
        isFreshInstall,
        isServerInstallComplete: false,
        remoteFilesNeedUpdating: true,
      };
    }

    await this.installerCheck.updateInstallStatus();
    const isServerInstallComplete = this.installerCheck.isServerInstallComplete;
    const remoteFilesNeedUpdating = !(await this.doRemoteFilesMatchLocalShasums());

    return {
      isFreshInstall,
      isServerInstallComplete,
      remoteFilesNeedUpdating,
    };
  }

  private async doRemoteFilesMatchLocalShasums(): Promise<boolean> {
    const [remoteShasums] = await SSH.runCommand('cat ~/SHASUMS256.copied 2>/dev/null || true');
    const localShasums = await this.getLocalShasums();
    const remoteFilesMatchLocalShasums = localShasums === remoteShasums;
    console.info(`Remote files ${remoteFilesMatchLocalShasums ? 'DO' : 'do NOT'} match local shasums`);

    if (!remoteFilesMatchLocalShasums) {
      console.info(`Remote shasums: ${remoteShasums}`);
      console.info(`Local shasums: ${localShasums}`);
    }

    return remoteFilesMatchLocalShasums;
  }

  private async doLocalFilesMatchLocalShasums(): Promise<boolean> {
    const localShasums = await this.getLocalShasums();
    console.info(`Local shasums: ${localShasums}`);
    let dynamicShasums = '';

    for (const dirName of CORE_DIRS) {
      const shasum = await invoke('create_shasum', { dirName });

      if (dynamicShasums !== '') {
        dynamicShasums += '\n';
      }
      dynamicShasums += `${dirName} ${shasum}`;
    }

    const localTrimmed = localShasums.trim();
    const dynamicTrimmed = dynamicShasums.trim();
    const localLines = localTrimmed.split('\n');
    const dynamicLines = dynamicTrimmed.split('\n');

    for (let i = 0; i < localLines.length; i++) {
      if (localLines[i] !== dynamicLines[i]) {
        console.info(`Mismatch at line ${i + 1}:`);
        console.info(`  Local:   ${localLines[i]}`);
        console.info(`  Dynamic: ${dynamicLines[i]}`);
      }
    }

    const shasumsMatch = localTrimmed === dynamicTrimmed;
    console.info(`Local files match local shasums = ${shasumsMatch}`);

    return shasumsMatch;
  }

  private async startInstallSteps(): Promise<void> {
    this.installerCheck.start();

    let errorMessage = '';

    try {
      if (this.remoteFilesNeedUpdating) {
        const stepsToClear = [
          InstallStepErrorType.FileCheck,
          InstallStepErrorType.BitcoinInstall,
          InstallStepErrorType.ArgonInstall,
          InstallStepErrorType.MiningLaunch,
        ];
        console.info('Clearing step files');
        await this.clearStepFiles(stepsToClear, { setFirstStepToWorking: true });

        console.info('Uploading sha256');
        await this.uploadSha256();

        console.info('Uploading core files');
        await this.uploadCoreFiles();
      }

      console.info('Uploading bot config files');
      await this.uploadBotConfigFiles();

      console.info('Starting remote script');
      await this.startRemoteScript();

      this.installerCheck.bypassCachedFilenames = true;

      console.info('Waiting for install to complete');
      await this.installerCheck.waitForInstallToComplete();

      console.info('Confirming all install flags');
      this.isRunning = false;
      this.remoteFilesNeedUpdating = false;
      this.config.isServerUpToDate = false;
      await this.config.save();
      console.info('Installer finished');
    } catch (e) {
      console.error(`Installation failed: ${e}`);
      errorMessage = `Installation failed: ${e}`;
    }

    if (errorMessage) {
      try {
        this.config.installDetails.errorType = InstallStepErrorType.Unknown;
        this.config.installDetails.errorMessage = errorMessage;
        await this.config.save();
      } catch (e) {
        console.error(`Failed to save install status: ${e}`);
      }
    }

    this.isRunning = false;
  }

  private async serverHasSha256File(): Promise<boolean> {
    const [, code] = await SSH.runCommand('test -f ~/SHASUMS256');
    return code === 0;
  }

  private async uploadSha256(): Promise<void> {
    const localShasums = await this.getLocalShasums();
    await SSH.uploadFile(localShasums, '~/SHASUMS256');
    await SSH.runCommand('rm ~/SHASUMS256.copied');
  }

  private async uploadCoreFiles(): Promise<void> {
    for (const localDir of CORE_DIRS) {
      console.log(`UPLOADING ${localDir}`);
      const remoteDir = `~/${localDir}`;
      await SSH.runCommand(`rm -rf ${remoteDir}`);
      await SSH.uploadDirectory(app, localDir, remoteDir);
    }

    await SSH.runCommand('~/scripts/update_shasums.sh SHASUMS256.copied');
  }

  private async uploadBotConfigFiles(): Promise<void> {
    const biddingRulesStr = JSON.stringify(this.config.biddingRules);
    if (!biddingRulesStr) return;

    const envSecurity = `SESSION_KEYS_MNEMONIC="${this.config.security.sessionMnemonic}"\n` + `KEYPAIR_PASSPHRASE=`;
    const envState =
      `OLDEST_FRAME_ID_TO_SYNC=${this.config.serverDetails.oldestFrameIdToSync || ''}\n` +
      `IS_READY_FOR_BIDDING=${this.config.isServerReadyForBidding}\n`;

    const files = [
      [this.config.security.walletJson, '~/config/wallet.json'],
      [biddingRulesStr, '~/config/biddingRules.json'],
      [envSecurity, '~/config/.env.security'],
      [envState, '~/config/.env.state'],
    ];

    await SSH.runCommand('mkdir -p config');

    for (const [content, path] of files) {
      await SSH.uploadFile(content, path);
    }
  }

  private async stopAllDockers(): Promise<void> {
    await this.stopMiningDockers();
    await this.stopBotDocker();
  }

  private async stopMiningDockers(): Promise<void> {
    await SSH.runCommand('cd deploy && docker compose --profile miners down');
  }

  private async restartBotDocker(): Promise<void> {
    await this.stopBotDocker();
    await this.startBotDocker();
  }

  private async stopBotDocker(): Promise<void> {
    await SSH.runCommand('cd deploy && docker compose down bot');
  }

  private async startBotDocker(): Promise<void> {
    await SSH.runCommand(`cd deploy && docker compose --env-file=${DEPLOY_ENV_FILE} up bot -d`);
  }

  private async clearStepFiles(stepKeys: string[], options: { setFirstStepToWorking?: boolean } = {}): Promise<void> {
    if (stepKeys.includes('all')) {
      await this.config.resetField('installDetails');
      await this.config.save();
      await SSH.runCommand('rm -rf ~/install-logs/*');
      return;
    }

    const installDetails = this.config.installDetails;

    installDetails.errorType = null;
    installDetails.errorMessage = null;
    const defaultStatus: IConfigInstallStep = {
      status: InstallStepStatus.Pending,
      progress: 0,
      startDate: null,
    };

    for (const stepKey of stepKeys as InstallStepKey[]) {
      if (stepKey === stepKeys[0] && options.setFirstStepToWorking) {
        defaultStatus.status = InstallStepStatus.Working;
        defaultStatus.startDate = dayjs.utc().toISOString();
      }
      installDetails[stepKey] = { ...defaultStatus };
      await SSH.runCommand(`rm -rf ~/install-logs/${stepKey}.*`);
    }

    this.config.installDetails = installDetails;
    await this.config.save();
  }

  private async startRemoteScript(): Promise<void> {
    const remoteScriptPath = '~/scripts/install_server.sh';
    const remoteScriptLogPath = '~/install_server.log';
    const shellCommand = `ARGON_CHAIN=${NETWORK_NAME} nohup ${remoteScriptPath} > ${remoteScriptLogPath} 2>&1 &`;

    // await SSH.runCommand(`rm -f ${remoteScriptLogPath}`);
    await SSH.runCommand(shellCommand);
  }

  private async getLocalShasums(): Promise<string> {
    return await invoke('get_shasums');
  }
}

interface TmpInstallChecks {
  isFreshInstall: boolean;
  isServerInstallComplete: boolean;
  remoteFilesNeedUpdating: boolean;
}

const CORE_DIRS = ['deploy', 'bot', 'calculator', 'scripts'];
