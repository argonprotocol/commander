import BigNumber from 'bignumber.js';
import { type ApiDecoration, MICROGONS_PER_ARGON, PriceIndex as PriceIndexModel } from '@argonprotocol/mainchain';
import { bigNumberToBigInt } from './utils.js';
import type { MainchainClients } from './MainchainClients.js';

export class PriceIndex {
  current: PriceIndexModel;

  constructor(public clients: MainchainClients) {
    this.current = new PriceIndexModel();
  }

  public async fetchMicrogonsInCirculation(): Promise<bigint> {
    const client = await this.clients.prunedClientOrArchivePromise;
    return (await client.query.balances.totalIssuance()).toBigInt();
  }

  public async fetchMicrogonExchangeRatesTo(api?: ApiDecoration<'promise'>): Promise<{
    USD: bigint;
    ARGNOT: bigint;
    ARGN: bigint;
    BTC: bigint;
  }> {
    api ??= await this.clients.prunedClientOrArchivePromise;
    const microgonsForArgon = BigInt(MICROGONS_PER_ARGON);
    const priceIndex = await this.current.load(api as any);
    if (priceIndex.argonUsdPrice === undefined) {
      return {
        USD: microgonsForArgon,
        ARGNOT: microgonsForArgon,
        ARGN: microgonsForArgon,
        BTC: microgonsForArgon,
      };
    }

    const usdForArgon = priceIndex.argonUsdPrice;

    // These exchange rates should be relative to the argon
    const microgonsForUsd = this.calculateExchangeRateInMicrogons(BigNumber(1), usdForArgon);
    const microgonsForArgnot = this.calculateExchangeRateInMicrogons(priceIndex.argonotUsdPrice!, usdForArgon);
    const microgonsForBtc = this.calculateExchangeRateInMicrogons(priceIndex.btcUsdPrice!, usdForArgon);

    return {
      ARGN: microgonsForArgon,
      USD: microgonsForUsd,
      ARGNOT: microgonsForArgnot,
      BTC: microgonsForBtc,
    };
  }

  private calculateExchangeRateInMicrogons(usdAmount: BigNumber, usdForArgon: BigNumber): bigint {
    const oneArgonInMicrogons = BigInt(MICROGONS_PER_ARGON);
    const usdAmountBn = BigNumber(usdAmount);
    const usdForArgonBn = BigNumber(usdForArgon);
    if (usdAmountBn.isZero() || usdForArgonBn.isZero()) return oneArgonInMicrogons;

    const argonsRequired = usdAmountBn.dividedBy(usdForArgonBn);
    return bigNumberToBigInt(argonsRequired.multipliedBy(MICROGONS_PER_ARGON));
  }
}
