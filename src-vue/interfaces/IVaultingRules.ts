import { z } from 'zod';

export const VaultingRulesSchema = z.object({
  capitalForSecuritizationPct: z.number(),
  capitalForLiquidityPct: z.number(),

  securitizationRatio: z.number(),
  profitSharingPct: z.number(),
  btcFlatFee: z.bigint(),
  btcPctFee: z.number(),
  personalBtcValue: z.bigint(),

  requiredMicrogons: z.bigint(),
  requiredMicronots: z.bigint(),
});

export type IVaultingRules = z.infer<typeof VaultingRulesSchema>;

export default IVaultingRules;
