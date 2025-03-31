import { BigNumber } from 'bignumber.js';

export function addCommas(num: string | number, decimals?: number) {
  num = num.toString();
  if (decimals === undefined) {
    return isInt(num) ? addCommasToInt(num) : addCommasToFloat(num, 2);
  }
  return addCommasToFloat(num, decimals ?? 2);
}

export function addCommasToInt(str: string) {
  const arr = str.toString().split('.');
  const int = arr[0];
  return int.replace(/(\d)(?=(\d{3})+$)/g, '$1,');
}

export function addCommasToFloat(str: string, decimals = 2) {
  const arr = str.split('.');

  const intRaw = arr[0];
  const int = intRaw.replace(/(\d)(?=(\d{3})+$)/g, '$1,');

  const decRaw = arr.length > 1 ? `${arr[1]}` : '';
  const dec = decRaw.slice(0, decimals).padEnd(decimals, '0');

  return dec ? `${int}.${dec}` : int;
}

export function isInt(n: any) {
  if (typeof n === 'string') return !n.includes('.');
  return n % 1 === 0;
}

export function numberWithCommas(x: bigint): string {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatArgonots(x: bigint | number): number {
  const isNegative = x < 0;
  const [whole, decimal] = (Math.abs(Number(x)) / 1e6).toFixed(2).split('.');
  if (decimal === '00') {
    return Number(`${isNegative ? '-' : ''}${numberWithCommas(BigInt(whole))}`);
  }
  const wholeWithCommas = numberWithCommas(BigInt(whole));
  return Number(`${isNegative ? '-' : ''}${wholeWithCommas}.${decimal}`);
}

export function convertFixedU128ToBigNumber(fixedU128: bigint): BigNumber {
  const decimalFactor = new BigNumber(10).pow(new BigNumber(18)); // Fixed point precision (18 decimals)
  const rawValue = new BigNumber(fixedU128.toString()); // Parse the u128 string value into BN
  // Convert the value to fixed-point
  return rawValue.div(decimalFactor);
}