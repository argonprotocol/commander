export function addCommas(num: string | number, decimals?: number) {
  // Check if the number is in scientific notation
  if (typeof num === 'number' && decimals === undefined && num.toString().includes('e')) {
    return num.toString();
  }
  
  const isInteger = isInt(num);
  decimals ??= isInteger ? 0 : 2;
  num = Number(num).toFixed(decimals);

  return isInteger && decimals === 0 ? addCommasToInt(num) : addCommasToFloat(num, decimals);
}

export function showDecimalsIfNeeded(num: number, decimals = 2, ifSomeThen?: number) {
  let [intStr, decStr] = num.toFixed(decimals).split('.');
  decStr = (decStr ?? '').slice(0, decimals);
  decStr = decStr.replace(/0+$/, '');
  
  return num.toFixed(decStr.length && ifSomeThen ? ifSomeThen : decStr.length);
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

export function abreviateAddress(address: string) {
  return address.slice(0, 6) + '...' + address.slice(-4);
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