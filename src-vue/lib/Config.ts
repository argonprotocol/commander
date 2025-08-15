import packageJson from '../../package.json';
import { Db } from './Db';
import { IConfig, IConfigDefaults, IConfigStringified, InstallStepKey, InstallStepStatus } from '../interfaces/IConfig';
import { Keyring, type KeyringPair, MICROGONS_PER_ARGON } from '@argonprotocol/mainchain';
import { jsonParseWithBigInts, jsonStringifyWithBigInts } from '@argonprotocol/commander-calculator';
import {
  BidAmountAdjustmentType,
  BidAmountFormulaType,
  MicronotPriceChangeType,
  SeatGoalInterval,
  SeatGoalType,
} from '@argonprotocol/commander-calculator/src/IBiddingRules.ts';
import { message as tauriMessage } from '@tauri-apps/plugin-dialog';
import { createDeferred, ensureOnlyOneInstance, miniSecretFromUri } from './Utils';
import IDeferred from '../interfaces/IDeferred';
import { CurrencyKey } from './Currency';
import { bip39 } from '@argonprotocol/bitcoin';
import Countries from './Countries';
import { invokeWithTimeout } from './tauriApi';
import ISecurity from '../interfaces/ISecurity';
import AppConfig from '../../app.config.json';

console.log('__ARGON_NETWORK_NAME__', __ARGON_NETWORK_NAME__);
console.log('__COMMANDER_INSTANCE__', __COMMANDER_INSTANCE__);

export const NETWORK_NAME = __ARGON_NETWORK_NAME__ || 'mainnet';
export const ENABLE_AUTO_UPDATE = __ARGON_ENABLE_AUTO_UPDATE__ ?? false;
const networkConfig = AppConfig[NETWORK_NAME as keyof typeof AppConfig] ?? AppConfig.mainnet;
export const NETWORK_URL = networkConfig.archiveUrl;
export const [INSTANCE_NAME, INSTANCE_PORT] = (__COMMANDER_INSTANCE__ || 'default:1420').split(':');

export const env = (import.meta as any).env ?? {};
export const TICK_MILLIS: number = networkConfig.tickMillis;
export const ESPLORA_HOST: string = networkConfig.esploraHost;
export const BITCOIN_BLOCK_MILLIS: number = networkConfig.bitcoinBlockMillis;
export const DEPLOY_ENV_FILE = networkConfig.serverEnvFile;

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
  private _security!: ISecurity;
  private _loadedData!: IConfig;
  private _stringifiedData = {} as IConfigStringified;
  private _masterAccount!: KeyringPair;
  private _miningAccount!: KeyringPair;
  private _vaultingAccount!: KeyringPair;
  private _miningSessionMiniSecret!: string;

  constructor(dbPromise: Promise<Db>) {
    ensureOnlyOneInstance(this.constructor);
    this._loadedDeferred = createDeferred<void>();
    this.isLoadedPromise = this._loadedDeferred.promise;
    this.isLoaded = false;

    this.hasSavedBiddingRules = false;
    this.hasSavedVaultingRules = false;

    this._dbPromise = dbPromise;
    this._security = {
      masterMnemonic: '',
      sshPublicKey: '',
      sshPrivateKey: '',
    };
    this._loadedData = {
      version: packageJson.version,
      requiresPassword: false,
      serverDetails: {
        ipAddress: '',
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
      userJurisdiction: {
        ipAddress: '',
        city: '',
        region: '',
        countryName: '',
        countryCode: '',
        latitude: '',
        longitude: '',
      },
    };
  }

  public async load() {
    const db = await this._dbPromise;
    const fieldsToSave: Set<string> = new Set();
    const loadedData: any = {};
    const stringifieData = {} as IConfigStringified & { miningAccountAddress: string };

    const [rawData, security] = await Promise.all([
      db.configTable.fetchAllAsObject(),
      invokeWithTimeout('fetch_security', {}, 5e3),
    ]);

    this._security = security as ISecurity;

    for (const [key, value] of Object.entries(defaults)) {
      const rawValue = rawData[key as keyof typeof rawData];
      if (rawValue === undefined || rawValue === '') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const defaultValue = await value();
        loadedData[key] = defaultValue;
        if (key !== dbFields.biddingRules && key !== dbFields.vaultingRules) {
          fieldsToSave.add(key);
          stringifieData[key as keyof typeof stringifieData] = jsonStringifyWithBigInts(defaultValue, null, 2);
        }
        continue;
      }

      loadedData[key] = jsonParseWithBigInts(rawValue as string);
      stringifieData[key as keyof typeof stringifieData] = rawValue as string;
      if (key === dbFields.biddingRules) {
        this.hasSavedBiddingRules = true;
      } else if (key === dbFields.vaultingRules) {
        this.hasSavedVaultingRules = true;
      }
    }

    this.isLoaded = true;

    if (!loadedData.miningAccountAddress) {
      fieldsToSave.add('miningAccountAddress');
      stringifieData['miningAccountAddress'] = JSON.stringify(this.miningAccount.address);
    } else if (this.miningAccount.address !== loadedData.miningAccountAddress) {
      await tauriMessage(
        'Your database does not match your current mining account address. Something has corrupted your data.',
        {
          title: 'Mining Account Inconsistency',
          kind: 'error',
        },
      );
    }

    const dataToSave = Config.extractDataToSave(fieldsToSave, stringifieData);
    await db.configTable.insertOrReplace(dataToSave);

    this._db = db;
    this._loadedData = loadedData as IConfig;
    this._stringifiedData = stringifieData;
    this._loadedDeferred.resolve();
  }

  get masterAccount(): KeyringPair {
    this._throwErrorIfNotLoaded();
    return (this._masterAccount ||= new Keyring({ type: 'sr25519' }).createFromUri(this.security.masterMnemonic));
  }

  get miningSessionMiniSecret(): string {
    this._throwErrorIfNotLoaded();
    return (this._miningSessionMiniSecret ||= miniSecretFromUri(`${this.security.masterMnemonic}//mining//sessions`));
  }

  get miningAccount(): KeyringPair {
    this._throwErrorIfNotLoaded();
    return (this._miningAccount ||= this.masterAccount.derive(`//mining`));
  }

  get vaultingAccount(): KeyringPair {
    this._throwErrorIfNotLoaded();
    return (this._vaultingAccount ||= this.masterAccount.derive(`//vaulting`));
  }

  get bitcoinXprivSeed(): Uint8Array {
    return bip39.mnemonicToSeedSync(this.security.masterMnemonic);
  }

  //////////////////////////////

  get requiresPassword(): boolean {
    this._throwErrorIfNotLoaded();
    return this._loadedData.requiresPassword;
  }

  set requiresPassword(value: boolean) {
    this._throwErrorIfNotLoaded();
    this._tryFieldsToSave(dbFields.requiresPassword, value);
    this._loadedData.requiresPassword = value;
  }

  get security(): ISecurity {
    this._throwErrorIfNotLoaded();
    return this._security;
  }

  get serverDetails(): IConfig['serverDetails'] {
    this._throwErrorIfNotLoaded();
    return this._loadedData.serverDetails;
  }

  set serverDetails(value: IConfig['serverDetails']) {
    this._throwErrorIfNotLoaded();
    this._tryFieldsToSave(dbFields.serverDetails, value);
    this._loadedData.serverDetails = value;
  }

  get installDetails(): IConfig['installDetails'] {
    this._throwErrorIfNotLoaded();
    return this._loadedData.installDetails;
  }

  set installDetails(value: IConfig['installDetails']) {
    this._throwErrorIfNotLoaded();
    this._tryFieldsToSave(dbFields.installDetails, value);
    this._loadedData.installDetails = value;
  }

  get oldestFrameIdToSync(): number {
    this._throwErrorIfNotLoaded();
    return this._loadedData.oldestFrameIdToSync;
  }

  set oldestFrameIdToSync(value: number) {
    this._throwErrorIfNotLoaded();
    this._tryFieldsToSave(dbFields.oldestFrameIdToSync, value);
    this._loadedData.oldestFrameIdToSync = value;
  }

  get isVaultReadyToCreate(): boolean {
    this._throwErrorIfNotLoaded();
    return this._loadedData.isVaultReadyToCreate;
  }

  set isVaultReadyToCreate(value: boolean) {
    this._throwErrorIfNotLoaded();
    this._tryFieldsToSave(dbFields.isVaultReadyToCreate, value);
    this._loadedData.isVaultReadyToCreate = value;
  }

  get isServerReadyToInstall(): boolean {
    this._throwErrorIfNotLoaded();
    return this._loadedData.isServerReadyToInstall;
  }

  set isServerReadyToInstall(value: boolean) {
    this._throwErrorIfNotLoaded();
    this._tryFieldsToSave(dbFields.isServerReadyToInstall, value);
    this._loadedData.isServerReadyToInstall = value;
  }

  get isServerUpToDate(): boolean {
    this._throwErrorIfNotLoaded();
    return this._loadedData.isServerUpToDate;
  }

  set isServerUpToDate(value: boolean) {
    this._throwErrorIfNotLoaded();
    this._tryFieldsToSave(dbFields.isServerUpToDate, value);
    this._loadedData.isServerUpToDate = value;
  }

  get isServerInstalled(): boolean {
    this._throwErrorIfNotLoaded();
    return this._loadedData.isServerInstalled;
  }

  set isServerInstalled(value: boolean) {
    this._throwErrorIfNotLoaded();
    this._tryFieldsToSave(dbFields.isServerInstalled, value);
    this._loadedData.isServerInstalled = value;
  }

  get isWaitingForUpgradeApproval(): boolean {
    this._throwErrorIfNotLoaded();
    return this._loadedData.isWaitingForUpgradeApproval;
  }

  set isWaitingForUpgradeApproval(value: boolean) {
    this._throwErrorIfNotLoaded();
    this._tryFieldsToSave(dbFields.isWaitingForUpgradeApproval, value);
    this._loadedData.isWaitingForUpgradeApproval = value;
  }

  get hasMiningSeats(): boolean {
    this._throwErrorIfNotLoaded();
    return this._loadedData.hasMiningSeats;
  }

  set hasMiningSeats(value: boolean) {
    this._throwErrorIfNotLoaded();
    this._tryFieldsToSave(dbFields.hasMiningSeats, value);
    this._loadedData.hasMiningSeats = value;
  }

  get hasMiningBids(): boolean {
    this._throwErrorIfNotLoaded();
    return this._loadedData.hasMiningBids;
  }

  set hasMiningBids(value: boolean) {
    this._throwErrorIfNotLoaded();
    this._tryFieldsToSave(dbFields.hasMiningBids, value);
    this._loadedData.hasMiningBids = value;
  }

  get biddingRules(): IConfig['biddingRules'] {
    this._throwErrorIfNotLoaded();
    return this._loadedData.biddingRules;
  }

  set biddingRules(value: IConfig['biddingRules']) {
    this._throwErrorIfNotLoaded();
    this._loadedData.biddingRules = value;
  }

  get vaultingRules(): IConfig['vaultingRules'] {
    this._throwErrorIfNotLoaded();
    return this._loadedData.vaultingRules;
  }

  set vaultingRules(value: IConfig['vaultingRules']) {
    this._throwErrorIfNotLoaded();
    this._loadedData.vaultingRules = value;
  }

  get defaultCurrencyKey(): CurrencyKey {
    this._throwErrorIfNotLoaded();
    return this._loadedData.defaultCurrencyKey;
  }

  set defaultCurrencyKey(value: CurrencyKey) {
    this._throwErrorIfNotLoaded();
    this._tryFieldsToSave(dbFields.defaultCurrencyKey, value);
    this._loadedData.defaultCurrencyKey = value;
  }

  get userJurisdiction(): IConfig['userJurisdiction'] {
    this._throwErrorIfNotLoaded();
    return this._loadedData.userJurisdiction;
  }

  set userJurisdiction(value: IConfig['userJurisdiction']) {
    this._throwErrorIfNotLoaded();
    this._tryFieldsToSave(dbFields.userJurisdiction, value);
    this._loadedData.userJurisdiction = value;
  }

  get isValidJurisdiction(): boolean {
    this._throwErrorIfNotLoaded();
    return this.userJurisdiction.countryCode === 'KY';
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
    const dataToSave = Config.extractDataToSave(this._fieldsToSave, this._stringifiedData);
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
    if (this._stringifiedData[field] === stringifiedValue) return;

    this._stringifiedData[field] = stringifiedValue;
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
  userJurisdiction: 'userJurisdiction',
} as const;

const defaults: IConfigDefaults = {
  requiresPassword: () => false,
  serverDetails: () => {
    return {
      ipAddress: '',
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
      argonotPriceChangePctMin: -10,
      argonotPriceChangePctMax: +100,

      minimumBidFormulaType: BidAmountFormulaType.PreviousDayLow,
      minimumBidAdjustmentType: BidAmountAdjustmentType.Relative,
      minimumBidCustom: 0n * BigInt(MICROGONS_PER_ARGON),
      minimumBidAdjustAbsolute: 0n * BigInt(MICROGONS_PER_ARGON),
      minimumBidAdjustRelative: 0,

      rebiddingDelay: 1,
      rebiddingIncrementBy: 1n * BigInt(MICROGONS_PER_ARGON),

      maximumBidFormulaType: BidAmountFormulaType.BreakevenAtSlowGrowth,
      maximumBidAdjustmentType: BidAmountAdjustmentType.Relative,
      maximumBidCustom: 0n,
      maximumBidAdjustAbsolute: 0n,
      maximumBidAdjustRelative: 0,

      seatGoalType: SeatGoalType.Min,
      seatGoalCount: 3,
      seatGoalInterval: SeatGoalInterval.Epoch,

      baseCapitalCommitment: 1_000n * BigInt(MICROGONS_PER_ARGON),
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
  userJurisdiction: async () => {
    const ipResponse = await fetch('https://api.ipify.org?format=json');
    const { ip: ipAddress } = await ipResponse.json();

    const geoResponse = await fetch(`https://api.hackertarget.com/geoip/?q=${ipAddress}&output=json`);
    const { city, region, state, country: countryStr, latitude, longitude } = await geoResponse.json();
    const country = Countries.closestMatch(countryStr) || ({} as any);
    console.log('country', countryStr, country);

    return {
      ipAddress,
      city,
      region: region || state,
      countryName: country.name || countryStr,
      countryCode: country.value || '',
      latitude,
      longitude,
    };
  },
};
