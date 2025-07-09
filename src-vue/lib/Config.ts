import packageJson from '../../package.json';
import { Db } from './Db';
import {
  IConfig,
  IConfigDefaults,
  IConfigStringified,
  IConfigInstallStep,
  InstallStepStatus,
  InstallStepKey,
} from '../interfaces/IConfig';
import { SSH } from './SSH';
import { Keyring, type KeyringPair, MICROGONS_PER_ARGON, mnemonicGenerate } from '@argonprotocol/mainchain';
import { jsonParseWithBigInts, jsonStringifyWithBigInts } from './Utils';
import {
  BidAmountAdjustmentType,
  BidAmountFormulaType,
  MicronotPriceChangeType,
  SeatGoalInterval,
  SeatGoalType,
} from '@argonprotocol/commander-calculator/src/IBiddingRules';

export const env = (import.meta as any).env;
export const NETWORK_NAME = env.VITE_NETWORK_NAME || 'mainnet';
export const NETWORK_URL = env.VITE_NETWORK_URL || 'wss://rpc.argon.network';
export const INSTANCE_NAME = env.VITE_INSTANCE_NAME || 'default';
export const DEPLOY_ENV_FILE = NETWORK_NAME === 'testnet' ? '.env.testnet' : '.env.mainnet';

export class Config {
  public readonly version: string = packageJson.version;

  public isLoaded: boolean;
  public isLoadedPromise: Promise<void>;

  public hasSavedBiddingRules: boolean;
  public hasSavedVaultingRules: boolean;

  private _loadingFns!: { resolve: () => void; reject: (error: Error) => void };

  private _db!: Db;
  private _fieldsToSave: Set<string> = new Set();
  private _dbPromise: Promise<Db>;
  private _unstringified!: IConfig;
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

    this.hasSavedBiddingRules = false;
    this.hasSavedVaultingRules = false;

    this._dbPromise = dbPromise;
    this._unstringified = {
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
      },
      installDetails: Config.getDefault(dbFields.installDetails) as IConfig['installDetails'],
      oldestFrameIdToSync: Config.getDefault(dbFields.oldestFrameIdToSync) as number,
      isServerConnected: Config.getDefault(dbFields.isServerConnected) as boolean,
      isServerInstalled: Config.getDefault(dbFields.isServerInstalled) as boolean,
      isServerUpToDate: Config.getDefault(dbFields.isServerUpToDate) as boolean,
      isServerReadyForBidding: Config.getDefault(dbFields.isServerReadyForBidding) as boolean,
      isWaitingForUpgradeApproval: Config.getDefault(dbFields.isWaitingForUpgradeApproval) as boolean,
      hasMiningSeats: Config.getDefault(dbFields.hasMiningSeats) as boolean,
      hasMiningBids: Config.getDefault(dbFields.hasMiningBids) as boolean,
      biddingRules: Config.getDefault(dbFields.biddingRules) as IConfig['biddingRules'],
      vaultingRules: Config.getDefault(dbFields.vaultingRules) as IConfig['vaultingRules'],
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
        if (key !== dbFields.biddingRules && key !== dbFields.vaultingRules) {
          fieldsToSave.add(key);
        }
        fieldsSerialized[key as keyof typeof fieldsSerialized] = jsonStringifyWithBigInts(defaultValue, null, 2);
        continue;
      }

      configData[key] = jsonParseWithBigInts(rawValue as string);
      fieldsSerialized[key as keyof typeof fieldsSerialized] = rawValue as string;
      if (key === dbFields.biddingRules) this.hasSavedBiddingRules = true;
      if (key === dbFields.vaultingRules) this.hasSavedVaultingRules = true;
    }

    const dataToSave = Config.extractDataToSave(fieldsToSave, fieldsSerialized);
    await db.configTable.insertOrReplace(dataToSave);

    this.isLoaded = true;
    this._stringified = fieldsSerialized;
    this._db = db;
    this._unstringified = configData as IConfig;
    this._loadingFns.resolve();
  }

  get seedAccount(): KeyringPair {
    this._throwErrorIfNotLoaded();
    return (this._seedAccount ||= new Keyring({ type: 'sr25519' }).createFromUri(this.security.walletMnemonic));
  }

  get mngAccount(): KeyringPair {
    this._throwErrorIfNotLoaded();
    return (this._mngAccount ||= this.seedAccount.derive(`//mng`));
  }

  get llbAccount(): KeyringPair {
    this._throwErrorIfNotLoaded();
    return (this._llbAccount ||= this.seedAccount.derive(`//llb`));
  }

  get vltAccount(): KeyringPair {
    this._throwErrorIfNotLoaded();
    return (this._vltAccount ||= this.seedAccount.derive(`//vlt`));
  }

  //////////////////////////////

  get requiresPassword(): boolean {
    this._throwErrorIfNotLoaded();
    return this._unstringified.requiresPassword;
  }

  set requiresPassword(value: boolean) {
    this._throwErrorIfNotLoaded();
    this._tryFieldsToSave(dbFields.requiresPassword, value);
    this._unstringified.requiresPassword = value;
  }

  get security(): IConfig['security'] {
    this._throwErrorIfNotLoaded();
    return this._unstringified.security;
  }

  set security(value: IConfig['security']) {
    this._throwErrorIfNotLoaded();
    this._tryFieldsToSave(dbFields.security, value);
    this._unstringified.security = value;
  }

  get serverDetails(): IConfig['serverDetails'] {
    this._throwErrorIfNotLoaded();
    return this._unstringified.serverDetails;
  }

  set serverDetails(value: IConfig['serverDetails']) {
    this._throwErrorIfNotLoaded();
    this._tryFieldsToSave(dbFields.serverDetails, value);
    this._unstringified.serverDetails = value;
  }

  get installDetails(): IConfig['installDetails'] {
    this._throwErrorIfNotLoaded();
    return this._unstringified.installDetails;
  }

  set installDetails(value: IConfig['installDetails']) {
    this._throwErrorIfNotLoaded();
    this._tryFieldsToSave(dbFields.installDetails, value);
    console.log(
      'ServerConnect INSTALL DETAILS SET',
      value.ServerConnect.progress === 0 ? new Error('PROGRESS IS 0') : value.ServerConnect.progress,
    );
    this._unstringified.installDetails = value;
  }

  get oldestFrameIdToSync(): number {
    this._throwErrorIfNotLoaded();
    return this._unstringified.oldestFrameIdToSync;
  }

  set oldestFrameIdToSync(value: number) {
    this._throwErrorIfNotLoaded();
    this._tryFieldsToSave(dbFields.oldestFrameIdToSync, value);
    this._unstringified.oldestFrameIdToSync = value;
  }

  get isServerConnected(): boolean {
    this._throwErrorIfNotLoaded();
    return this._unstringified.isServerConnected;
  }

  set isServerConnected(value: boolean) {
    this._throwErrorIfNotLoaded();
    this._tryFieldsToSave(dbFields.isServerConnected, value);
    this._unstringified.isServerConnected = value;
  }

  get isServerUpToDate(): boolean {
    this._throwErrorIfNotLoaded();
    return this._unstringified.isServerUpToDate;
  }

  set isServerUpToDate(value: boolean) {
    this._throwErrorIfNotLoaded();
    this._tryFieldsToSave(dbFields.isServerUpToDate, value);
    this._unstringified.isServerUpToDate = value;
  }

  get isServerInstalled(): boolean {
    this._throwErrorIfNotLoaded();
    return this._unstringified.isServerInstalled;
  }

  set isServerInstalled(value: boolean) {
    this._throwErrorIfNotLoaded();
    this._tryFieldsToSave(dbFields.isServerInstalled, value);
    this._unstringified.isServerInstalled = value;
  }

  get isServerReadyForBidding(): boolean {
    this._throwErrorIfNotLoaded();
    return this._unstringified.isServerReadyForBidding;
  }

  set isServerReadyForBidding(value: boolean) {
    this._throwErrorIfNotLoaded();
    this._tryFieldsToSave(dbFields.isServerReadyForBidding, value);
    this._unstringified.isServerReadyForBidding = value;
  }

  get isWaitingForUpgradeApproval(): boolean {
    this._throwErrorIfNotLoaded();
    return this._unstringified.isWaitingForUpgradeApproval;
  }

  set isWaitingForUpgradeApproval(value: boolean) {
    this._throwErrorIfNotLoaded();
    this._tryFieldsToSave(dbFields.isWaitingForUpgradeApproval, value);
    this._unstringified.isWaitingForUpgradeApproval = value;
  }

  get hasMiningSeats(): boolean {
    this._throwErrorIfNotLoaded();
    return this._unstringified.hasMiningSeats;
  }

  set hasMiningSeats(value: boolean) {
    this._throwErrorIfNotLoaded();
    this._tryFieldsToSave(dbFields.hasMiningSeats, value);
    this._unstringified.hasMiningSeats = value;
  }

  get hasMiningBids(): boolean {
    this._throwErrorIfNotLoaded();
    return this._unstringified.hasMiningBids;
  }

  set hasMiningBids(value: boolean) {
    this._throwErrorIfNotLoaded();
    this._tryFieldsToSave(dbFields.hasMiningBids, value);
    this._unstringified.hasMiningBids = value;
  }

  get biddingRules(): IConfig['biddingRules'] {
    this._throwErrorIfNotLoaded();
    return this._unstringified.biddingRules;
  }

  set biddingRules(value: IConfig['biddingRules']) {
    this._throwErrorIfNotLoaded();
    this._unstringified.biddingRules = value;
  }

  get vaultingRules(): IConfig['vaultingRules'] {
    this._throwErrorIfNotLoaded();
    return this._unstringified.vaultingRules;
  }

  set vaultingRules(value: IConfig['vaultingRules']) {
    this._throwErrorIfNotLoaded();
    this._unstringified.vaultingRules = value;
  }

  public async saveBiddingRules() {
    this._throwErrorIfNotLoaded();
    this._tryFieldsToSave(dbFields.biddingRules, this.biddingRules);
    this.hasSavedBiddingRules = true;
    await this.save();
  }

  public async saveVaultingRules() {
    this._throwErrorIfNotLoaded();
    this._tryFieldsToSave(dbFields.vaultingRules, this.vaultingRules);
    this.hasSavedVaultingRules = true;
    await this.save();
  }

  public async save() {
    this._throwErrorIfNotLoaded();
    const dataToSave = Config.extractDataToSave(this._fieldsToSave, this._stringified);
    this._fieldsToSave = new Set();
    if (Object.keys(dataToSave).length === 0) return;

    const dataToLog = Object.keys(dataToSave).reduce<Partial<IConfig>>((acc, key) => {
      const typedKey = key as keyof IConfig;
      (acc as any)[typedKey] = this._unstringified[typedKey];
      return acc;
    }, {});
    // console.log('Saving Config', this._fieldsToSave, dataToLog);
    await this._db.configTable.insertOrReplace(dataToSave);
  }

  public resetField(field: keyof typeof dbFields) {
    this._throwErrorIfNotLoaded();
    (this as any)[field] = defaults[field]();
    this._fieldsToSave.add(field);
  }

  private _throwErrorIfNotLoaded() {
    if (!this.isLoaded) throw new Error('Config is not yet loaded. You must wait for isLoaded to be true.');
  }

  private _tryFieldsToSave(field: keyof typeof dbFields, value: any) {
    const stringifiedValue = jsonStringifyWithBigInts(value, null, 2);
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
  oldestFrameIdToSync: 'oldestFrameIdToSync',
  isServerConnected: 'isServerConnected',
  isServerInstalled: 'isServerInstalled',
  isServerUpToDate: 'isServerUpToDate',
  isServerReadyForBidding: 'isServerReadyForBidding',
  isWaitingForUpgradeApproval: 'isWaitingForUpgradeApproval',
  hasMiningSeats: 'hasMiningSeats',
  hasMiningBids: 'hasMiningBids',
  biddingRules: 'biddingRules',
  vaultingRules: 'vaultingRules',
} as const;

const defaults: IConfigDefaults = {
  requiresPassword: () => false,
  security: () => {
    const walletMnemonic = mnemonicGenerate();
    const sessionMnemonic = mnemonicGenerate();
    const seedAccount = new Keyring({ type: 'sr25519' }).createFromUri(walletMnemonic);
    const mngAccount = seedAccount.derive(`//mng`);
    const walletJson = jsonStringifyWithBigInts(mngAccount.toJson(''), null, 2);
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
      [InstallStepKey.FileUpload]: { ...defaultStep },
      [InstallStepKey.UbuntuCheck]: { ...defaultStep },
      [InstallStepKey.DockerInstall]: { ...defaultStep },
      [InstallStepKey.BitcoinInstall]: { ...defaultStep },
      [InstallStepKey.ArgonInstall]: { ...defaultStep },
      [InstallStepKey.MiningLaunch]: { ...defaultStep },
      errorType: null,
      errorMessage: null,
      isRunning: false,
    };
  },
  oldestFrameIdToSync: () => 0,
  isServerConnected: () => false,
  isServerInstalled: () => false,
  isServerUpToDate: () => false,
  isServerReadyForBidding: () => false,
  isWaitingForUpgradeApproval: () => false,
  hasMiningSeats: () => false,
  hasMiningBids: () => false,
  biddingRules: () => {
    return {
      argonCirculationGrowthPctMin: 0,
      argonCirculationGrowthPctMax: 50,

      micronotPriceChangeType: MicronotPriceChangeType.Between,
      micronotPriceChangePctMin: 0,
      micronotPriceChangePctMax: 0,

      startingBidAmountFormulaType: BidAmountFormulaType.Custom,
      startingBidAmountAdjustmentType: BidAmountAdjustmentType.Absolute,
      startingBidAmountCustom: 500n * BigInt(MICROGONS_PER_ARGON),
      startingBidAmountAbsolute: 10n * BigInt(MICROGONS_PER_ARGON),
      startingBidAmountRelative: 0,

      rebiddingDelay: 1,
      rebiddingIncrementBy: 1n * BigInt(MICROGONS_PER_ARGON),

      finalBidAmountFormulaType: BidAmountFormulaType.MinimumBreakeven,
      finalBidAmountAdjustmentType: BidAmountAdjustmentType.Relative,
      finalBidAmountCustom: 0n,
      finalBidAmountAbsolute: 0n,
      finalBidAmountRelative: -1,

      seatGoalType: SeatGoalType.Min,
      seatGoalCount: 3,
      seatGoalInterval: SeatGoalInterval.Epoch,

      requiredMicrogons: 1_000n * BigInt(MICROGONS_PER_ARGON),
      requiredMicronots: 0n,
    };
  },
  vaultingRules: () => {
    return {
      capitalForSecuritizationPct: 50,
      capitalForLiquidityPct: 50,
      securitizationRatio: 1,
      profitSharingPct: 10,
      btcFlatFee: 2n * BigInt(MICROGONS_PER_ARGON),
      btcPctFee: 10,
      personalBtcValue: 500n * BigInt(MICROGONS_PER_ARGON),
      requiredMicrogons: 2_000n * BigInt(MICROGONS_PER_ARGON),
      requiredMicronots: 0n,
    };
  },
};
