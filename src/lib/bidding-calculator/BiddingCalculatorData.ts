import mainchain from './Mainchain.ts';

export default class BiddingCalculatorData {
  public isInitialized: Promise<void>;

  public argonRewardsForFullYear: number = 0;
  public argonRewardsForThisSeat: number = 0;
  public argonotRewardsForThisSeat: number = 0;
  public argonotsRequiredForBid: number = 0;

  public previousHighestBid: number = 150;
  public previousLowestBid: number = 100; // TODO: Fetch this from the API

  public transactionFee: number = 0.10;

  public exchangeRates: { USD: number, ARGNOT: number } = { USD: 0, ARGNOT: 0 };

  constructor() {
    this.isInitialized = this.initialize();
  }

  private async initialize() {
    const currentBlockRewards = await mainchain.fetchCurrentRewardsPerBlock();

    this.argonRewardsForFullYear = await mainchain.argonBlockRewardsForFullYear(currentBlockRewards);
    this.argonRewardsForThisSeat = (await mainchain.argonBlockRewardsForThisSlot(currentBlockRewards)) / 10;
    this.argonotsRequiredForBid = await mainchain.getOwnershipAmountMinimum(); 
    this.argonotRewardsForThisSeat = (await mainchain.argonotBlockRewardsForThisSlot()) / 10;
    this.exchangeRates = await mainchain.fetchExchangeRates();
  }
}