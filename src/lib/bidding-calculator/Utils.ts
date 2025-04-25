import { BigNumber } from 'bignumber.js';

export function formatArgonots(x: bigint | number): number {
  const isNegative = x < 0;
  const [whole, decimal] = (Math.abs(Number(x)) / 1e6).toFixed(2).split('.');
  if (decimal === '00') {
    return Number(`${isNegative ? '-' : ''}${BigInt(whole)}`);
  }
  const wholeNumber = BigInt(whole);
  return Number(`${isNegative ? '-' : ''}${wholeNumber}.${decimal}`);
}
  
export function convertFixedU128ToBigNumber(fixedU128: bigint): BigNumber {
  const decimalFactor = new BigNumber(10).pow(new BigNumber(18)); // Fixed point precision (18 decimals)
  const rawValue = new BigNumber(fixedU128.toString()); // Parse the u128 string value into BN
  // Convert the value to fixed-point
  return rawValue.div(decimalFactor);
}

export const convertFixedU256ToBigNumber = convertFixedU128ToBigNumber;
