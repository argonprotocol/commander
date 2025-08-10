export class SSHCommands {
  public static fetchUploadedWalletAddress = 'cat ~/address 2>/dev/null || true';
  public static fetchBiddingRules = 'cat ~/config/biddingRules.json 2>/dev/null || true';
  public static fetchEnvState = 'cat ~/config/.env.state 2>/dev/null || true';
}
