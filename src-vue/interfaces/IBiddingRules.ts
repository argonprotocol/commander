import { z } from 'zod';

export enum ArgonotPriceChangeType {
  Between = 'Between',
  Exactly = 'Exactly',
}

export enum StartingAmountFormulaType {
  PreviousLowestBid = 'PreviousLowestBid',
  MinimumBreakeven = 'MinimumBreakeven',
  OptimisticBreakeven = 'OptimisticBreakeven',
  Custom = 'Custom',
}

export enum FinalAmountFormulaType {
  PreviousHighestBid = 'PreviousHighestBid',
  MinimumBreakeven = 'MinimumBreakeven',
  OptimisticBreakeven = 'OptimisticBreakeven',
  Custom = 'Custom',
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
  argonotPriceChangeType: z.nativeEnum(ArgonotPriceChangeType),
  argonotPriceChangeMin: z.number(),
  argonotPriceChangeMax: z.number(),
  startingAmountFormulaType: z.nativeEnum(StartingAmountFormulaType),
  startingAmountFormulaIncrease: z.number(),
  startingAmount: z.number(),
  rebiddingDelay: z.number(),
  incrementAmount: z.number(),
  finalAmountFormulaType: z.nativeEnum(FinalAmountFormulaType),
  finalAmountFormulaIncrease: z.number(),
  finalAmount: z.number(),
  throttleSeats: z.boolean(),
  throttleSeatCount: z.number(),
  throttleSpending: z.boolean(),
  throttleSpendingAmount: z.number(),
  throttleDistributeEvenly: z.boolean(),
  disableBot: z.nativeEnum(DisableBotType),
  requiredArgons: z.number(),
  requiredArgonots: z.number(),
  desiredArgons: z.number(),
  desiredArgonots: z.number(),
});

export type IBiddingRules = z.infer<typeof BiddingRulesSchema>;
