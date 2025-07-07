import { z } from 'zod';

export enum MicronotPriceChangeType {
  Between = 'Between',
  Exactly = 'Exactly',
}

export enum BidAmountFormulaType {
  PreviousDayLow = 'PreviousDayLow',
  PreviousDayMid = 'PreviousDayMid',
  PreviousDayHigh = 'PreviousDayHigh',
  MinimumBreakeven = 'MinimumBreakeven',
  RelativeBreakeven = 'RelativeBreakeven',
  OptimisticBreakeven = 'OptimisticBreakeven',
  Custom = 'Custom',
}

export enum BidAmountAdjustmentType {
  Absolute = 'Absolute',
  Relative = 'Relative',
}

export enum DisableBotType {
  AfterFirstSeat = 'AfterFirstSeat',
  AfterFirstSlot = 'AfterFirstSlot',
  Never = 'Never',
  Now = 'Now',
}

export const BiddingRulesSchema = z.object({
  calculatedTotalSeats: z.number(),
  calculatedArgonCirculation: z.number(),
  micronotPriceChangeType: z.nativeEnum(MicronotPriceChangeType),
  micronotPriceChangePctMin: z.number(),
  micronotPriceChangePctMax: z.number(),
  startingBidAmountFormulaType: z.nativeEnum(BidAmountFormulaType),
  startingBidAmountAdjustmentType: z.nativeEnum(BidAmountAdjustmentType),
  startingBidAmountAbsolute: z.bigint(),
  startingBidAmountRelative: z.number(),
  rebiddingDelay: z.number(),
  incrementAmount: z.bigint(),
  finalBidAmountFormulaType: z.nativeEnum(BidAmountFormulaType),
  finalBidAmountAdjustmentType: z.nativeEnum(BidAmountAdjustmentType),
  finalBidAmountAbsolute: z.bigint(),
  finalBidAmountRelative: z.number(),
  throttleSeats: z.boolean(),
  throttleSeatCount: z.number(),
  throttleSpending: z.boolean(),
  throttleSpendingAmount: z.bigint(),
  throttleDistributeEvenly: z.boolean(),
  disableBotType: z.nativeEnum(DisableBotType),
  requiredMicrogons: z.bigint(),
  requiredMicronots: z.bigint(),
  desiredMicrogons: z.bigint(),
  desiredMicronots: z.bigint(),
});

export type IBiddingRules = z.infer<typeof BiddingRulesSchema>;

export default IBiddingRules;
