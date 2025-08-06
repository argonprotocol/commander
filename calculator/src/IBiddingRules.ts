import { z } from 'zod';

export enum MicronotPriceChangeType {
  Between = 'Between',
  Exactly = 'Exactly',
}

export enum BidAmountFormulaType {
  PreviousDayLow = 'PreviousDayLow',
  PreviousDayMid = 'PreviousDayMid',
  PreviousDayHigh = 'PreviousDayHigh',
  BreakevenAtSlowGrowth = 'BreakevenAtSlowGrowth',
  BreakevenAtMediumGrowth = 'BreakevenAtMediumGrowth',
  BreakevenAtFastGrowth = 'BreakevenAtFastGrowth',
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
  argonotPriceChangeType: z.nativeEnum(MicronotPriceChangeType),
  argonotPriceChangePctMin: z.number(),
  argonotPriceChangePctMax: z.number(),
  minimumBidFormulaType: z.nativeEnum(BidAmountFormulaType),
  minimumBidAdjustmentType: z.nativeEnum(BidAmountAdjustmentType),
  minimumBidCustom: z.bigint(),
  minimumBidAdjustAbsolute: z.bigint(),
  minimumBidAdjustRelative: z.number(),
  rebiddingDelay: z.number(),
  rebiddingIncrementBy: z.bigint(),
  maximumBidFormulaType: z.nativeEnum(BidAmountFormulaType),
  maximumBidAdjustmentType: z.nativeEnum(BidAmountAdjustmentType),
  maximumBidCustom: z.bigint(),
  maximumBidAdjustAbsolute: z.bigint(),
  maximumBidAdjustRelative: z.number(),

  seatGoalType: z.nativeEnum(SeatGoalType),
  seatGoalCount: z.number(),
  seatGoalInterval: z.nativeEnum(SeatGoalInterval),

  baseCapitalCommitment: z.bigint(),
  requiredMicronots: z.bigint(),
});

export type IBiddingRules = z.infer<typeof BiddingRulesSchema>;
