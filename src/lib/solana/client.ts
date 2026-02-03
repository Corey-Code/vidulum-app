/**
 * Solana RPC Client
 *
 * Handles all Solana JSON-RPC interactions including:
 * - Balance queries (SOL and SPL tokens)
 * - Transaction building and sending
 * - Account info queries
 */

import type { SvmNetworkConfig } from '../networks/types';

export interface SolanaBalance {
  lamports: bigint;
  sol: number;
}

export interface TokenAccountInfo {
  mint: string;
  owner: string;
  amount: string;
  decimals: number;
}

export interface TokenBalance {
  mint: string;
  amount: bigint;
  decimals: number;
  uiAmount: number;
}

interface RpcResponse<T> {
  jsonrpc: string;
  id: number;
  result?: T;
  error?: {
    code: number;
    message: string;
  };
}

interface GetBalanceResult {
  context: { slot: number };
  value: number;
}

interface GetTokenAccountsResult {
  context: { slot: number };
  value: Array<{
    pubkey: string;
    account: {
      data: {
        parsed: {
          info: {
            mint: string;
            owner: string;
            tokenAmount: {
              amount: string;
              decimals: number;
              uiAmount: number;
            };
          };
          type: string;
        };
        program: string;
        space: number;
      };
      executable: boolean;
      lamports: number;
      owner: string;
      rentEpoch: number;
    };
  }>;
}

export class SolanaClient {
  private rpcUrl: string;
  private network: SvmNetworkConfig;

  constructor(network: SvmNetworkConfig) {
    this.network = network;
    this.rpcUrl = network.rpcUrls[0];
  }

  /**
   * Make an RPC request to the Solana node
   */
  private async rpcRequest<T>(method: string, params: unknown[] = []): Promise<T> {
    const response = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        params,
      }),
    });

    if (!response.ok) {
      throw new Error(`RPC request failed: ${response.status} ${response.statusText}`);
    }

    const data: RpcResponse<T> = await response.json();

    if (data.error) {
      throw new Error(`RPC error: ${data.error.message} (code: ${data.error.code})`);
    }

    if (data.result === undefined) {
      throw new Error('No result in RPC response');
    }

    return data.result;
  }

  /**
   * Get SOL balance for an address
   */
  async getBalance(address: string): Promise<SolanaBalance> {
    const result = await this.rpcRequest<GetBalanceResult>('getBalance', [
      address,
      { commitment: 'confirmed' },
    ]);

    const lamports = BigInt(result.value);
    const sol = Number(lamports) / 1e9; // 1 SOL = 10^9 lamports

    return { lamports, sol };
  }

  /**
   * Get all SPL token balances for an address
   */
  async getTokenBalances(ownerAddress: string): Promise<TokenBalance[]> {
    const result = await this.rpcRequest<GetTokenAccountsResult>('getTokenAccountsByOwner', [
      ownerAddress,
      { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' }, // SPL Token Program
      {
        encoding: 'jsonParsed',
        commitment: 'confirmed',
      },
    ]);

    return result.value.map((account) => {
      const info = account.account.data.parsed.info;
      return {
        mint: info.mint,
        amount: BigInt(info.tokenAmount.amount),
        decimals: info.tokenAmount.decimals,
        uiAmount: info.tokenAmount.uiAmount,
      };
    });
  }

  /**
   * Get the current slot
   */
  async getSlot(): Promise<number> {
    return this.rpcRequest<number>('getSlot', [{ commitment: 'confirmed' }]);
  }

  /**
   * Get recent blockhash for transaction signing
   */
  async getRecentBlockhash(): Promise<{ blockhash: string; lastValidBlockHeight: number }> {
    const result = await this.rpcRequest<{
      context: { slot: number };
      value: {
        blockhash: string;
        lastValidBlockHeight: number;
      };
    }>('getLatestBlockhash', [{ commitment: 'confirmed' }]);

    return result.value;
  }

  /**
   * Get minimum balance for rent exemption
   */
  async getMinimumBalanceForRentExemption(dataLength: number): Promise<number> {
    return this.rpcRequest<number>('getMinimumBalanceForRentExemption', [dataLength]);
  }

  /**
   * Send a signed transaction
   */
  async sendTransaction(signedTransaction: string): Promise<string> {
    return this.rpcRequest<string>('sendTransaction', [
      signedTransaction,
      {
        encoding: 'base64',
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      },
    ]);
  }

  /**
   * Get transaction status
   */
  async getSignatureStatus(signature: string): Promise<{
    slot: number;
    confirmations: number | null;
    err: unknown | null;
    confirmationStatus: 'processed' | 'confirmed' | 'finalized' | null;
  } | null> {
    const result = await this.rpcRequest<{
      context: { slot: number };
      value: Array<{
        slot: number;
        confirmations: number | null;
        err: unknown | null;
        confirmationStatus: 'processed' | 'confirmed' | 'finalized' | null;
      } | null>;
    }>('getSignatureStatuses', [[signature]]);

    return result.value[0];
  }

  /**
   * Get account info
   */
  async getAccountInfo(address: string): Promise<{
    executable: boolean;
    owner: string;
    lamports: number;
    data: string;
    rentEpoch: number;
  } | null> {
    const result = await this.rpcRequest<{
      context: { slot: number };
      value: {
        executable: boolean;
        owner: string;
        lamports: number;
        data: [string, string];
        rentEpoch: number;
      } | null;
    }>('getAccountInfo', [address, { encoding: 'base64', commitment: 'confirmed' }]);

    if (!result.value) {
      return null;
    }

    return {
      executable: result.value.executable,
      owner: result.value.owner,
      lamports: result.value.lamports,
      data: result.value.data[0],
      rentEpoch: result.value.rentEpoch,
    };
  }

  /**
   * Get the network configuration
   */
  getNetwork(): SvmNetworkConfig {
    return this.network;
  }

  /**
   * Switch to a different RPC URL (for failover)
   */
  switchRpcUrl(index: number): void {
    if (index >= 0 && index < this.network.rpcUrls.length) {
      this.rpcUrl = this.network.rpcUrls[index];
    }
  }
}

/**
 * Create a Solana client for a network
 */
export function createSolanaClient(network: SvmNetworkConfig): SolanaClient {
  return new SolanaClient(network);
}
