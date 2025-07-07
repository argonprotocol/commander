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

export enum SeatGoalType {
  Max = 'Max',
  Min = 'Min',
}

export enum SeatGoalInterval {
  Frame = 'Frame',
  Epoch = 'Epoch',
}

export const BiddingRulesSchema = z.object({
  argonCirculationGrowthPctMin: z.number(),
  argonCirculationGrowthPctMax: z.number(),
  micronotPriceChangeType: z.nativeEnum(MicronotPriceChangeType),
  micronotPriceChangePctMin: z.number(),
  micronotPriceChangePctMax: z.number(),
  startingBidAmountFormulaType: z.nativeEnum(BidAmountFormulaType),
  startingBidAmountAdjustmentType: z.nativeEnum(BidAmountAdjustmentType),
  startingBidAmountAbsolute: z.bigint(),
  startingBidAmountRelative: z.number(),
  rebiddingDelay: z.number(),
  rebiddingIncrementBy: z.bigint(),
  finalBidAmountFormulaType: z.nativeEnum(BidAmountFormulaType),
  finalBidAmountAdjustmentType: z.nativeEnum(BidAmountAdjustmentType),
  finalBidAmountAbsolute: z.bigint(),
  finalBidAmountRelative: z.number(),

  seatGoalType: z.nativeEnum(SeatGoalType),
  seatGoalCount: z.number(),
  seatGoalInterval: z.nativeEnum(SeatGoalInterval),

  requiredMicrogons: z.bigint(),
  requiredMicronots: z.bigint(),
});

export type IBiddingRules = z.infer<typeof BiddingRulesSchema>;

export default IBiddingRules;
