export enum MessageType {
  // Keplr API
  ENABLE = 'enable',
  GET_KEY = 'getKey',
  SIGN_AMINO = 'signAmino',
  SIGN_DIRECT = 'signDirect',
  SIGN_ARBITRARY = 'signArbitrary',
  VERIFY_ARBITRARY = 'verifyArbitrary',

  // EVM/Ethereum API
  ETH_REQUEST_ACCOUNTS = 'eth_requestAccounts',
  ETH_ACCOUNTS = 'eth_accounts',
  ETH_CHAIN_ID = 'eth_chainId',
  ETH_SEND_TRANSACTION = 'eth_sendTransaction',
  ETH_SIGN_TRANSACTION = 'eth_signTransaction',
  ETH_SIGN = 'eth_sign',
  PERSONAL_SIGN = 'personal_sign',
  ETH_SIGN_TYPED_DATA = 'eth_signTypedData',
  ETH_SIGN_TYPED_DATA_V3 = 'eth_signTypedData_v3',
  ETH_SIGN_TYPED_DATA_V4 = 'eth_signTypedData_v4',
  WALLET_SWITCH_ETHEREUM_CHAIN = 'wallet_switchEthereumChain',
  WALLET_ADD_ETHEREUM_CHAIN = 'wallet_addEthereumChain',
  WALLET_WATCH_ASSET = 'wallet_watchAsset',
  ETH_GET_BALANCE = 'eth_getBalance',
  ETH_BLOCK_NUMBER = 'eth_blockNumber',
  ETH_CALL = 'eth_call',
  ETH_ESTIMATE_GAS = 'eth_estimateGas',
  ETH_GAS_PRICE = 'eth_gasPrice',

  // Solana/Phantom API
  SOL_CONNECT = 'sol_connect',
  SOL_DISCONNECT = 'sol_disconnect',
  SOL_SIGN_TRANSACTION = 'sol_signTransaction',
  SOL_SIGN_ALL_TRANSACTIONS = 'sol_signAllTransactions',
  SOL_SIGN_MESSAGE = 'sol_signMessage',
  SOL_SIGN_AND_SEND_TRANSACTION = 'sol_signAndSendTransaction',

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
