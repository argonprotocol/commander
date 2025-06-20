function isScientific(num: number): boolean {
  return (Math.abs(num) < 1e-6 && num !== 0) || Math.abs(num) >= 1e21 ? true : false;
}

export function fmtMoney(numStr: number, removeDecimalsOver?: number) {
  if (isScientific(numStr)) {
    return numStr.toString();
  }

  let num: string;
  if (removeDecimalsOver === undefined) {
    num = fmtDecimals(numStr, 2);
  } else if (numStr > removeDecimalsOver) {
    num = fmtDecimals(numStr, 0);
  } else {
    num = fmtDecimals(numStr, 2);
  }

  return fmtCommas(num);
}

export function fmtCommas(num: string | number) {
  if (typeof num === 'number') {
    num = num.toString();
  }

  if (num.includes('e')) {
    return num;
  }

  const arr = num.split('.');
  const int = arr[0].replace(/(\d)(?=(\d{3})+$)/g, '$1,');
  const dec = arr[1];

  return dec ? `${int}.${dec}` : int;
}

export function fmtDecimals(num: number, decimals = 2): string {
  if (isScientific(num)) {
    return num.toString();
  }

  return num.toFixed(decimals);
}

export function fmtDecimalsMax(num: number, decimals = 2, ifDecimalsThenAtLeast?: number) {
  if (isScientific(num)) {
    return num.toString();
  }

  let [intStr, decStr] = num.toFixed(decimals).split('.');
  decStr = (decStr ?? '').slice(0, decimals);
  decStr = decStr.replace(/0+$/, '');

  return num.toFixed(decStr.length && ifDecimalsThenAtLeast ? ifDecimalsThenAtLeast : decStr.length);
}

export function isInt(n: any) {
  if (typeof n === 'string') return !n.includes('.');
  return n % 1 === 0;
}

export function abreviateAddress(address: string, length = 4) {
  return address.slice(0, 6) + '...' + address.slice(-length);
}

export function calculateAPY(costs: number, rewards: number) {
  if (costs === 0 && rewards > 0) return 9_999;
  if (costs === 0) return 0;

  const tenDayRate = (rewards - costs) / costs;
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

export function toSqliteBoolean(bool: boolean): number {
  return bool ? 1 : 0;
}

export function fromSqliteBoolean(num: number): boolean {
  return num === 1;
}

export function convertSqliteBooleans(obj: any, fields: string[]): any {
  return fields.reduce((acc, field) => {
    acc[field] = fromSqliteBoolean(obj[field]);
    return acc;
  }, obj);
}
