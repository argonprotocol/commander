import packageJson from '../../package.json';
import { Db } from './Db';
import {
  IConfig,
  IConfigDefaults,
  IConfigInstallStep,
  IConfigStringified,
  InstallStepKey,
  InstallStepStatus,
} from '../interfaces/IConfig';
import { SSH } from './SSH';
import { Keyring, type KeyringPair, MICROGONS_PER_ARGON, mnemonicGenerate } from '@argonprotocol/mainchain';
import { jsonParseWithBigInts, jsonStringifyWithBigInts } from '@argonprotocol/commander-calculator';
import {
  BidAmountAdjustmentType,
  BidAmountFormulaType,
  MicronotPriceChangeType,
  SeatGoalInterval,
  SeatGoalType,
} from '@argonprotocol/commander-calculator/src/IBiddingRules.ts';
import { createDeferred, ensureOnlyOneInstance } from './Utils';
import IDeferred from '../interfaces/IDeferred';
import { CurrencyKey } from './Currency';
import { bip39 } from '@argonprotocol/bitcoin';

export const env = (import.meta as any).env ?? {};
export let NETWORK_NAME = env.VITE_NETWORK_NAME || 'mainnet';
export let NETWORK_URL = env.VITE_NETWORK_URL || 'wss://rpc.argon.network';
export const INSTANCE_NAME = env.VITE_INSTANCE_NAME || 'default';
export const TICK_MILLIS = env.VITE_TICK_MILLIS || 60e3;
export const DEPLOY_ENV_FILE =
  { testnet: '.env.testnet', mainnet: '.env.mainnet', local: '.env.localnet' }[NETWORK_NAME as string] ??
  '.env.mainnet';

export class Config {
  public readonly version: string = packageJson.version;

  public isLoaded: boolean;
  public isLoadedPromise: Promise<void>;

  public hasSavedBiddingRules: boolean;
  public hasSavedVaultingRules: boolean;

  private _loadedDeferred!: IDeferred<void>;

  private _db!: Db;
  private _fieldsToSave: Set<string> = new Set();
  private _dbPromise: Promise<Db>;
  private _unstringified!: IConfig;
  private _stringified = {} as IConfigStringified;
  private _seedAccount!: KeyringPair;
  private _miningAccount!: KeyringPair;
  private _vaultingAccount!: KeyringPair;

  constructor(dbPromise: Promise<Db>) {
    ensureOnlyOneInstance(this.constructor);

    const installDetailsStep: IConfigInstallStep = {
      status: InstallStepStatus.Pending,
      progress: 0,
      startDate: null,
    };
    this._loadedDeferred = createDeferred<void>();
    this.isLoadedPromise = this._loadedDeferred.promise;
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
      isVaultReadyToCreate: Config.getDefault(dbFields.isVaultReadyToCreate) as boolean,
      isServerReadyToInstall: Config.getDefault(dbFields.isServerReadyToInstall) as boolean,
      isServerInstalled: Config.getDefault(dbFields.isServerInstalled) as boolean,
      isServerUpToDate: Config.getDefault(dbFields.isServerUpToDate) as boolean,
      isWaitingForUpgradeApproval: Config.getDefault(dbFields.isWaitingForUpgradeApproval) as boolean,
      hasMiningSeats: Config.getDefault(dbFields.hasMiningSeats) as boolean,
      hasMiningBids: Config.getDefault(dbFields.hasMiningBids) as boolean,
      biddingRules: Config.getDefault(dbFields.biddingRules) as IConfig['biddingRules'],
      vaultingRules: Config.getDefault(dbFields.vaultingRules) as IConfig['vaultingRules'],
      defaultCurrencyKey: Config.getDefault(dbFields.defaultCurrencyKey) as CurrencyKey,
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
          fieldsSerialized[key as keyof typeof fieldsSerialized] = jsonStringifyWithBigInts(defaultValue, null, 2);
        }
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
    this._db = db;
    this._stringified = fieldsSerialized;
    this._unstringified = configData as IConfig;
    this._loadedDeferred.resolve();
  }

  get seedAccount(): KeyringPair {
    this._throwErrorIfNotLoaded();
    return (this._seedAccount ||= new Keyring({ type: 'sr25519' }).createFromUri(this.security.walletMnemonic));
  }

  get miningAccount(): KeyringPair {
    this._throwErrorIfNotLoaded();
    return (this._miningAccount ||= this.seedAccount.derive(`//mng`));
  }

  get vaultingAccount(): KeyringPair {
    this._throwErrorIfNotLoaded();
    return (this._vaultingAccount ||= this.seedAccount.derive(`//vlt`));
  }

  get bitcoinXprivSeed(): Uint8Array {
    return bip39.mnemonicToSeedSync(this.security.walletMnemonic);
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

  get isVaultReadyToCreate(): boolean {
    this._throwErrorIfNotLoaded();
    return this._unstringified.isVaultReadyToCreate;
  }

  set isVaultReadyToCreate(value: boolean) {
    this._throwErrorIfNotLoaded();
    this._tryFieldsToSave(dbFields.isVaultReadyToCreate, value);
    this._unstringified.isVaultReadyToCreate = value;
  }

  get isServerReadyToInstall(): boolean {
    this._throwErrorIfNotLoaded();
    return this._unstringified.isServerReadyToInstall;
  }

  set isServerReadyToInstall(value: boolean) {
    this._throwErrorIfNotLoaded();
    this._tryFieldsToSave(dbFields.isServerReadyToInstall, value);
    this._unstringified.isServerReadyToInstall = value;
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

  get defaultCurrencyKey(): CurrencyKey {
    this._throwErrorIfNotLoaded();
    return this._unstringified.defaultCurrencyKey;
  }

  set defaultCurrencyKey(value: CurrencyKey) {
    this._throwErrorIfNotLoaded();
    this._tryFieldsToSave(dbFields.defaultCurrencyKey, value);
    this._unstringified.defaultCurrencyKey = value;
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
  isVaultReadyToCreate: 'isVaultReadyToCreate',
  isServerReadyToInstall: 'isServerReadyToInstall',
  isServerInstalled: 'isServerInstalled',
  isServerUpToDate: 'isServerUpToDate',
  isWaitingForUpgradeApproval: 'isWaitingForUpgradeApproval',
  hasMiningSeats: 'hasMiningSeats',
  hasMiningBids: 'hasMiningBids',
  biddingRules: 'biddingRules',
  vaultingRules: 'vaultingRules',
  defaultCurrencyKey: 'defaultCurrencyKey',
} as const;

const defaults: IConfigDefaults = {
  requiresPassword: () => false,
  security: () => {
    const sessionMnemonic = mnemonicGenerate();
    const walletMnemonic = mnemonicGenerate();
    const walletAccount = new Keyring({ type: 'sr25519' }).createFromUri(walletMnemonic);
    const walletMiningAccount = walletAccount.derive(`//mng`);
    const walletMiningJson = jsonStringifyWithBigInts(walletMiningAccount.toJson(''), null, 2);
    return {
      walletMnemonic,
      sessionMnemonic,
      walletJson: walletMiningJson,
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
  isVaultReadyToCreate: () => false,
  isServerReadyToInstall: () => false,
  isServerInstalled: () => false,
  isServerUpToDate: () => false,
  isWaitingForUpgradeApproval: () => false,
  hasMiningSeats: () => false,
  hasMiningBids: () => false,
  biddingRules: () => {
    return {
      argonCirculationGrowthPctMin: 0,
      argonCirculationGrowthPctMax: 50,

      argonotPriceChangeType: MicronotPriceChangeType.Between,
      argonotPriceChangePctMin: 0,
      argonotPriceChangePctMax: 0,

      minimumBidFormulaType: BidAmountFormulaType.Custom,
      minimumBidAdjustmentType: BidAmountAdjustmentType.Absolute,
      minimumBidCustom: 500n * BigInt(MICROGONS_PER_ARGON),
      minimumBidAdjustAbsolute: 10n * BigInt(MICROGONS_PER_ARGON),
      minimumBidAdjustRelative: 0,

      rebiddingDelay: 1,
      rebiddingIncrementBy: 1n * BigInt(MICROGONS_PER_ARGON),

      maximumBidFormulaType: BidAmountFormulaType.BreakevenAtSlowGrowth,
      maximumBidAdjustmentType: BidAmountAdjustmentType.Relative,
      maximumBidCustom: 0n,
      maximumBidAdjustAbsolute: 0n,
      maximumBidAdjustRelative: -1,

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
      personalBtcValue: 50n * BigInt(MICROGONS_PER_ARGON),
      requiredMicrogons: 100n * BigInt(MICROGONS_PER_ARGON),
      requiredMicronots: 0n,
    };
  },
  defaultCurrencyKey: () => CurrencyKey.ARGN,
};
