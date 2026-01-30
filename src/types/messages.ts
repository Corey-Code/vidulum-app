export enum MessageType {
  // Keplr API
  ENABLE = 'enable',
  GET_KEY = 'getKey',
  SIGN_AMINO = 'signAmino',
  SIGN_DIRECT = 'signDirect',
  SIGN_ARBITRARY = 'signArbitrary',
  VERIFY_ARBITRARY = 'verifyArbitrary',

  // Wallet operations
  CREATE_WALLET = 'createWallet',
  IMPORT_WALLET = 'importWallet',
  UNLOCK_WALLET = 'unlockWallet',
  LOCK_WALLET = 'lockWallet',
  SYNC_KEYRING = 'syncKeyring', // Sync serialized keyring from popup to background
  GET_ACCOUNTS = 'getAccounts',
  GET_BALANCE = 'getBalance',

  // Connection
  REQUEST_CONNECTION = 'requestConnection',
  DISCONNECT = 'disconnect',
  GET_CONNECTION_STATUS = 'getConnectionStatus',

  // Approval system
  GET_APPROVAL = 'getApproval',
  RESOLVE_APPROVAL = 'resolveApproval',
}

export interface Message {
  type: MessageType;
  payload?: unknown;
  origin?: string;
  id?: string;
}

export interface MessageResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  id?: string;
}
