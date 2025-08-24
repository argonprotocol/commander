import { z } from 'zod';

export const VaultingRulesSchema = z.object({
  capitalForSecuritizationPct: z.number(),
  capitalForLiquidityPct: z.number(),

  securitizationRatio: z.number(),
  profitSharingPct: z.number(),
  btcFlatFee: z.bigint(),
  btcPctFee: z.number(),
  personalBtcInMicrogons: z.bigint(),

  btcUtilizationPctMin: z.number().min(0).max(100),
  btcUtilizationPctMax: z.number().min(0).max(100),

  poolUtilizationPctMin: z.number().min(0).max(100),
  poolUtilizationPctMax: z.number().min(0).max(100),

  baseCapitalCommitment: z.bigint(),
  requiredMicronots: z.bigint(),
});

export type IVaultingRules = z.infer<typeof VaultingRulesSchema>;

export default IVaultingRules;
