import { expect, it } from 'vitest';
import Countries from '../lib/Countries';

it('should return US for United States', async () => {
  const correctCountry = Countries.byISOCode('US');
  const foundCountry = Countries.closestMatch('United States');
  expect(foundCountry?.name).toBe(correctCountry?.name);
  expect(foundCountry?.value).toBe(correctCountry?.value);
});

it('should return US for USA', async () => {
  const correctCountry = Countries.byISOCode('US');
  const foundCountry = Countries.closestMatch('USA');
  expect(foundCountry?.name).toBe(correctCountry?.name);
  expect(foundCountry?.value).toBe(correctCountry?.value);
});

it('should return GB for United Kingdom', async () => {
  const correctCountry = Countries.byISOCode('GB');
  const foundCountry = Countries.closestMatch('United Kingdom');
  expect(foundCountry?.name).toBe(correctCountry?.name);
  expect(foundCountry?.value).toBe(correctCountry?.value);
});

it('should return exact match for exact country name', async () => {
  const correctCountry = Countries.byISOCode('CA');
  const foundCountry = Countries.closestMatch('Canada');
  expect(foundCountry?.name).toBe(correctCountry?.name);
  expect(foundCountry?.value).toBe(correctCountry?.value);
});
