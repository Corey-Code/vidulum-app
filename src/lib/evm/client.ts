/**
 * EVM Client
 *
 * Provides methods for interacting with EVM-compatible blockchains.
 * Uses JSON-RPC for balance queries and transaction handling.
 * Includes automatic failover across multiple RPC endpoints.
 */

import {
  networkRegistry,
  EvmNetworkConfig,
  withFailover,
  getHealthyEndpoint,
} from '@/lib/networks';

/**
 * JSON-RPC Error with code for proper failover handling
 */
export class RpcError extends Error {
  code: number;

  constructor(message: string, code: number) {
    super(message);
    this.name = 'RpcError';
    this.code = code;
  }
}

// Transaction structure
export interface EvmTransaction {
  hash: string;
  nonce: string;
  blockHash: string | null;
  blockNumber: string | null;
  transactionIndex: string | null;
  from: string;
  to: string | null;
  value: string;
  gasPrice: string;
  gas: string;
  input: string;
}

// Transaction receipt
export interface TransactionReceipt {
  transactionHash: string;
  transactionIndex: string;
  blockHash: string;
  blockNumber: string;
  from: string;
  to: string | null;
  cumulativeGasUsed: string;
  gasUsed: string;
  contractAddress: string | null;
  logs: Array<{
    address: string;
    topics: string[];
    data: string;
    blockNumber: string;
    transactionHash: string;
    transactionIndex: string;
    blockHash: string;
    logIndex: string;
    removed: boolean;
  }>;
  status: string; // '0x1' for success, '0x0' for failure
}

// Fee data
export interface FeeData {
  gasPrice: bigint;
  maxFeePerGas: bigint | null;
  maxPriorityFeePerGas: bigint | null;
}

/**
 * EVM Client Class with automatic endpoint failover
 */
export class EvmClient {
  private rpcUrls: string[];
  private chainId: number;
  private networkId: string;

  constructor(networkId: string) {
    const network = networkRegistry.getEvm(networkId);
    if (!network) {
      throw new Error(`EVM network ${networkId} not found`);
    }
    this.rpcUrls = network.rpcUrls;
    this.chainId = network.chainId;
    this.networkId = networkId;
  }

  /**
   * Get network configuration
   */
  getNetwork(): EvmNetworkConfig {
    const network = networkRegistry.getEvm(this.networkId);
    if (!network) {
      throw new Error(`EVM network ${this.networkId} not found`);
    }
    return network;
  }

  /**
   * Get all RPC URLs for this network
   */
  getRpcUrls(): string[] {
    return this.rpcUrls;
  }

  /**
   * Get the current healthy RPC URL
   */
  getHealthyRpcUrl(): string {
    return getHealthyEndpoint(this.rpcUrls) || this.rpcUrls[0];
  }

  /**
   * Make a JSON-RPC call with automatic failover
   */
  private async rpcCall<T>(method: string, params: unknown[] = []): Promise<T> {
    const { result } = await withFailover(this.rpcUrls, async (rpcUrl) => {
      const response = await fetch(rpcUrl, {
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
        throw new Error(`RPC request failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        // Throw RpcError with code so failover can detect server errors
        // Server errors (-32000 to -32099) should trigger failover
        // Client errors (-32600 to -32603) should not
        throw new RpcError(data.error.message || 'Unknown RPC error', data.error.code || -32000);
      }

      return data.result as T;
    });

    return result;
  }

  /**
   * Get balance in wei
   */
  async getBalance(address: string): Promise<bigint> {
    const result = await this.rpcCall<string>('eth_getBalance', [address, 'latest']);
    return BigInt(result);
  }

  /**
   * Get balance formatted in ETH
   */
  async getBalanceFormatted(address: string): Promise<string> {
    const wei = await this.getBalance(address);
    return formatEther(wei);
  }

  /**
   * Get current gas price
   */
  async getGasPrice(): Promise<bigint> {
    const result = await this.rpcCall<string>('eth_gasPrice', []);
    return BigInt(result);
  }

  /**
   * Get fee data (EIP-1559)
   */
  async getFeeData(): Promise<FeeData> {
    const gasPrice = await this.getGasPrice();

    // Try to get EIP-1559 fee data
    try {
      const block = await this.rpcCall<{ baseFeePerGas?: string }>('eth_getBlockByNumber', [
        'latest',
        false,
      ]);

      if (block.baseFeePerGas) {
        const baseFee = BigInt(block.baseFeePerGas);
        const maxPriorityFeePerGas = BigInt('1500000000'); // 1.5 gwei
        const maxFeePerGas = baseFee * 2n + maxPriorityFeePerGas;

        return {
          gasPrice,
          maxFeePerGas,
          maxPriorityFeePerGas,
        };
      }
    } catch (error) {
      console.warn('EIP-1559 not supported:', error);
    }

    return {
      gasPrice,
      maxFeePerGas: null,
      maxPriorityFeePerGas: null,
    };
  }

  /**
   * Get transaction count (nonce)
   */
  async getTransactionCount(address: string): Promise<number> {
    const result = await this.rpcCall<string>('eth_getTransactionCount', [address, 'latest']);
    return parseInt(result, 16);
  }

  /**
   * Estimate gas for a transaction
   */
  async estimateGas(tx: {
    from: string;
    to: string;
    value?: string;
    data?: string;
  }): Promise<bigint> {
    const result = await this.rpcCall<string>('eth_estimateGas', [tx]);
    return BigInt(result);
  }

  /**
   * Get transaction by hash
   */
  async getTransaction(txHash: string): Promise<EvmTransaction | null> {
    return await this.rpcCall<EvmTransaction | null>('eth_getTransactionByHash', [txHash]);
  }

  /**
   * Get transaction receipt
   */
  async getTransactionReceipt(txHash: string): Promise<TransactionReceipt | null> {
    return await this.rpcCall<TransactionReceipt | null>('eth_getTransactionReceipt', [txHash]);
  }

  /**
   * Send raw transaction
   */
  async sendRawTransaction(signedTx: string): Promise<string> {
    return await this.rpcCall<string>('eth_sendRawTransaction', [signedTx]);
  }

  /**
   * Get current block number
   */
  async getBlockNumber(): Promise<number> {
    const result = await this.rpcCall<string>('eth_blockNumber', []);
    return parseInt(result, 16);
  }

  /**
   * Get chain ID
   */
  async getChainId(): Promise<number> {
    const result = await this.rpcCall<string>('eth_chainId', []);
    return parseInt(result, 16);
  }
}

// Create singleton instances for each network
const evmClients: Map<string, EvmClient> = new Map();

export function getEvmClient(networkId: string): EvmClient {
  let client = evmClients.get(networkId);
  if (!client) {
    client = new EvmClient(networkId);
    evmClients.set(networkId, client);
  }
  return client;
}

/**
 * Format wei to ETH string
 */
export function formatEther(wei: bigint, decimals: number = 18): string {
  const divisor = 10n ** BigInt(decimals);
  const integerPart = wei / divisor;
  const fractionalPart = wei % divisor;

  // Pad fractional part with leading zeros
  const fractionalStr = fractionalPart.toString().padStart(decimals, '0');

  // Trim trailing zeros but keep at least 6 decimals for display
  let trimmedFractional = fractionalStr.replace(/0+$/, '');
  if (trimmedFractional.length < 6) {
    trimmedFractional = fractionalStr.slice(0, 6);
  }

  return `${integerPart}.${trimmedFractional || '0'}`;
}

/**
 * Parse ETH string to wei
 */
export function parseEther(eth: string, decimals: number = 18): bigint {
  const parts = eth.split('.');
  const integerPart = parts[0] || '0';
  let fractionalPart = parts[1] || '0';

  // Pad or truncate fractional part to match decimals
  if (fractionalPart.length < decimals) {
    fractionalPart = fractionalPart.padEnd(decimals, '0');
  } else {
    fractionalPart = fractionalPart.slice(0, decimals);
  }

  return BigInt(integerPart + fractionalPart);
}

/**
 * Format gwei
 */
export function formatGwei(wei: bigint): string {
  return formatEther(wei, 9);
}

/**
 * Parse gwei to wei
 */
export function parseGwei(gwei: string): bigint {
  return parseEther(gwei, 9);
}

/**
 * Validate EVM address
 */
export function isValidEvmAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Checksum an EVM address (EIP-55)
 */
export function checksumAddress(address: string): string {
  if (!isValidEvmAddress(address)) {
    throw new Error('Invalid address');
  }

  // For now, just lowercase it - full checksum requires keccak256
  // We'll implement proper checksumming when we add transaction signing
  return address.toLowerCase();
}
