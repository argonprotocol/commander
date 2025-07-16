import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

// These constants can be fetched from client.query.miningSlot.miningConfig()
const TICKS_BETWEEN_SLOTS = 1_440;
const SLOT_BIDDING_START_AFTER_TICKS = 17_280;

// This constant can be fetched from client.query.ticks.genesisTick()
const GENESIS_TICK = 28_937_955;

export function formatArgonots(x: bigint | number): number {
  const isNegative = x < 0;
  const [whole, decimal] = (Math.abs(Number(x)) / 1e6).toFixed(2).split('.');
  if (decimal === '00') {
    return Number(`${isNegative ? '-' : ''}${BigInt(whole)}`);
  }
  const wholeNumber = BigInt(whole);
  return Number(`${isNegative ? '-' : ''}${wholeNumber}.${decimal}`);
}

export function bigIntMin(...args: bigint[]): bigint {
  if (args.length === 0) throw new Error('minBigInt requires at least one argument');
  return args.reduce((min, current) => (current < min ? current : min));
}

export function bigIntMax(...args: bigint[]): bigint {
  if (args.length === 0) throw new Error('bigIntMax requires at least one argument');
  return args.reduce((max, current) => (current > max ? current : max));
}

export function bigIntAbs(x: bigint): bigint {
  return x < 0n ? -x : x;
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

export function jsonParseWithBigInts(data: string): any {
  return JSON.parse(data, (_key, value) => {
    if (isBigIntString(value)) {
      return convertBigIntStringToNumber(value);
    }
    return value;
  });
}

export function calculateCurrentTickFromSystemTime(): number {
  return Math.floor(dayjs().utc().unix() / 60);
}

export function calculateCurrentFrameIdFromSystemTime(): number {
  const currentTick = calculateCurrentTickFromSystemTime();
  const slotOneStartTick = GENESIS_TICK + SLOT_BIDDING_START_AFTER_TICKS + TICKS_BETWEEN_SLOTS;
  const ticksSinceSlotOne = currentTick - slotOneStartTick;
  return Math.floor(ticksSinceSlotOne / TICKS_BETWEEN_SLOTS) + 1;
}
