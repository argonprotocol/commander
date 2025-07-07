import BigNumber from 'bignumber.js';

export function isInt(n: any) {
  if (typeof n === 'string') return !n.includes('.');
  return n % 1 === 0;
}

export function abreviateAddress(address: string, length = 4) {
  return address.slice(0, 6) + '...' + address.slice(-length);
}

export function calculateAPY(costs: bigint, rewards: bigint): number {
  if (costs === 0n && rewards > 0n) return 9_999;
  if (costs === 0n) return 0;

  const tenDayRate = Number(((rewards - costs) * 100_000n) / costs) / 100_000;
  // Compound APR over 36.5 cycles (10-day periods in a year)
  const apy = (Math.pow(1 + tenDayRate, 36.5) - 1) * 100;
  if (apy > 9_999) {
    return 9_999;
  }
  console.log('apy', apy);
  return apy;
}

export function convertBigIntStringToNumber(bigIntStr: string | undefined): bigint | undefined {
  if (bigIntStr === undefined) return undefined;
  if (!bigIntStr) return 0n;
  // The string is formatted as "1234567890n"
  return BigInt(bigIntStr.slice(0, -1));
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

export function jsonParseWithBigInts(data: string): any {
  return JSON.parse(data, (_key, value) => {
    if (typeof value === 'string' && /^\d+n$/.test(value)) {
      return convertBigIntStringToNumber(value);
    }
    return value;
  });
}

export function toSqliteBoolean(bool: boolean): number {
  return bool ? 1 : 0;
}

export function fromSqliteBoolean(num: number): boolean {
  return num === 1;
}

export function toSqliteBigInt(num: bigint): number {
  return Number(num);
}

export function fromSqliteBigInt(num: number): bigint {
  try {
    return BigInt(num);
  } catch (e) {
    console.log('num', num);
    console.error('Error converting sqlite bigint', e);
    throw e;
  }
}

export function toSqliteBnJson(data: any): string {
  return JSON.stringify(
    data,
    (_key, value) => {
      if (value instanceof BigNumber) {
        return value.toString();
      }
      return value;
    },
    2,
  );
}

export function fromSqliteBnJson(data: any): any {
  return JSON.parse(data, (_key, value) => {
    if (typeof value === 'string' && /^\d+$/.test(value)) {
      return BigNumber(value);
    }
    return value;
  });
}

export function convertSqliteBooleans(obj: any, booleanFields: string[]): any {
  // Handle array of objects
  if (Array.isArray(obj)) {
    return obj.map(item => convertSqliteBooleans(item, booleanFields));
  }

  // Handle single object
  return booleanFields.reduce((acc, fieldName) => {
    if (!(fieldName in obj)) return acc;
    acc[fieldName] = fromSqliteBoolean(obj[fieldName]);
    return acc;
  }, obj);
}

export function convertSqliteBigInts(obj: any, bigIntFields: string[]): any {
  // Handle array of objects
  if (Array.isArray(obj)) {
    return obj.map(item => convertSqliteBigInts(item, bigIntFields));
  }

  // Handle single object
  return bigIntFields.reduce((acc, fieldName) => {
    if (!(fieldName in obj)) return acc;
    acc[fieldName] = fromSqliteBigInt(obj[fieldName]);
    return acc;
  }, obj);
}

export function convertSqliteFields(obj: any, fields: { [type: string]: string[] }): any {
  // Handle array of objects
  if (Array.isArray(obj)) {
    return obj.map(item => convertSqliteFields(item, fields));
  }

  // Handle single object
  for (const [type, fieldNames] of Object.entries(fields)) {
    for (const fieldName of fieldNames) {
      if (!(fieldName in obj)) continue;
      if (type === 'bigint') {
        obj[fieldName] = fromSqliteBigInt(obj[fieldName]);
      } else if (type === 'boolean') {
        obj[fieldName] = fromSqliteBoolean(obj[fieldName]);
      } else if (type === 'bnJson') {
        obj[fieldName] = fromSqliteBnJson(obj[fieldName]);
      } else {
        throw new Error(`${fieldName} has unknown type: ${type}`);
      }
    }
  }
  return obj;
}
