export function formatArgonots(x: bigint | number): number {
  const isNegative = x < 0;
  const [whole, decimal] = (Math.abs(Number(x)) / 1e6).toFixed(2).split('.');
  if (decimal === '00') {
    return Number(`${isNegative ? '-' : ''}${BigInt(whole)}`);
  }
  const wholeNumber = BigInt(whole);
  return Number(`${isNegative ? '-' : ''}${wholeNumber}.${decimal}`);
}
