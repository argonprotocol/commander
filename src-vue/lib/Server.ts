import dotenv from 'dotenv';
import { IBiddingRules, jsonParseWithBigInts, jsonStringifyWithBigInts } from '@argonprotocol/commander-calculator';
import { SSHConnection } from './SSHConnection';
import { DEPLOY_ENV_FILE, NETWORK_NAME } from './Config';
import { KeyringPair$Json } from '@argonprotocol/mainchain';
import { SSH } from './SSH';
import { InstallStepKey } from '../interfaces/IConfig';

export enum InstallStepStatusType {
  Pending = 'Pending',
  Started = 'Started',
  Finished = 'Finished',
  Failed = 'Failed',
}

export interface IInstallStepStatuses {
  [key: string]: InstallStepStatusType;
}

const installStepStatusPriorityByType: Record<InstallStepStatusType, number> = {
  [InstallStepStatusType.Pending]: 0,
  [InstallStepStatusType.Started]: 1,
  [InstallStepStatusType.Finished]: 2,
  [InstallStepStatusType.Failed]: 3,
};

export class Server {
  private readonly connection: SSHConnection;

  public constructor(connection: SSHConnection) {
    this.connection = connection;
  }

  public async isConnected(): Promise<boolean> {
    const [output] = await this.connection.runCommandWithTimeout('pwd', 10_000);
    return !!output;
  }

  public async uploadAccountAddress(address: string): Promise<void> {
    await this.connection.uploadFileWithTimeout(address, '~/account', 5e3);
  }

  public async downloadAccountAddress(): Promise<string> {
    const [address] = await this.connection.runCommandWithTimeout('cat ~/account 2>/dev/null || true', 5e3);
    return address.trim();
  }

  public async uploadBiddingRules(biddingRules: IBiddingRules): Promise<void> {
    const biddingRulesStr = jsonStringifyWithBigInts(biddingRules, null, 2);
    await this.connection.uploadFileWithTimeout(biddingRulesStr, '~/config/biddingRules.json', 5e3);
  }

  public async downloadBiddingRules(): Promise<IBiddingRules | undefined> {
    const [biddingRulesRaw] = await this.connection.runCommandWithTimeout(
      'cat ~/config/biddingRules.json 2>/dev/null || true',
      10_000,
    );
    return biddingRulesRaw ? jsonParseWithBigInts(biddingRulesRaw) : undefined;
  }

  public async uploadEnvState(envState: { oldestFrameIdToSync: number }): Promise<void> {
    const envStateStr = `OLDEST_FRAME_ID_TO_SYNC=${envState.oldestFrameIdToSync || ''}\n`;
    await this.connection.uploadFileWithTimeout(envStateStr, '~/config/.env.state', 5e3);
  }

  public async downloadEnvState(): Promise<{ oldestFrameIdToSync: number }> {
    const [envStateRaw] = await this.connection.runCommandWithTimeout(
      'cat ~/config/.env.state 2>/dev/null || true',
      5e3,
    );
    const envState = envStateRaw ? dotenv.parse(envStateRaw) : {};
    return {
      oldestFrameIdToSync: Number(envState.OLDEST_FRAME_ID_TO_SYNC),
    };
  }

  public async stopMiningDockers(): Promise<void> {
    await this.connection.runCommandWithTimeout(
      `cd server && docker compose --env-file=${DEPLOY_ENV_FILE} --profile miners down`,
      5e3,
    );
  }

  public async stopBotDocker(): Promise<void> {
    await this.connection.runCommandWithTimeout(
      `cd server && docker compose --env-file=${DEPLOY_ENV_FILE} down bot`,
      5e3,
    );
  }

  public async startBotDocker(): Promise<void> {
    await this.connection.runCommandWithTimeout(
      `cd server && docker compose --env-file=${DEPLOY_ENV_FILE} up bot -d`,
      5e3,
    );
  }

  public async uploadEnvSecurity(envSecurity: { sessionMiniSecret: string; keypairPassphrase: string }): Promise<void> {
    const envSecurityStr =
      `SESSION_MINI_SECRET="${envSecurity.sessionMiniSecret}"\n` +
      `KEYPAIR_PASSPHRASE=${envSecurity.keypairPassphrase}`;
    await this.connection.uploadFileWithTimeout(envSecurityStr, '~/config/.env.security', 5e3);
  }

  public async uploadMiningWallet(miningWalletJson: KeyringPair$Json): Promise<void> {
    const walletMiningJson = jsonStringifyWithBigInts(miningWalletJson, null, 2);
    await this.connection.uploadFileWithTimeout(walletMiningJson, '~/config/walletMining.json', 5e3);
  }

  public async removeAllLogFiles(): Promise<void> {
    await this.connection.runCommandWithTimeout('rm -rf ~/logs/*', 5e3);
  }

  public async removeLogStep(stepKey: string): Promise<void> {
    await this.connection.runCommandWithTimeout(`rm -rf ~/logs/step-${stepKey}.*`, 5e3);
  }

  public async startInstallerScript(): Promise<void> {
    const remoteScriptPath = '~/server/scripts/installer.sh';
    const remoteScriptLogPath = '~/logs/installer.log';
    const shellCommand = `ARGON_CHAIN=${NETWORK_NAME} nohup ${remoteScriptPath} > ${remoteScriptLogPath} 2>&1 &`;
    await this.connection.runCommandWithTimeout(shellCommand, 5e3);
    console.info(`started: ${shellCommand}`);
  }

  public async createConfigDir(): Promise<void> {
    await this.connection.runCommandWithTimeout('mkdir -p ~/config', 5e3);
  }

  public async createLogsDir(): Promise<void> {
    await this.connection.runCommandWithTimeout('mkdir -p ~/logs', 5e3);
  }

  public async downloadVersion(): Promise<string> {
    const [version] = await this.connection.runCommandWithTimeout('cat ~/server/VERSION 2>/dev/null || true', 5e3);
    return version.trim();
  }

  public async isInstallerScriptRunning(): Promise<boolean> {
    try {
      const [pid] = await this.connection.runCommandWithTimeout('pgrep -f ~/server/scripts/installer.sh', 5e3);
      return pid.trim() !== '';
    } catch {
      return false;
    }
  }

  public async fetchBitcoinInstallProgress(): Promise<number> {
    const [output] = await this.connection.runCommandWithTimeout('docker exec server-bitcoin-1 syncstatus.sh', 5e3);
    return parseFloat(output.trim().replace('%', '')) || 0.0;
  }

  public async fetchArgonInstallProgress(): Promise<number> {
    const [output] = await this.connection.runCommandWithTimeout('docker exec server-argon-miner-1 syncstatus.sh', 5e3);
    return parseFloat(output.trim().replace('%', '')) || 0.0;
  }

  public async downloadInstallStepStatuses(): Promise<IInstallStepStatuses> {
    const stepStatuses: IInstallStepStatuses = {};
    const [output, code] = await SSH.runCommand('ls ~/logs/step-*');
    if (code !== 0) {
      return stepStatuses;
    }

    for (const filename of output.split('\n').filter(s => s)) {
      const [, key, newStatus] = filename.match(/step-(.+)\.(.+)/) || [];
      const prevStatus = stepStatuses[key] || InstallStepStatusType.Pending;
      if (!key || !newStatus) {
        continue;
      }

      const newStatusNumber = installStepStatusPriorityByType[newStatus as InstallStepStatusType];
      const prevStatusNumber = installStepStatusPriorityByType[prevStatus as InstallStepStatusType];

      if (newStatusNumber > prevStatusNumber) {
        stepStatuses[key] = newStatus as InstallStepStatusType;
      }
    }

    return stepStatuses;
  }

  public async extractInstallStepFailureMessage(stepKey: InstallStepKey): Promise<string> {
    const stepName = InstallStepKey[stepKey];
    const [output, code] = await this.connection.runCommandWithTimeout(`cat ~/logs/step-${stepName}.failed`, 5e3);
    if (code === 0) {
      return output.trim();
    }
    return '';
  }
}
