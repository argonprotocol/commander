import BigNumber from 'bignumber.js';

export function formatArgonots(x: bigint | number): number {
  const isNegative = x < 0;
  const [whole, decimal] = (Math.abs(Number(x)) / 1e6).toFixed(2).split('.');
  if (decimal === '00') {
    return Number(`${isNegative ? '-' : ''}${BigInt(whole)}`);
  }
  const wholeNumber = BigInt(whole);
  return Number(`${isNegative ? '-' : ''}${wholeNumber}.${decimal}`);
}

export function bigIntMin(...args: Array<bigint | null>): bigint {
  if (args.length === 0) throw new Error('minBigInt requires at least one argument');
  return args.filter(x => x !== null).reduce((min, current) => (current < min ? current : min));
}

export function bigIntMax(...args: Array<bigint | null>): bigint {
  if (args.length === 0) throw new Error('bigIntMax requires at least one argument');
  return args.filter(x => x !== null).reduce((max, current) => (current > max ? current : max));
}

export function bigIntAbs(x: bigint): bigint {
  return x < 0n ? -x : x;
}

export function bigNumberToBigInt(bn: BigNumber): bigint {
  return BigInt(bn.integerValue(BigNumber.ROUND_DOWN).toString());
}

export function bigIntMultiplyNumber(x: bigint, y: number): bigint {
  // Count decimal places in y by converting to string and checking after decimal point
  const decimalPlaces = y.toString().split('.')[1]?.length || 0;
  const precision = 10 ** decimalPlaces;
  return (x * BigInt(Math.round(y * precision))) / BigInt(precision);
}

export function convertBigIntStringToNumber(bigIntStr: string | undefined): bigint | undefined {
  if (bigIntStr === undefined) return undefined;
  if (!bigIntStr) return 0n;
  // The string is formatted as "1234567890n"
  return BigInt(bigIntStr.slice(0, -1));
}

export function isBigIntString(value: any): boolean {
  return typeof value === 'string' && /^\d+n$/.test(value);
}

export function jsonStringifyWithBigInts(
  data: any,
  replacerFn: null | ((key: string, value: any) => any) = null,
  space: number | string | undefined = undefined,
): string {
  return JSON.stringify(
    data,
    (_key, value) => {
      if (typeof value === 'bigint') {
        value = value.toString() + 'n';
      }
      return replacerFn ? replacerFn(_key, value) : value;
    },
    space,
  );
}

export function jsonStringifyWithBigIntsEnhanced(
  data: any,
  replacerFn: null | ((key: string, value: any) => any) = null,
  space: number | string | undefined = undefined,
): string {
  return JSON.stringify(
    data,
    (_key, value) => {
      if (typeof value === 'bigint') {
        value = value.toString() + 'n';
      }
      if (value instanceof Uint8Array) {
        return {
          type: 'Buffer',
          data: Array.from(value), // Convert Uint8Array to an array of numbers
        };
      }
      return replacerFn ? replacerFn(_key, value) : value;
    },
    space,
  );
}

export function jsonParseWithBigInts(data: string): any {
  return JSON.parse(data, (_key, value) => {
    if (isBigIntString(value)) {
      return convertBigIntStringToNumber(value);
    }
    return value;
  });
}

export function jsonParseWithBigIntsEnhanced(data: string): any {
  return JSON.parse(data, (_key, value) => {
    if (isBigIntString(value)) {
      return convertBigIntStringToNumber(value);
    }
    if (value && typeof value === 'object' && value.type === 'Buffer' && Array.isArray(value.data)) {
      return Uint8Array.from(value.data); // Convert array of numbers back to Uint8Array
    }
    return value;
  });
}
