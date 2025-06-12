import { SSH } from './SSH';
import { InstallStepErrorType, InstallStepStatus, InstallStepKey, type IConfigInstallStep } from '../interfaces/IConfig';
import { Config, DEPLOY_ENV_FILE, NETWORK_NAME } from './Config';
import { app } from '@tauri-apps/api';
import { invoke } from '@tauri-apps/api/core';
import { InstallerCheck } from './InstallerCheck';

let IS_INITIALIZED = false;

export default class Installer {
  private config: Config;
  private installerCheck: InstallerCheck;
  private isRunningLocally = false;
  private hasApprovedUpgrade = false;

  private reasonToSkipInstall: string = "";
  private reasonToSkipInstallData: any = null;

  public isFreshInstall: boolean;
  public remoteFilesNeedUpdating: boolean;

  public isLoaded: boolean;
  public isLoadedPromise: Promise<void>;

  private _loadingFns!: { resolve: () => void, reject: (error: Error) => void };

  constructor(config: Config) {
    if (IS_INITIALIZED) throw new Error("Installer already initialized");
    IS_INITIALIZED = true;

    this.config = config;
    this.installerCheck = new InstallerCheck(config);
    
    this.isLoadedPromise = new Promise((resolve, reject) => {
      this._loadingFns = { resolve, reject };
    });
    
    this.isLoaded = false;
    this.isFreshInstall = false;
    this.remoteFilesNeedUpdating = false;
  }

  public async load(): Promise<void> {
    await this.config.isLoadedPromise;
    await this.checkWhetherToSkipInstall();

    this.isLoaded = true;
    this._loadingFns.resolve();
  }


  public async tryToRun(): Promise<void> {
    console.info("Trying to run installer");
    await this.isLoadedPromise;
    if (this.reasonToSkipInstall) {
      console.info("Skipping Installer:", this.reasonToSkipInstall, this.reasonToSkipInstallData);
      return;
    }

    await SSH.ensureConnection(this.config.serverDetails);

    this.config.isWaitingForUpgradeApproval = false;
    this.config.isServerInstalling = true;
    await this.config.save();

    console.info("Starting install process");
    await this.startInstall();
  }

  public async retryFailedStep(
    stepKey: string
  ): Promise<void> {
    if (await this.isInstallRunning()) return;

    await this.clearStepFiles([stepKey]);

    this.installerCheck.clearCachedFilenames();
    this.installerCheck.bypassCachedFilenames = false;

    this.clearReasonsToSkipInstall();
    this.tryToRun();
  }

  public async startUpgrade(): Promise<void> {
    if (await this.isInstallRunning()) return;

    this.hasApprovedUpgrade = true;

    console.info("Clearing step files");
    const stepsToClear = [
      InstallStepErrorType.FileCheck,
      InstallStepErrorType.BitcoinInstall,
      InstallStepErrorType.ArgonInstall,
      InstallStepErrorType.MiningLaunch,
    ];
    await this.clearStepFiles(stepsToClear);
    
    this.installerCheck.clearCachedFilenames();
    this.installerCheck.bypassCachedFilenames = false;
    
    this.clearReasonsToSkipInstall();
    this.config.resetField('installDetails');
    this.config.isWaitingForUpgradeApproval = false;
    await this.config.save();

    this.tryToRun();
  }

  public async updateBiddingBot(): Promise<void> {
    await this.uploadBotConfigFiles();
    await this.restartBotDocker();
    
    this.config.isServerReadyForMining = true;
    await this.config.save();
  }

  private async checkWhetherToSkipInstall(): Promise<void> {
    if (!this.config.isServerConnected) {
      this.reasonToSkipInstall = 'Server is not connected';
      this.reasonToSkipInstallData = { isServerConnected: this.config.isServerConnected };
      this.config.isServerInstalling = false;
      this.config.isWaitingForUpgradeApproval = false;
      await this.config.save();
      return;
    }

    const localFilesAreValid = await this.localFilesMatchLocalShasums();
    if (!localFilesAreValid) {
      this.reasonToSkipInstall = 'Local shasums are not accurate';
      this.reasonToSkipInstallData = { localFilesAreValid };
      this.config.isServerInstalling = false;
      await this.config.save();
      return;
    }

    await SSH.ensureConnection(this.config.serverDetails);

    // If the install process is currently running, we don't need to start it again.
    const installProcessIsRunning = await this.isInstallRunning();
    if (installProcessIsRunning) {
      this.reasonToSkipInstall = 'Install process is currently running';
      this.reasonToSkipInstallData = { installProcessIsRunning };
      this.config.isServerInstalling = true;
      this.config.isWaitingForUpgradeApproval = false;
      await this.config.save();
      return;
    }

    // We will begin by running through a series of checks to determine if the install process
    // should be started. We don't use serverDetails.isInstalling because the local value could
    // be out of date with the server.
    const tmpInstallChecks = await this.checkInstall();
    const isFreshInstall = tmpInstallChecks.isFreshInstall;
    const isServerInstallComplete = tmpInstallChecks.isServerInstallComplete;
    const remoteFilesNeedUpdating = tmpInstallChecks.remoteFilesNeedUpdating;

    this.isFreshInstall = isFreshInstall;
    this.remoteFilesNeedUpdating = remoteFilesNeedUpdating;
    
    if (isServerInstallComplete && !remoteFilesNeedUpdating) {
      this.reasonToSkipInstall = 'Server is up-to-date';
      this.reasonToSkipInstallData = { isServerInstallComplete, remoteFilesNeedUpdating };
      this.config.isServerInstalling = false;
      this.config.isWaitingForUpgradeApproval = false;
      await this.config.save();
      return;
    }

    const requiresExplicitUpgradeApproval = isServerInstallComplete && !isFreshInstall && !this.config.isServerInstalling;
    console.info('requiresExplicitUpgradeApproval =', requiresExplicitUpgradeApproval, {
      isServerInstallComplete, isFreshInstall, isServerInstalling: this.config.isServerInstalling, hasApprovedUpgrade: this.hasApprovedUpgrade,
    });
    if (requiresExplicitUpgradeApproval && !this.hasApprovedUpgrade) {
      this.reasonToSkipInstall = 'Server is not new so upgrade requires user approval';
      this.reasonToSkipInstallData = { isServerInstallComplete, isFreshInstall, isServerInstalling: this.config.isServerInstalling };
      this.config.isWaitingForUpgradeApproval = true;
      await this.config.save();
      return;
    }

    if (isFreshInstall) {
      // If the server is fresh, we need to reset the install details, and we can't skip the install process
      // even if next two conditions are met.
      this.clearReasonsToSkipInstall();
      this.config.resetField('installDetails');
      this.config.isWaitingForUpgradeApproval = false;
      await this.config.save();
      return;
    }

    if (this.installerCheck.hasError) {
      this.reasonToSkipInstall = 'Server has error';
      this.reasonToSkipInstallData = { hasInstallError: this.installerCheck.hasError };
      this.config.isServerInstalling = true;
      await this.config.save();
      return;
    }

    const isWaitingForMinersToSync = this.config.installDetails.MiningLaunch.progress > 0.0;
    if (isWaitingForMinersToSync && !remoteFilesNeedUpdating) {
      this.reasonToSkipInstall = 'Install script has finished, but waiting for miners to sync';
      this.reasonToSkipInstallData = { isWaitingForMinersToSync, remoteFilesNeedUpdating };
      await this.config.save();
      return;
    }
  }

  private clearReasonsToSkipInstall(): void {
    this.reasonToSkipInstall = '';
    this.reasonToSkipInstallData = {};
  }

  private async isInstallRunning(): Promise<boolean> {
    if (this.isRunningLocally) {
      console.info("Install process IS running locally");
      return true;
    }
    console.info("Install process is NOT running locally");

    try {
      console.info("Checking if install process is running remotely");
      const [pid] = await SSH.runCommand("pgrep -f ~/scripts/install_server.sh");
      const isRunningRemotely = pid.trim() !== "";
      console.info(`Install process ${isRunningRemotely ? "IS" : "is NOT"} running remotely`);
      return isRunningRemotely;
    } catch {
      console.info("Install process is NOT running remotely");
      return false;
    }
  }

  private async checkInstall(): Promise<TmpInstallChecks> {
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
    const remoteFilesNeedUpdating = !(await this.remoteFilesMatchLocalShasums());

    return {
      isFreshInstall,
      isServerInstallComplete,
      remoteFilesNeedUpdating,
    };
  }

  private async remoteFilesMatchLocalShasums(): Promise<boolean> {
    const [remoteShasums] = await SSH.runCommand("cat ~/SHASUMS256.copied 2>/dev/null || true");
    const localShasums = await this.getLocalShasums();
    const remoteFilesMatchLocalShasums = localShasums === remoteShasums;
    console.info(`Remote files ${remoteFilesMatchLocalShasums ? 'DO' : 'do NOT'} match local shasums`);
    
    if (!remoteFilesMatchLocalShasums) {
      console.info(`Remote shasums: ${remoteShasums}`);
      console.info(`Local shasums: ${localShasums}`);
    }

    return remoteFilesMatchLocalShasums;
  }

  private async localFilesMatchLocalShasums(): Promise<boolean> {
    const localShasums = await this.getLocalShasums();
    console.info(`Local shasums: ${localShasums}`);
    let dynamicShasums = "";

    for (const dirName of CORE_DIRS) {
      const shasum = await invoke('create_shasum', { dirName });

      if (dynamicShasums !== "") {
        dynamicShasums += "\n";
      }
      dynamicShasums += `${dirName} ${shasum}`;
    }

    const localTrimmed = localShasums.trim();
    const dynamicTrimmed = dynamicShasums.trim();
    const localLines = localTrimmed.split("\n");
    const dynamicLines = dynamicTrimmed.split("\n");
    
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

  private async startInstall(): Promise<void> {
    console.info("Installer starting");
    this.isRunningLocally = true;
    this.installerCheck.start();

    let errorMessage = "";

    try {
      if (this.remoteFilesNeedUpdating) {
        const stepsToClear = [
          InstallStepErrorType.FileCheck,
          InstallStepErrorType.BitcoinInstall,
          InstallStepErrorType.ArgonInstall,
          InstallStepErrorType.MiningLaunch,
        ];
        console.info("Clearing step files");
        await this.clearStepFiles(stepsToClear);    

        console.info("Uploading sha256");
        await this.uploadSha256();

        console.info("Uploading core files");
        await this.uploadCoreFiles();
      }

      console.info("Uploading bot config files");
      await this.uploadBotConfigFiles();
      
      console.info("Starting remote script");
      await this.startRemoteScript();
      
      this.installerCheck.bypassCachedFilenames = true;

      await this.installerCheck.waitForInstallToComplete();
      this.isRunningLocally = false;
      this.remoteFilesNeedUpdating = false;
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
      this.isRunningLocally = false;
      return;
    }

    console.info("Installer finished");
    this.config.isServerInstalling = false;
    await this.config.save();
  }

  private async serverHasSha256File(): Promise<boolean> {
    const [, code] = await SSH.runCommand("test -f ~/SHASUMS256");
    return code === 0;
  }

  private async uploadSha256(): Promise<void> {
    const localShasums = await this.getLocalShasums();
    await SSH.uploadFile(localShasums, "~/SHASUMS256");
    await SSH.runCommand("rm ~/SHASUMS256.copied");
  }

  private async uploadCoreFiles(): Promise<void> {
    for (const localDir of CORE_DIRS) {
      console.log(`UPLOADING ${localDir}`);
      const remoteDir = `~/${localDir}`;
      await SSH.runCommand(`rm -rf ${remoteDir}`);
      await SSH.uploadDirectory(app, localDir, remoteDir);
    }

    await SSH.runCommand("~/scripts/update_shasums.sh SHASUMS256.copied");
  }

  private async uploadBotConfigFiles(): Promise<void> {
    const biddingRulesStr = JSON.stringify(this.config.biddingRules);
    if (!biddingRulesStr) return;
    
    const envSecurity = `SESSION_KEYS_MNEMONIC="${this.config.security.sessionMnemonic}"\n` + 
                        `KEYPAIR_PASSPHRASE=`;
    const envState = `OLDEST_FRAME_ID_TO_SYNC=${this.config.serverDetails.oldestFrameIdToSync || ""}\n` +
                     `IS_READY_FOR_BIDDING=${this.config.isServerReadyForMining}\n`;

    const files = [
      [this.config.security.walletJson, "~/config/wallet.json"],
      [biddingRulesStr, "~/config/biddingRules.json"],
      [envSecurity, "~/config/.env.security"],
      [envState, "~/config/.env.state"],
    ];

    await SSH.runCommand("mkdir -p config");

    for (const [content, path] of files) {
      await SSH.uploadFile(content, path);
    }
  }

  private async stopAllDockers(): Promise<void> {
    await this.stopMiningDockers();
    await this.stopBotDocker();
  }

  private async stopMiningDockers(): Promise<void> {
    await SSH.runCommand("cd deploy && docker compose --profile miners down");
  }

  private async restartBotDocker(): Promise<void> {
    await this.stopBotDocker();
    await this.startBotDocker();
  }

  private async stopBotDocker(): Promise<void> {
    await SSH.runCommand("cd deploy && docker compose down bot");
  }

  private async startBotDocker(): Promise<void> {
    await SSH.runCommand(`cd deploy && docker compose --env-file=${DEPLOY_ENV_FILE} up bot -d`);
  }

  private async clearStepFiles(stepKeys: string[]): Promise<void> {
    if (stepKeys.includes("all")) {
      await this.config.resetField('installDetails');
      await this.config.save();
      await SSH.runCommand("rm -rf ~/install-logs/*");
      return;
    }

    this.config.installDetails.errorType = null;
    this.config.installDetails.errorMessage = null;
    const defaultStatus: IConfigInstallStep = {
      status: InstallStepStatus.Pending,
      progress: 0,
      startDate: null,
    };

    for (const stepKey of stepKeys as InstallStepKey[]) {
      this.config.installDetails[stepKey] = { ...defaultStatus };
      await SSH.runCommand(`rm -rf ~/install-logs/${stepKey}.*`);
    }

    await this.config.save();
  }

  private async startRemoteScript(): Promise<void> {
    const remoteScriptPath = "~/scripts/install_server.sh";
    const remoteScriptLogPath = "~/install_server.log";
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

const CORE_DIRS = ["deploy", "bot", "calculator", "scripts"];