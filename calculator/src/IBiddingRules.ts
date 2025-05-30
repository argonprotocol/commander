export default interface IBiddingRules {
  calculatedTotalSeats: number;
  calculatedArgonCirculation: number;
  argonotPriceChangeType: 'Between' | 'Exactly';
  argonotPriceChangeMin: number;
  argonotPriceChangeMax: number;
  startingAmountFormulaType:
    | 'PreviousLowestBid'
    | 'MinimumBreakeven'
    | 'OptimisticBreakeven'
    | 'Custom';
  startingAmountFormulaIncrease: number;
  startingAmount: number;
  rebiddingDelay: number;
  incrementAmount: number;
  finalAmountFormulaType:
    | 'PreviousHighestBid'
    | 'MinimumBreakeven'
    | 'OptimisticBreakeven'
    | 'Custom';
  finalAmountFormulaIncrease: number;
  finalAmount: number;
  throttleSeats: boolean;
  throttleSeatCount: number;
  throttleSpending: boolean;
  throttleSpendingAmount: number;
  throttleDistributeEvenly: boolean;
  disableBot: 'AfterFirstSeat' | 'AfterFirstSlot' | 'Never' | 'Now';
  requiredArgons: number;
  requiredArgonots: number;
  desiredArgons: number;
  desiredArgonots: number;
}
