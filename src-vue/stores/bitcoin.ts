import BitcoinPrices from '../lib/BitcoinPrices';
import BitcoinFees from '../lib/BitcoinFees';

const bitcoinPrices = new BitcoinPrices();
const bitcoinFees = new BitcoinFees();

export function getBitcoinPrices() {
  return bitcoinPrices;
}

export function getBitcoinFees() {
  return bitcoinFees;
}
