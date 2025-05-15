import BiddingCalculatorData from './BiddingCalculatorData.js';

export default class BiddingCalculator {
  public scenarioName: string = '';
  public argonBidPremium: number = 0;
  public argonsToMintThisSeat: number = 0;

  private data: BiddingCalculatorData;

  public argonotPriceChange: number = 0;

  constructor(scenarioName: string, calculatorData: BiddingCalculatorData) {
    this.scenarioName = scenarioName;
    this.data = calculatorData;
  }

  public async setBid(amount: number) {
    this.argonBidPremium = amount;
  }

  public async setArgonCirculation(argonCirculation: number) {
    const argonsToMint = argonCirculation - this.data.argonRewardsForFullYear;
    this.argonsToMintThisSeat = argonsToMint / 365;
  }

  public async setArgonotPriceChange(argonotPriceChange: number) {
    this.argonotPriceChange = argonotPriceChange;
  }

  public get costOfArgonotLoss() {
    const lossMultiplier = this.argonotPriceChange / 100;
    return Math.max(
      0,
      -this.argonotToArgon(this.data.argonotsRequiredForBid * lossMultiplier),
    );
  }

  public get totalCost() {
    return (
      this.argonBidPremium + this.data.transactionFee + this.costOfArgonotLoss
    );
  }

  public get argonotRewardsAsArgonValue() {
    const argonots = this.data.argonotRewardsForThisSeat;
    const argonPrice = this.argonotToArgon(argonots);
    const priceChangeMultiplier = 1 + this.argonotPriceChange / 100;
    return argonPrice * priceChangeMultiplier;
  }

  public get totalRewards() {
    return (
      this.data.argonRewardsForThisSeat +
      this.argonotRewardsAsArgonValue +
      this.argonsToMintThisSeat
    );
  }

  public get TDPR() {
    const tdpr = ((this.totalRewards - this.totalCost) / this.totalCost) * 100;
    return Math.max(tdpr, -100);
  }

  public get APR() {
    const apr = this.TDPR * 36.5;
    return Math.max(apr, -100);
  }

  public get APY() {
    const apy = Math.pow(1 + this.TDPR / 100, 36.5) * 100 - 100;
    return Math.max(apy, -100);
  }

  public get breakevenBid() {
    return (
      this.totalRewards - (this.data.transactionFee + this.costOfArgonotLoss)
    );
  }

  private argonotToArgon(qty: number) {
    return qty * this.data.exchangeRates.ARGNOT;
  }
}
