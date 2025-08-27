import packageJson from '../../package.json';
import { Db } from './Db';
import { IConfig, IConfigDefaults, IConfigStringified, InstallStepKey, InstallStepStatus } from '../interfaces/IConfig';
import { Keyring, type KeyringPair, MICROGONS_PER_ARGON } from '@argonprotocol/mainchain';
import { JsonExt } from '@argonprotocol/commander-core';
import {
  BidAmountAdjustmentType,
  BidAmountFormulaType,
  MicronotPriceChangeType,
  SeatGoalInterval,
  SeatGoalType,
} from '@argonprotocol/commander-core/src/IBiddingRules.ts';
import { message as tauriMessage } from '@tauri-apps/plugin-dialog';
import { createDeferred, ensureOnlyOneInstance, miniSecretFromUri } from './Utils';
import IDeferred from '../interfaces/IDeferred';
import { CurrencyKey } from './Currency';
import { bip39 } from '@argonprotocol/bitcoin';
import Countries from './Countries';
import ISecurity from '../interfaces/ISecurity';
import { getMainchain } from '../stores/mainchain';
import { WalletBalances } from './WalletBalances';
import { SECURITY } from './Env.ts';

export class Config {
  public readonly version: string = packageJson.version;

  public isLoaded: boolean;
  public isLoadedPromise: Promise<void>;
  public hasDbMigrationError: boolean;

  private _loadedDeferred!: IDeferred<void>;

  private _db!: Db;
  private _fieldsToSave: Set<string> = new Set();
  private _dbPromise: Promise<Db>;
  private _security!: ISecurity;
  private _loadedData!: IConfig;
  private _rawData = {} as IConfigStringified;
  private _masterAccount!: KeyringPair;
  private _miningAccount!: KeyringPair;
  private _miningAccountPreviousHistoryLoadPct: number = 0;
  private _vaultingAccount!: KeyringPair;
  private _miningSessionMiniSecret!: string;

  constructor(dbPromise: Promise<Db>) {
    ensureOnlyOneInstance(this.constructor);
    this._loadedDeferred = createDeferred<void>();
    this.isLoadedPromise = this._loadedDeferred.promise;
    this.isLoaded = false;
    this.hasDbMigrationError = false;

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
      latestFrameIdProcessed: Config.getDefault(dbFields.latestFrameIdProcessed) as number,
      miningAccountAddress: Config.getDefault(dbFields.miningAccountAddress) as string,
      miningAccountHadPreviousLife: Config.getDefault(dbFields.miningAccountHadPreviousLife) as boolean,
      miningAccountPreviousHistory: Config.getDefault(
        dbFields.miningAccountPreviousHistory,
      ) as IConfig['miningAccountPreviousHistory'],
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
    const rawData = {} as IConfigStringified & { miningAccountAddress: string };

    const dbRawData = await db.configTable.fetchAllAsObject();

    if (db.hasMigrationError) {
      this.hasDbMigrationError = true;
    }

    this._security = SECURITY;

    for (const [key, value] of Object.entries(defaults)) {
      const rawValue = dbRawData[key as keyof typeof dbRawData];
      if (rawValue === undefined || rawValue === '') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const defaultValue = await value();
        loadedData[key] = defaultValue;
        if (key !== dbFields.biddingRules && key !== dbFields.vaultingRules) {
          fieldsToSave.add(key);
          rawData[key as keyof typeof rawData] = JsonExt.stringify(defaultValue, 2);
        }
        continue;
      }

      loadedData[key] = JsonExt.parse(rawValue as string);
      rawData[key as keyof typeof rawData] = rawValue as string;
    }

    const isFirstTimeAppLoad = Object.keys(dbRawData).length === 0;
    if (isFirstTimeAppLoad) {
      await this._injectFirstTimeAppData(loadedData, rawData, fieldsToSave);
    }

    const dataToSave = Config.extractDataToSave(fieldsToSave, rawData);
    await db.configTable.insertOrReplace(dataToSave);

    if (this.miningAccount.address !== loadedData.miningAccountAddress) {
      await tauriMessage(
        'Your database does not match your current mining account address. Something has corrupted your data.',
        {
          title: 'Mining Account Inconsistency',
          kind: 'error',
        },
      );
    }

    this.isLoaded = true;
    this._db = db;
    this._loadedData = loadedData as IConfig;
    this._rawData = rawData;
    this._loadedDeferred.resolve();

    if (this.miningAccountHadPreviousLife && !this.miningAccountPreviousHistory) {
      await this._bootupFromMiningAccountPreviousHistory();
    }
  }

  get masterAccount(): KeyringPair {
    // we will allow this to operate even if not loaded so this._injectFirstTimeAppData can set the miningAccountAddress
    if (this._masterAccount) return this._masterAccount;

    const masterAccount = new Keyring({ type: 'sr25519' }).createFromUri(this._security.masterMnemonic);
    if (!this.isLoaded) return masterAccount;

    this._masterAccount = masterAccount;
    return this._masterAccount;
  }

  get miningSessionMiniSecret(): string {
    this._throwErrorIfNotLoaded();
    return (this._miningSessionMiniSecret ||= miniSecretFromUri(`${this.security.masterMnemonic}//mining//sessions`));
  }

  get miningAccount(): KeyringPair {
    // we will allow this to operate even if not loaded so this._injectFirstTimeAppData can set the miningAccountAddress
    if (this._miningAccount) return this._miningAccount;

    const miningAccount = this.masterAccount.derive(`//mining`);
    if (!this.isLoaded) return miningAccount;

    this._miningAccount = miningAccount;
    return this._miningAccount;
  }

  get miningAccountHadPreviousLife(): IConfig['miningAccountHadPreviousLife'] {
    this._throwErrorIfNotLoaded();
    return this._loadedData.miningAccountHadPreviousLife;
  }

  get miningAccountPreviousHistory(): IConfig['miningAccountPreviousHistory'] {
    this._throwErrorIfNotLoaded();
    return this._loadedData.miningAccountPreviousHistory;
  }

  get isBootingUpFromMiningAccountPreviousHistory(): boolean {
    return this._loadedData.miningAccountHadPreviousLife && !this._loadedData.miningAccountPreviousHistory;
  }

  get miningAccountPreviousHistoryLoadPct(): number {
    if (!this.isBootingUpFromMiningAccountPreviousHistory) return 100;
    return Math.min(this._miningAccountPreviousHistoryLoadPct, 100);
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
    this._loadedData.requiresPassword = value;
    this._tryFieldsToSave(dbFields.requiresPassword, value);
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
    this._loadedData.serverDetails = value;
    this._tryFieldsToSave(dbFields.serverDetails, value);
  }

  get installDetails(): IConfig['installDetails'] {
    this._throwErrorIfNotLoaded();
    return this._loadedData.installDetails;
  }

  set installDetails(value: IConfig['installDetails']) {
    this._throwErrorIfNotLoaded();
    this._loadedData.installDetails = value;
    this._tryFieldsToSave(dbFields.installDetails, value);
  }

  get oldestFrameIdToSync(): number {
    this._throwErrorIfNotLoaded();
    return this._loadedData.oldestFrameIdToSync;
  }

  set oldestFrameIdToSync(value: number) {
    this._throwErrorIfNotLoaded();
    this._loadedData.oldestFrameIdToSync = value;
    this._tryFieldsToSave(dbFields.oldestFrameIdToSync, value);
  }

  get latestFrameIdProcessed(): number {
    this._throwErrorIfNotLoaded();
    return this._loadedData.latestFrameIdProcessed;
  }

  set latestFrameIdProcessed(value: number) {
    this._throwErrorIfNotLoaded();
    this._loadedData.latestFrameIdProcessed = value;
    this._tryFieldsToSave(dbFields.latestFrameIdProcessed, value);
  }

  get isVaultReadyToCreate(): boolean {
    this._throwErrorIfNotLoaded();
    return this._loadedData.isVaultReadyToCreate;
  }

  set isVaultReadyToCreate(value: boolean) {
    this._throwErrorIfNotLoaded();
    this._loadedData.isVaultReadyToCreate = value;
    this._tryFieldsToSave(dbFields.isVaultReadyToCreate, value);
  }

  get isServerReadyToInstall(): boolean {
    this._throwErrorIfNotLoaded();
    return this._loadedData.isServerReadyToInstall;
  }

  set isServerReadyToInstall(value: boolean) {
    this._throwErrorIfNotLoaded();
    this._loadedData.isServerReadyToInstall = value;
    this._tryFieldsToSave(dbFields.isServerReadyToInstall, value);
  }

  get isServerUpToDate(): boolean {
    this._throwErrorIfNotLoaded();
    return this._loadedData.isServerUpToDate;
  }

  set isServerUpToDate(value: boolean) {
    this._throwErrorIfNotLoaded();
    this._loadedData.isServerUpToDate = value;
    this._tryFieldsToSave(dbFields.isServerUpToDate, value);
  }

  get isServerInstalled(): boolean {
    this._throwErrorIfNotLoaded();
    return this._loadedData.isServerInstalled;
  }

  set isServerInstalled(value: boolean) {
    this._throwErrorIfNotLoaded();
    this._loadedData.isServerInstalled = value;
    this._loadedData.miningAccountPreviousHistory = null;
    this._loadedData.miningAccountHadPreviousLife = false;
    this._tryFieldsToSave(dbFields.isServerInstalled, value);
    this._tryFieldsToSave(dbFields.miningAccountPreviousHistory, null);
    this._tryFieldsToSave(dbFields.miningAccountHadPreviousLife, false);
  }

  get isWaitingForUpgradeApproval(): boolean {
    this._throwErrorIfNotLoaded();
    return this._loadedData.isWaitingForUpgradeApproval;
  }

  set isWaitingForUpgradeApproval(value: boolean) {
    this._throwErrorIfNotLoaded();
    this._loadedData.isWaitingForUpgradeApproval = value;
    this._tryFieldsToSave(dbFields.isWaitingForUpgradeApproval, value);
  }

  get hasMiningSeats(): boolean {
    this._throwErrorIfNotLoaded();
    return this._loadedData.hasMiningSeats;
  }

  set hasMiningSeats(value: boolean) {
    this._throwErrorIfNotLoaded();
    this._loadedData.hasMiningSeats = value;
    this._tryFieldsToSave(dbFields.hasMiningSeats, value);
  }

  get hasMiningBids(): boolean {
    this._throwErrorIfNotLoaded();
    return this._loadedData.hasMiningBids;
  }

  set hasMiningBids(value: boolean) {
    this._throwErrorIfNotLoaded();
    this._loadedData.hasMiningBids = value;
    this._tryFieldsToSave(dbFields.hasMiningBids, value);
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
    this._loadedData.defaultCurrencyKey = value;
    this._tryFieldsToSave(dbFields.defaultCurrencyKey, value);
  }

  get userJurisdiction(): IConfig['userJurisdiction'] {
    this._throwErrorIfNotLoaded();
    return this._loadedData.userJurisdiction;
  }

  set userJurisdiction(value: IConfig['userJurisdiction']) {
    this._throwErrorIfNotLoaded();
    this._loadedData.userJurisdiction = value;
    this._tryFieldsToSave(dbFields.userJurisdiction, value);
  }

  get isValidJurisdiction(): boolean {
    this._throwErrorIfNotLoaded();
    return this.userJurisdiction.countryCode === 'KY';
  }

  get hasSavedBiddingRules(): boolean {
    this._throwErrorIfNotLoaded();
    return !!this._rawData[dbFields.biddingRules];
  }

  get hasSavedVaultingRules(): boolean {
    this._throwErrorIfNotLoaded();
    return !!this._rawData[dbFields.vaultingRules];
  }

  public async saveBiddingRules() {
    this._throwErrorIfNotLoaded();
    this._tryFieldsToSave(dbFields.biddingRules, this.biddingRules);
    await this.save();
  }

  public async saveVaultingRules() {
    this._throwErrorIfNotLoaded();
    this._tryFieldsToSave(dbFields.vaultingRules, this.vaultingRules);
    await this.save();
  }

  public async save() {
    this._throwErrorIfNotLoaded();
    const dataToSave = Config.extractDataToSave(this._fieldsToSave, this._rawData);
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
    const stringifiedValue = JsonExt.stringify(value, 2);
    if (this._rawData[field] === stringifiedValue) return;

    this._rawData[field] = stringifiedValue;
    this._fieldsToSave.add(field);
  }

  private async _injectFirstTimeAppData(
    loadedData: Partial<IConfig>,
    stringifiedData: IConfigStringified,
    fieldsToSave: Set<string>,
  ) {
    // We cannot use this._tryFieldsToSave because this._stringifiedData and this._fieldsToSave are not initialized yet. Instead
    // we can set the values to their temporary loadedData and stringifiedData objects

    const miningAccountAddress = this.miningAccount.address;
    loadedData.miningAccountAddress = miningAccountAddress;
    stringifiedData[dbFields.miningAccountAddress] = JsonExt.stringify(miningAccountAddress, 2);
    fieldsToSave.add(dbFields.miningAccountAddress);

    const walletBalances = new WalletBalances(getMainchain());
    await walletBalances.load({ miningAccountAddress });
    await walletBalances.updateBalances();

    const miningHasValue = WalletBalances.doesWalletHasValue(walletBalances.miningWallet);
    const vaultingHasValue = WalletBalances.doesWalletHasValue(walletBalances.vaultingWallet);
    const miningAccountHadPreviousLife = miningHasValue || vaultingHasValue;

    loadedData.miningAccountHadPreviousLife = miningAccountHadPreviousLife;
    stringifiedData[dbFields.miningAccountHadPreviousLife] = JsonExt.stringify(miningAccountHadPreviousLife, 2);
    fieldsToSave.add(dbFields.miningAccountHadPreviousLife);
  }

  private async _bootupFromMiningAccountPreviousHistory() {
    const walletBalances = new WalletBalances(getMainchain());
    await walletBalances.load({ miningAccountAddress: this.miningAccount.address });
    walletBalances.onLoadHistoryProgress = (loadPct: number) => {
      this._miningAccountPreviousHistoryLoadPct = loadPct;
    };
    const historyItems = await walletBalances.loadHistory(this.miningAccount);
    const frameIdsProcessed = historyItems?.map(x => x.frameId) || [];
    const oldestFrameIdProcessed = frameIdsProcessed.length ? Math.min(...frameIdsProcessed) : 0;
    if (historyItems.length === 1 && !historyItems[0].seats.length) {
      // We only found bids for today, which means today was the start
      this.oldestFrameIdToSync = oldestFrameIdProcessed;
      this.hasMiningBids = true;
    } else if (historyItems.length) {
      // We found seat history, so we can set the oldestFrameIdToSync to the previous frame of the oldest we have
      // It must be previous frame because we can't have a seat for today if we didn't bid yesterday
      this.oldestFrameIdToSync = oldestFrameIdProcessed - 1;
      this.hasMiningBids = true;
      this.hasMiningSeats = true;
    }

    this._loadedData.miningAccountPreviousHistory = historyItems;
    this._tryFieldsToSave(dbFields.miningAccountPreviousHistory, historyItems);
    await this.save();
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
  latestFrameIdProcessed: 'latestFrameIdProcessed',
  miningAccountAddress: 'miningAccountAddress',
  miningAccountHadPreviousLife: 'miningAccountHadPreviousLife',
  miningAccountPreviousHistory: 'miningAccountPreviousHistory',
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
  latestFrameIdProcessed: () => 0,
  miningAccountAddress: () => '',
  miningAccountHadPreviousLife: () => false,
  miningAccountPreviousHistory: () => null,
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
      btcPctFee: 5,

      btcUtilizationPctMin: 50,
      btcUtilizationPctMax: 100,

      poolUtilizationPctMin: 50,
      poolUtilizationPctMax: 100,

      personalBtcInMicrogons: 1_000n * BigInt(MICROGONS_PER_ARGON),

      baseCapitalCommitment: 2_000n * BigInt(MICROGONS_PER_ARGON),
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
