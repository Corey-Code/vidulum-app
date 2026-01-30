/**
 * Keplr Wallet API Type Definitions
 *
 * These types define the Keplr-compatible API that dApps expect.
 * Based on @keplr-wallet/types but simplified for our use case.
 */

export interface Key {
  /** Name of the key/account */
  name: string;
  /** Signing algorithm (e.g., 'secp256k1') */
  algo: string;
  /** Public key bytes */
  pubKey: Uint8Array;
  /** Address bytes (may be empty for non-Ledger) */
  address: Uint8Array;
  /** Bech32-encoded address */
  bech32Address: string;
  /** Whether the key is from a Nano Ledger device */
  isNanoLedger: boolean;
  /** Whether the key is from a Keystone device */
  isKeystone: boolean;
}

export interface AminoSignResponse {
  signed: StdSignDoc;
  signature: StdSignature;
}

export interface StdSignDoc {
  chain_id: string;
  account_number: string;
  sequence: string;
  fee: StdFee;
  msgs: readonly AminoMsg[];
  memo: string;
}

export interface StdFee {
  readonly amount: readonly Coin[];
  readonly gas: string;
  readonly payer?: string;
  readonly granter?: string;
}

export interface Coin {
  readonly denom: string;
  readonly amount: string;
}

export interface AminoMsg {
  readonly type: string;
  readonly value: unknown;
}

export interface StdSignature {
  readonly pub_key: Pubkey;
  readonly signature: string;
}

export interface Pubkey {
  readonly type: string;
  readonly value: string;
}

export interface DirectSignResponse {
  signed: {
    bodyBytes: Uint8Array;
    authInfoBytes: Uint8Array;
    chainId: string;
    accountNumber: bigint;
  };
  signature: StdSignature;
}

export interface SignDoc {
  bodyBytes?: Uint8Array | null;
  authInfoBytes?: Uint8Array | null;
  chainId?: string | null;
  accountNumber?: bigint | string | null;
}

export interface OfflineAminoSigner {
  readonly getAccounts: () => Promise<readonly AccountData[]>;
  readonly signAmino: (signerAddress: string, signDoc: StdSignDoc) => Promise<AminoSignResponse>;
}

export interface OfflineDirectSigner {
  readonly getAccounts: () => Promise<readonly AccountData[]>;
  readonly signDirect: (signerAddress: string, signDoc: SignDoc) => Promise<DirectSignResponse>;
}

export interface AccountData {
  readonly address: string;
  readonly pubkey: Uint8Array;
  readonly algo: 'secp256k1' | 'ed25519' | 'sr25519';
}

export interface ChainInfo {
  readonly chainId: string;
  readonly chainName: string;
  readonly rpc: string;
  readonly rest: string;
  readonly bip44: {
    readonly coinType: number;
  };
  readonly bech32Config: {
    readonly bech32PrefixAccAddr: string;
    readonly bech32PrefixAccPub: string;
    readonly bech32PrefixValAddr: string;
    readonly bech32PrefixValPub: string;
    readonly bech32PrefixConsAddr: string;
    readonly bech32PrefixConsPub: string;
  };
  readonly currencies: readonly Currency[];
  readonly feeCurrencies: readonly Currency[];
  readonly stakeCurrency: Currency;
}

export interface Currency {
  readonly coinDenom: string;
  readonly coinMinimalDenom: string;
  readonly coinDecimals: number;
  readonly coinGeckoId?: string;
}

export interface SignOptions {
  readonly preferNoSetFee?: boolean;
  readonly preferNoSetMemo?: boolean;
  readonly disableBalanceCheck?: boolean;
}

/**
 * Keplr Wallet API Interface
 */
export interface Keplr {
  /** Keplr compatibility version */
  readonly version: string;

  /** Mode: 'extension' | 'mobile-web' | 'walletconnect' */
  readonly mode: 'extension' | 'mobile-web' | 'walletconnect';

  /**
   * Request access to one or more chains
   */
  enable(chainIds: string | string[]): Promise<void>;

  /**
   * Disconnect from one or more chains
   */
  disable(chainIds?: string | string[]): Promise<void>;

  /**
   * Get account key for a chain
   */
  getKey(chainId: string): Promise<Key>;

  /**
   * Sign an Amino-encoded transaction
   */
  signAmino(
    chainId: string,
    signer: string,
    signDoc: StdSignDoc,
    signOptions?: SignOptions
  ): Promise<AminoSignResponse>;

  /**
   * Sign a Direct (Protobuf) transaction
   */
  signDirect(
    chainId: string,
    signer: string,
    signDoc: SignDoc,
    signOptions?: SignOptions
  ): Promise<DirectSignResponse>;

  /**
   * Sign arbitrary data (ADR-036)
   */
  signArbitrary(chainId: string, signer: string, data: string | Uint8Array): Promise<StdSignature>;

  /**
   * Verify arbitrary data signature
   */
  verifyArbitrary(
    chainId: string,
    signer: string,
    data: string | Uint8Array,
    signature: StdSignature
  ): Promise<boolean>;

  /**
   * Get offline signer (Amino)
   */
  getOfflineSigner(chainId: string): OfflineAminoSigner;

  /**
   * Get offline signer (Amino only, for Ledger compatibility)
   */
  getOfflineSignerOnlyAmino(chainId: string): OfflineAminoSigner;

  /**
   * Get offline signer that automatically selects Amino or Direct
   */
  getOfflineSignerAuto(chainId: string): Promise<OfflineAminoSigner | OfflineDirectSigner>;

  /**
   * Suggest a chain to be added to the wallet
   */
  experimentalSuggestChain(chainInfo: ChainInfo): Promise<void>;

  /**
   * Get chain info for enabled chains (without endpoints)
   */
  getChainInfosWithoutEndpoints(): Promise<ChainInfo[]>;
}
