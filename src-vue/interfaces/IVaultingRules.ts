import { z } from 'zod';

export const VaultingRulesSchema = z.object({
  requiredMicrogons: z.bigint(),
  requiredMicronots: z.bigint(),
});

export type IVaultingRules = z.infer<typeof VaultingRulesSchema>;

export default IVaultingRules;
