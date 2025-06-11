import { ArgonotPriceChangeType, DisableBotType, FinalAmountFormulaType, StartingAmountFormulaType } from "../../src-vue/interfaces/IBiddingRules";

export default interface IBiddingRules {
  calculatedTotalSeats: number;
  calculatedArgonCirculation: number;
  argonotPriceChangeType: ArgonotPriceChangeType;
  argonotPriceChangeMin: number;
  argonotPriceChangeMax: number;
  startingAmountFormulaType: StartingAmountFormulaType;
  startingAmountFormulaIncrease: number;
  startingAmount: number;
  rebiddingDelay: number;
  incrementAmount: number;
  finalAmountFormulaType: FinalAmountFormulaType;
  finalAmountFormulaIncrease: number;
  finalAmount: number;
  throttleSeats: boolean;
  throttleSeatCount: number;
  throttleSpending: boolean;
  throttleSpendingAmount: number;
  throttleDistributeEvenly: boolean;
  disableBot: DisableBotType;
  requiredArgons: number;
  requiredArgonots: number;
  desiredArgons: number;
  desiredArgonots: number;
}
