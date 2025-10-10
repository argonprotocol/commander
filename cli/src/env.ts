export default interface Env {
  ACCOUNT_SURI?: string;
  ACCOUNT_PASSPHRASE?: string;
  ACCOUNT_JSON_PATH?: string;
  SUBACCOUNT_RANGE?: string;
  MAINCHAIN_URL?: string;
  // A mini secret for session keys
  SESSION_MINI_SECRET?: string;
  // A version number for the keys
  KEYS_VERSION?: string;
}
