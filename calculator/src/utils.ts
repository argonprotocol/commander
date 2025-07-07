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
  if (args.length === 0) throw new Error('maxBigInt requires at least one argument');
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

export function calculateCurrentTickFromSystemTime(): number {
  return Math.floor(dayjs().utc().unix() / 60);
}

export function calculateCurrentFrameIdFromSystemTime(): number {
  const currentTick = calculateCurrentTickFromSystemTime();
  const slotOneStartTick = GENESIS_TICK + SLOT_BIDDING_START_AFTER_TICKS + TICKS_BETWEEN_SLOTS;
  const ticksSinceSlotOne = currentTick - slotOneStartTick;
  return Math.floor(ticksSinceSlotOne / TICKS_BETWEEN_SLOTS) + 1;
}
