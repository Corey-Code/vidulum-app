export interface Account {
  id: string;
  name: string;
  address: string;
  pubKey: Uint8Array;
  algo: string;
  derivationPath: string;
}

export interface ChainInfo {
  chainId: string;
  chainName: string;
  rpc: string;
  rest: string;
  bip44: {
    coinType: number;
  };
  bech32Config: {
    bech32PrefixAccAddr: string;
    bech32PrefixAccPub: string;
    bech32PrefixValAddr: string;
    bech32PrefixValPub: string;
    bech32PrefixConsAddr: string;
    bech32PrefixConsPub: string;
  };
  currencies: Currency[];
  feeCurrencies: Currency[];
  stakeCurrency: Currency;
  coinType?: number;
  features?: string[];
}

export interface Currency {
  coinDenom: string;
  coinMinimalDenom: string;
  coinDecimals: number;
  coinGeckoId?: string;
}

export interface WalletState {
  accounts: WalletAccount[];
  selectedAccount: WalletAccount | null;
  connectedDapps: Map<string, string[]>;
  isLocked: boolean;
  isInitialized: boolean;
}

export interface WalletAccount {
  id: string;
  name: string;
  address: string;
  pubKey: Uint8Array;
  algo: string;
  derivationPath: string;
}

export interface Balance {
  denom: string;
  amount: string;
}

export interface Transaction {
  hash: string;
  height: number;
  timestamp: string;
  from: string;
  to: string;
  amount: Balance[];
  fee: Balance[];
  memo?: string;
  status: 'success' | 'failed' | 'pending';
}
