import BigNumber from 'bignumber.js';
import {
  type ApiDecoration,
  FIXED_U128_DECIMALS,
  fromFixedNumber,
  MICROGONS_PER_ARGON,
} from '@argonprotocol/mainchain';
import { bigNumberToBigInt } from './utils.js';
import type { MainchainClients } from './MainchainClients.js';

export class PriceIndex {
  constructor(public clients: MainchainClients) {}

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
    const priceIndexRaw = await api.query.priceIndex.current();
    if (priceIndexRaw.isNone) {
      return {
        USD: microgonsForArgon,
        ARGNOT: microgonsForArgon,
        ARGN: microgonsForArgon,
        BTC: microgonsForArgon,
      };
    }

    const priceIndex = priceIndexRaw.value;
    const usdForArgon = fromFixedNumber(priceIndex.argonUsdPrice.toBigInt(), FIXED_U128_DECIMALS);
    const usdForArgnot = fromFixedNumber(priceIndex.argonotUsdPrice.toBigInt(), FIXED_U128_DECIMALS);
    const usdForBtc = fromFixedNumber(priceIndex.btcUsdPrice.toBigInt(), FIXED_U128_DECIMALS);

    // These exchange rates should be relative to the argon
    const microgonsForUsd = this.calculateExchangeRateInMicrogons(BigNumber(1), usdForArgon);
    const microgonsForArgnot = this.calculateExchangeRateInMicrogons(usdForArgnot, usdForArgon);
    const microgonsForBtc = this.calculateExchangeRateInMicrogons(usdForBtc, usdForArgon);

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
