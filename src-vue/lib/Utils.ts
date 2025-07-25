import { JsonExt } from '@argonprotocol/mainchain';
import { jsonStringifyWithBigIntsEnhanced, jsonParseWithBigIntsEnhanced } from '@argonprotocol/commander-calculator';
import { IFieldTypes } from './db/BaseTable.ts';

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
  return apy;
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

export function toSqlParams(
  params: (bigint | number | string | Uint8Array | boolean | object | undefined)[],
): (string | number | Uint8Array | undefined)[] {
  return params.map(param => {
    if (typeof param === 'boolean') {
      return toSqliteBoolean(param);
    } else if (typeof param === 'bigint') {
      return toSqliteBigInt(param);
    } else if (typeof param === 'object') {
      return jsonStringifyWithBigIntsEnhanced(param);
    }
    return param;
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

export function convertFromSqliteFields(obj: any, fields: Partial<Record<keyof IFieldTypes, string[]>>): any {
  // Handle array of objects
  if (Array.isArray(obj)) {
    return obj.map(item => convertFromSqliteFields(item, fields));
  }

  // Handle single object
  for (const [type, fieldNames] of Object.entries(fields)) {
    for (const fieldName of fieldNames) {
      if (!(fieldName in obj)) continue;
      if (type === 'bigint') {
        obj[fieldName] = fromSqliteBigInt(obj[fieldName]);
      } else if (type === 'boolean') {
        obj[fieldName] = fromSqliteBoolean(obj[fieldName]);
      } else if (type === 'bigintJson') {
        obj[fieldName] = BigInt(obj[fieldName]);
      } else if (type === 'bigintJson') {
        obj[fieldName] = jsonParseWithBigIntsEnhanced(obj[fieldName]);
      } else if (type === 'json') {
        obj[fieldName] = JsonExt.parse(obj[fieldName]);
      } else if (type === 'date') {
        obj[fieldName] = new Date(obj[fieldName]);
      } else {
        throw new Error(`${fieldName} has unknown type: ${type}`);
      }
    }
  }
  return obj;
}

export function deferred<T = void>(): IDeferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  let resolved = false;
  let rejected = false;

  const promise = new Promise<T>((res, rej) => {
    resolve = (value: T) => {
      resolved = true;
      res(value);
    };
    reject = (err: Error) => {
      rejected = true;
      rej(err);
    };
  });

  return Object.assign(promise, {
    resolve,
    reject,
    get resolved() {
      return resolved;
    },
    get rejected() {
      return rejected;
    },
  });
}

export type IDeferred<T = void> = Promise<T> & {
  resolve(value: T): void;
  reject(reason?: unknown): void;
  readonly resolved: boolean;
  readonly rejected: boolean;
};

export function ensureOnlyOneInstance(constructor: any) {
  if (constructor.isInitialized) {
    console.log(new Error().stack);
    throw new Error(`${constructor.name} already initialized`);
  }
  constructor.isInitialized = true;
}

export function resetOnlyOneInstance(constructor: any) {
  constructor.isInitialized = false;
}

export function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: any) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason?: any) => void;
  let promise: Promise<T> = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return {
    promise,
    resolve,
    reject,
  };
}
