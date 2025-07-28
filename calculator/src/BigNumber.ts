import BigNumber from 'bignumber.js';
import { convertFixedU128ToBigNumber, convertPermillToBigNumber } from '@argonprotocol/mainchain';

// Extend BigNumber interface to include custom methods
declare module 'bignumber.js' {
  interface BigNumber {
    ceil(): BigNumber;
    floor(): BigNumber;
    round(): BigNumber;
    trunc(): BigNumber;
  }
}

BigNumber.set({
  DECIMAL_PLACES: 40,
  ROUNDING_MODE: BigNumber.ROUND_HALF_UP,
  EXPONENTIAL_AT: [-20, 30],
  RANGE: 1e9,
  CRYPTO: true,
  MODULO_MODE: BigNumber.ROUND_FLOOR,
  POW_PRECISION: 80,
  FORMAT: {
    decimalSeparator: '.',
    groupSeparator: ',',
    groupSize: 3,
    secondaryGroupSize: 0,
    fractionGroupSeparator: '',
    fractionGroupSize: 0,
  },
  ALPHABET: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$_',
});

BigNumber.prototype.ceil = function () {
  return this.integerValue(BigNumber.ROUND_CEIL);
};

BigNumber.prototype.floor = function () {
  return this.integerValue(BigNumber.ROUND_FLOOR);
};

BigNumber.prototype.round = function () {
  return this.integerValue(BigNumber.ROUND_HALF_CEIL);
};

BigNumber.prototype.trunc = function () {
  return this.integerValue(BigNumber.ROUND_DOWN);
};

BigNumber.fromFixedU128 = function (fixedU128: bigint): BigNumber {
  return BigNumber.from(convertFixedU128ToBigNumber(fixedU128));
};

BigNumber.fromPermill = function (cPermill: bigint): BigNumber {
  return BigNumber.from(convertPermillToBigNumber(cPermill));
};

export default BigNumber;
