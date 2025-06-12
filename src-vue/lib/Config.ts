import packageJson from '../../package.json';
import { Db } from './Db';
import {
  IConfig,
  IConfigStringified,
  IConfigInstallStep,
  InstallStepStatus,
  InstallStepKey,
} from '../interfaces/IConfig';
import { SSH } from './SSH';
import { Keyring, type KeyringPair, mnemonicGenerate } from '@argonprotocol/mainchain';

export const env = (import.meta as any).env;
export const NETWORK_NAME = env.VITE_NETWORK_NAME || 'mainnet';
export const NETWORK_URL = env.VITE_NETWORK_URL || 'wss://rpc.argon.network';
export const INSTANCE_NAME = env.VITE_INSTANCE_NAME || 'default';
export const DEPLOY_ENV_FILE = NETWORK_NAME === 'testnet' ? '.env.testnet' : '.env';

export class Config {
  public readonly version: string = packageJson.version;

  public isLoaded: boolean;
  public isLoadedPromise: Promise<void>;

  private _loadingFns!: { resolve: () => void; reject: (error: Error) => void };

  private _db!: Db;
  private _fieldsToSave: Set<string> = new Set();
  private _dbPromise: Promise<Db>;
  private _unserialized!: IConfig;
  private _stringified = {} as IConfigStringified;
  private _seedAccount!: KeyringPair;
  private _mngAccount!: KeyringPair;
  private _llbAccount!: KeyringPair;
  private _vltAccount!: KeyringPair;

  constructor(dbPromise: Promise<Db>) {
    const installDetailsStep: IConfigInstallStep = {
      status: InstallStepStatus.Pending,
      progress: 0,
      startDate: null,
    };
    this.isLoadedPromise = new Promise((resolve, reject) => {
      this._loadingFns = { resolve, reject };
    });
    this.isLoaded = false;

    this._dbPromise = dbPromise;
    this._unserialized = {
      version: packageJson.version,
      requiresPassword: false,
      security: {
        walletMnemonic: '',
        sessionMnemonic: '',
        walletJson: '',
      },
      serverDetails: {
        ipAddress: '',
        sshPublicKey: '',
        sshPrivateKey: '',
        sshUser: '',
        oldestFrameIdToSync: null,
      },
      installDetails: {
        [InstallStepKey.ServerConnect]: { ...installDetailsStep },
        [InstallStepKey.UbuntuCheck]: { ...installDetailsStep },
        [InstallStepKey.FileCheck]: { ...installDetailsStep },
        [InstallStepKey.DockerInstall]: { ...installDetailsStep },
        [InstallStepKey.BitcoinInstall]: { ...installDetailsStep },
        [InstallStepKey.ArgonInstall]: { ...installDetailsStep },
        [InstallStepKey.MiningLaunch]: { ...installDetailsStep },
        errorType: null,
        errorMessage: null,
        isRunning: false,
      },
      syncDetails: {
        progress: 0,
        startDate: null,
        errorType: null,
        errorMessage: null,
      },
      isServerNew: true,
      isServerInstalling: false,
      isServerConnected: false,
      isServerReadyForMining: false,
      isWaitingForUpgradeApproval: false,
      hasMiningSeats: false,
      biddingRules: null,
    };
  }

  public async load() {
    const db = await this._dbPromise;
    const rawData = await db.configTable.fetchAllAsObject();
    const configData: any = {};
    const fieldsToSave: Set<string> = new Set();
    let fieldsSerialized = {} as IConfigStringified;

    for (const [key, value] of Object.entries(defaults)) {
      const rawValue = rawData[key as keyof typeof rawData];
      if (rawValue === undefined || rawValue === '') {
        const defaultValue = await value();
        configData[key] = defaultValue;
        fieldsToSave.add(key);
        fieldsSerialized[key as keyof typeof fieldsSerialized] = JSON.stringify(
          defaultValue,
          null,
          2,
        );
        continue;
      }

      configData[key] = JSON.parse(rawValue as string);
      fieldsSerialized[key as keyof typeof fieldsSerialized] = rawValue as string;
    }

    const dataToSave = Config.extractDataToSave(fieldsToSave, fieldsSerialized);
    await db.configTable.insertOrReplace(dataToSave);

    this.isLoaded = true;
    this._stringified = fieldsSerialized;
    this._db = db;
    this._unserialized = configData as IConfig;
    this._loadingFns.resolve();
  }

  get seedAccount(): KeyringPair {
    if (!this.isLoaded) return {} as KeyringPair;
    return (this._seedAccount ||= new Keyring({ type: 'sr25519' }).createFromUri(
      this.security.walletMnemonic,
    ));
  }

  get mngAccount(): KeyringPair {
    if (!this.isLoaded) return {} as KeyringPair;
    return (this._mngAccount ||= this.seedAccount.derive(`//mng`));
  }

  get llbAccount(): KeyringPair {
    if (!this.isLoaded) return {} as KeyringPair;
    return (this._llbAccount ||= this.seedAccount.derive(`//llb`));
  }

  get vltAccount(): KeyringPair {
    if (!this.isLoaded) return {} as KeyringPair;
    return (this._vltAccount ||= this.seedAccount.derive(`//vlt`));
  }

  //////////////////////////////

  get requiresPassword(): boolean {
    if (!this.isLoaded) return false;
    return this._unserialized.requiresPassword;
  }

  set requiresPassword(value: boolean) {
    this._throwErrorIfNotLoaded();
    this._tryFieldsToSave(dbFields.requiresPassword, value);
    this._unserialized.requiresPassword = value;
  }

  get security(): IConfig['security'] {
    if (!this.isLoaded) return {} as IConfig['security'];
    return this._unserialized.security;
  }

  set security(value: IConfig['security']) {
    this._throwErrorIfNotLoaded();
    this._tryFieldsToSave(dbFields.security, value);
    this._unserialized.security = value;
  }

  get serverDetails(): IConfig['serverDetails'] {
    if (!this.isLoaded) return {} as IConfig['serverDetails'];
    return this._unserialized.serverDetails;
  }

  set serverDetails(value: IConfig['serverDetails']) {
    this._throwErrorIfNotLoaded();
    this._tryFieldsToSave(dbFields.serverDetails, value);
    this._unserialized.serverDetails = value;
  }

  get installDetails(): IConfig['installDetails'] {
    if (!this.isLoaded) return {} as IConfig['installDetails'];
    return this._unserialized.installDetails;
  }

  set installDetails(value: IConfig['installDetails']) {
    this._throwErrorIfNotLoaded();
    this._tryFieldsToSave(dbFields.installDetails, value);
    this._unserialized.installDetails = value;
  }

  get syncDetails(): IConfig['syncDetails'] {
    if (!this.isLoaded) return {} as IConfig['syncDetails'];
    return this._unserialized.syncDetails;
  }

  set syncDetails(value: IConfig['syncDetails']) {
    this._throwErrorIfNotLoaded();
    this._tryFieldsToSave(dbFields.syncDetails, value);
    this._unserialized.syncDetails = value;
  }

  get isServerNew(): boolean {
    if (!this.isLoaded) return false;
    return this._unserialized.isServerNew;
  }

  set isServerNew(value: boolean) {
    this._throwErrorIfNotLoaded();
    this._tryFieldsToSave(dbFields.isServerNew, value);
    this._unserialized.isServerNew = value;
  }

  get isServerInstalling(): boolean {
    if (!this.isLoaded) return false;
    return this._unserialized.isServerInstalling;
  }

  set isServerInstalling(value: boolean) {
    this._throwErrorIfNotLoaded();
    this._tryFieldsToSave(dbFields.isServerInstalling, value);
    this._unserialized.isServerInstalling = value;
  }

  get isServerConnected(): boolean {
    if (!this.isLoaded) return false;
    return this._unserialized.isServerConnected;
  }

  set isServerConnected(value: boolean) {
    this._throwErrorIfNotLoaded();
    this._tryFieldsToSave(dbFields.isServerConnected, value);
    this._unserialized.isServerConnected = value;
  }

  get isServerReadyForMining(): boolean {
    if (!this.isLoaded) return false;
    return this._unserialized.isServerReadyForMining;
  }

  set isServerReadyForMining(value: boolean) {
    this._throwErrorIfNotLoaded();
    this._tryFieldsToSave(dbFields.isServerReadyForMining, value);
    this._unserialized.isServerReadyForMining = value;
  }

  get isServerSyncing(): boolean {
    if (!this.isLoaded) return false;
    return (
      this._unserialized.syncDetails.startDate !== null &&
      this._unserialized.syncDetails.progress < 100
    );
  }

  get isWaitingForUpgradeApproval(): boolean {
    if (!this.isLoaded) return false;
    return this._unserialized.isWaitingForUpgradeApproval;
  }

  set isWaitingForUpgradeApproval(value: boolean) {
    this._throwErrorIfNotLoaded();
    this._tryFieldsToSave(dbFields.isWaitingForUpgradeApproval, value);
    this._unserialized.isWaitingForUpgradeApproval = value;
  }

  get hasMiningSeats(): boolean {
    if (!this.isLoaded) return false;
    return this._unserialized.hasMiningSeats;
  }

  set hasMiningSeats(value: boolean) {
    this._throwErrorIfNotLoaded();
    this._tryFieldsToSave(dbFields.hasMiningSeats, value);
    this._unserialized.hasMiningSeats = value;
  }

  get biddingRules(): IConfig['biddingRules'] {
    if (!this.isLoaded) return {} as IConfig['biddingRules'];
    return this._unserialized.biddingRules;
  }

  set biddingRules(value: IConfig['biddingRules']) {
    this._throwErrorIfNotLoaded();
    this._tryFieldsToSave(dbFields.biddingRules, value);
    this._unserialized.biddingRules = value;
  }

  public async save() {
    this._throwErrorIfNotLoaded();
    const dataToSave = Config.extractDataToSave(this._fieldsToSave, this._stringified);
    this._fieldsToSave = new Set();
    if (Object.keys(dataToSave).length === 0) return;

    const dataToLog = Object.keys(dataToSave).reduce<Partial<IConfig>>((acc, key) => {
      const typedKey = key as keyof IConfig;
      (acc as any)[typedKey] = this._unserialized[typedKey];
      return acc;
    }, {});
    console.log('SAVING:', this._fieldsToSave, dataToLog);
    await this._db.configTable.insertOrReplace(dataToSave);
  }

  public resetField(field: keyof typeof dbFields) {
    this._throwErrorIfNotLoaded();
    (this as any)[field] = defaults[field]();
    this._fieldsToSave.add(field);
  }

  private _throwErrorIfNotLoaded() {
    if (!this.isLoaded)
      throw new Error('Config is not yet loaded. You must wait for isLoaded to be true.');
  }

  private _tryFieldsToSave(field: keyof typeof dbFields, value: any) {
    const stringifiedValue = JSON.stringify(value, null, 2);
    if (this._stringified[field] === stringifiedValue) return;

    this._stringified[field] = stringifiedValue;
    this._fieldsToSave.add(field);
  }

  private static extractDataToSave(
    fieldsToSave: Set<string>,
    stringifiedData: IConfigStringified,
  ): Partial<IConfigStringified> {
    const toSave = {} as IConfigStringified;
    for (const field of fieldsToSave) {
      toSave[field as keyof IConfigStringified] = stringifiedData[field as keyof IConfig];
    }

    return toSave;
  }

  public static getDefault(field: keyof typeof dbFields) {
    return defaults[field]();
  }
}

const dbFields = {
  requiresPassword: 'requiresPassword',
  security: 'security',
  serverDetails: 'serverDetails',
  installDetails: 'installDetails',
  syncDetails: 'syncDetails',
  isServerNew: 'isServerNew',
  isServerConnected: 'isServerConnected',
  isServerInstalling: 'isServerInstalling',
  isServerReadyForMining: 'isServerReadyForMining',
  isWaitingForUpgradeApproval: 'isWaitingForUpgradeApproval',
  hasMiningSeats: 'hasMiningSeats',
  biddingRules: 'biddingRules',
} as const;

interface IConfigDefaults {
  requiresPassword: () => IConfig['requiresPassword'];
  security: () => IConfig['security'];
  serverDetails: () => Promise<IConfig['serverDetails']>;
  installDetails: () => IConfig['installDetails'];
  syncDetails: () => IConfig['syncDetails'];
  isServerNew: () => IConfig['isServerNew'];
  isServerConnected: () => IConfig['isServerConnected'];
  isServerInstalling: () => IConfig['isServerInstalling'];
  isServerReadyForMining: () => IConfig['isServerReadyForMining'];
  isWaitingForUpgradeApproval: () => IConfig['isWaitingForUpgradeApproval'];
  hasMiningSeats: () => IConfig['hasMiningSeats'];
  biddingRules: () => IConfig['biddingRules'];
}

const defaults: IConfigDefaults = {
  requiresPassword: () => false,
  security: () => {
    const walletMnemonic = mnemonicGenerate();
    const sessionMnemonic = mnemonicGenerate();
    const seedAccount = new Keyring({ type: 'sr25519' }).createFromUri(walletMnemonic);
    const mngAccount = seedAccount.derive(`//mng`);
    const walletJson = JSON.stringify(mngAccount.toJson(''), null, 2);
    return {
      walletMnemonic,
      sessionMnemonic,
      walletJson,
    };
  },
  serverDetails: async () => {
    const keys = await SSH.getKeys();
    return {
      ipAddress: '',
      sshPublicKey: keys.publicKey,
      sshPrivateKey: keys.privateKey,
      sshUser: 'root',
      oldestFrameIdToSync: null,
    };
  },
  installDetails: () => {
    const defaultStep = {
      progress: 0,
      status: InstallStepStatus.Pending,
      startDate: null,
    };
    return {
      [InstallStepKey.ServerConnect]: { ...defaultStep },
      [InstallStepKey.UbuntuCheck]: { ...defaultStep },
      [InstallStepKey.FileCheck]: { ...defaultStep },
      [InstallStepKey.DockerInstall]: { ...defaultStep },
      [InstallStepKey.BitcoinInstall]: { ...defaultStep },
      [InstallStepKey.ArgonInstall]: { ...defaultStep },
      [InstallStepKey.MiningLaunch]: { ...defaultStep },
      errorType: null,
      errorMessage: null,
      isRunning: false,
    };
  },
  syncDetails: () => ({
    progress: 0,
    startDate: null,
    errorType: null,
    errorMessage: null,
  }),
  isServerNew: () => true,
  isServerConnected: () => false,
  isServerInstalling: () => false,
  isServerReadyForMining: () => false,
  isWaitingForUpgradeApproval: () => false,
  hasMiningSeats: () => false,
  biddingRules: () => null,
};
