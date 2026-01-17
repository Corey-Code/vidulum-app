/**
 * Bitcoin API Client
 * 
 * Provides methods for interacting with Bitcoin blockchain via Blockstream/Mempool APIs.
 * Supports balance queries, UTXO fetching, fee estimation, and transaction broadcasting.
 * Includes automatic failover across multiple API endpoints.
 */

import { networkRegistry, BitcoinNetworkConfig, fetchWithFailover } from '@/lib/networks';

// UTXO structure
export interface UTXO {
  txid: string;
  vout: number;
  value: number; // in satoshis
  status: {
    confirmed: boolean;
    block_height?: number;
    block_hash?: string;
    block_time?: number;
  };
}

// Transaction structure from API
export interface BitcoinTransaction {
  txid: string;
  version: number;
  locktime: number;
  vin: Array<{
    txid: string;
    vout: number;
    prevout: {
      scriptpubkey: string;
      scriptpubkey_address: string;
      value: number;
    };
    scriptsig: string;
    witness?: string[];
    sequence: number;
  }>;
  vout: Array<{
    scriptpubkey: string;
    scriptpubkey_address: string;
    value: number;
  }>;
  size: number;
  weight: number;
  fee: number;
  status: {
    confirmed: boolean;
    block_height?: number;
    block_hash?: string;
    block_time?: number;
  };
}

// Fee estimates structure
export interface FeeEstimates {
  fastestFee: number;    // sat/vB for next block
  halfHourFee: number;   // sat/vB for ~30 min
  hourFee: number;       // sat/vB for ~1 hour
  economyFee: number;    // sat/vB for economy
  minimumFee: number;    // minimum relay fee
}

// Address info structure
export interface AddressInfo {
  address: string;
  chain_stats: {
    funded_txo_count: number;
    funded_txo_sum: number;
    spent_txo_count: number;
    spent_txo_sum: number;
    tx_count: number;
  };
  mempool_stats: {
    funded_txo_count: number;
    funded_txo_sum: number;
    spent_txo_count: number;
    spent_txo_sum: number;
    tx_count: number;
  };
}

/**
 * Bitcoin API Client with automatic endpoint failover
 */
export class BitcoinClient {
  private apiUrls: string[];
  private networkId: string;

  constructor(networkId: string = 'bitcoin-mainnet') {
    const network = networkRegistry.getBitcoin(networkId);
    if (!network) {
      throw new Error(`Bitcoin network ${networkId} not found`);
    }
    this.apiUrls = network.apiUrls;
    this.networkId = networkId;
  }

  /**
   * Get network configuration
   */
  getNetwork(): BitcoinNetworkConfig {
    const network = networkRegistry.getBitcoin(this.networkId);
    if (!network) {
      throw new Error(`Bitcoin network ${this.networkId} not found`);
    }
    return network;
  }

  /**
   * Get all API URLs for this network
   */
  getApiUrls(): string[] {
    return this.apiUrls;
  }

  /**
   * Fetch address information including balance
   */
  async getAddressInfo(address: string): Promise<AddressInfo> {
    return await fetchWithFailover<AddressInfo>(
      this.apiUrls,
      `/address/${address}`
    );
  }

  /**
   * Get balance in satoshis
   */
  async getBalance(address: string): Promise<number> {
    const info = await this.getAddressInfo(address);
    
    // Balance = funded - spent (both confirmed and mempool)
    const confirmedBalance = info.chain_stats.funded_txo_sum - info.chain_stats.spent_txo_sum;
    const mempoolBalance = info.mempool_stats.funded_txo_sum - info.mempool_stats.spent_txo_sum;
    
    return confirmedBalance + mempoolBalance;
  }

  /**
   * Fetch UTXOs for an address
   */
  async getUTXOs(address: string): Promise<UTXO[]> {
    return await fetchWithFailover<UTXO[]>(
      this.apiUrls,
      `/address/${address}/utxo`
    );
  }

  /**
   * Get confirmed UTXOs only (safer for spending)
   */
  async getConfirmedUTXOs(address: string): Promise<UTXO[]> {
    const utxos = await this.getUTXOs(address);
    return utxos.filter(utxo => utxo.status.confirmed);
  }

  /**
   * Fetch transaction details
   */
  async getTransaction(txid: string): Promise<BitcoinTransaction> {
    return await fetchWithFailover<BitcoinTransaction>(
      this.apiUrls,
      `/tx/${txid}`
    );
  }

  /**
   * Get raw transaction hex
   * Note: This returns text, not JSON, so we handle it specially
   */
  async getRawTransaction(txid: string): Promise<string> {
    // Try each endpoint until one succeeds
    const errors: Error[] = [];
    
    for (const apiUrl of this.apiUrls) {
      try {
        const response = await fetch(`${apiUrl}/tx/${txid}/hex`, {
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch raw transaction: ${response.status}`);
        }
        return await response.text();
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
        continue;
      }
    }
    
    throw new Error(`All endpoints failed. Last error: ${errors[errors.length - 1]?.message}`);
  }

  /**
   * Fetch fee estimates
   */
  async getFeeEstimates(): Promise<FeeEstimates> {
    const estimates = await fetchWithFailover<Record<string, number>>(
      this.apiUrls,
      '/fee-estimates'
    );
    
    // API returns { "1": rate, "3": rate, "6": rate, ... } for target blocks
    return {
      fastestFee: Math.ceil(estimates['1'] || 20),
      halfHourFee: Math.ceil(estimates['3'] || 15),
      hourFee: Math.ceil(estimates['6'] || 10),
      economyFee: Math.ceil(estimates['144'] || 5),
      minimumFee: Math.ceil(estimates['1008'] || 1),
    };
  }

  /**
   * Broadcast a signed transaction
   * Note: This requires POST with text body, handled specially
   */
  async broadcastTransaction(txHex: string): Promise<string> {
    const errors: Error[] = [];
    
    for (const apiUrl of this.apiUrls) {
      try {
        const response = await fetch(`${apiUrl}/tx`, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain',
          },
          body: txHex,
          signal: AbortSignal.timeout(30000), // Longer timeout for broadcast
        });
        
        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Failed to broadcast transaction: ${error}`);
        }
        
        return await response.text(); // Returns txid
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
        continue;
      }
    }
    
    throw new Error(`All endpoints failed to broadcast. Last error: ${errors[errors.length - 1]?.message}`);
  }

  /**
   * Get recent transactions for an address
   */
  async getTransactions(address: string, lastSeenTxid?: string): Promise<BitcoinTransaction[]> {
    const path = lastSeenTxid 
      ? `/address/${address}/txs/chain/${lastSeenTxid}`
      : `/address/${address}/txs`;
    
    return await fetchWithFailover<BitcoinTransaction[]>(
      this.apiUrls,
      path
    );
  }

  /**
   * Get current block height
   * Note: Returns text number, not JSON
   */
  async getBlockHeight(): Promise<number> {
    const errors: Error[] = [];
    
    for (const apiUrl of this.apiUrls) {
      try {
        const response = await fetch(`${apiUrl}/blocks/tip/height`, {
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch block height: ${response.status}`);
        }
        return parseInt(await response.text(), 10);
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
        continue;
      }
    }
    
    throw new Error(`All endpoints failed. Last error: ${errors[errors.length - 1]?.message}`);
  }
}

// Create singleton instances for each network
const bitcoinClients: Map<string, BitcoinClient> = new Map();

export function getBitcoinClient(networkId: string = 'bitcoin-mainnet'): BitcoinClient {
  let client = bitcoinClients.get(networkId);
  if (!client) {
    client = new BitcoinClient(networkId);
    bitcoinClients.set(networkId, client);
  }
  return client;
}

/**
 * Calculate transaction fee for a given transaction size
 */
export function calculateFee(vBytes: number, feeRate: number): number {
  return Math.ceil(vBytes * feeRate);
}

/**
 * Estimate transaction size for P2WPKH (native SegWit)
 * Formula: 10.5 + 68 * numInputs + 31 * numOutputs (vBytes)
 */
export function estimateP2WPKHSize(numInputs: number, numOutputs: number): number {
  // Overhead: 10.5 vB (version, locktime, etc.)
  // Input: 68 vB each (41 bytes + 27 vB witness)
  // Output: 31 vB each (P2WPKH output)
  return Math.ceil(10.5 + 68 * numInputs + 31 * numOutputs);
}

/**
 * Select UTXOs for a transaction (simple algorithm)
 * Returns selected UTXOs and change amount
 */
export function selectUTXOs(
  utxos: UTXO[],
  targetAmount: number,
  feeRate: number
): { selected: UTXO[]; change: number; fee: number } | null {
  // Sort UTXOs by value descending
  const sorted = [...utxos].sort((a, b) => b.value - a.value);
  
  const selected: UTXO[] = [];
  let total = 0;
  
  for (const utxo of sorted) {
    selected.push(utxo);
    total += utxo.value;
    
    // Estimate fee with current selection (2 outputs: recipient + change)
    const estimatedSize = estimateP2WPKHSize(selected.length, 2);
    const fee = calculateFee(estimatedSize, feeRate);
    
    if (total >= targetAmount + fee) {
      const change = total - targetAmount - fee;
      
      // If change is too small (dust), don't create change output
      if (change < 546) {
        // Recalculate with 1 output
        const sizeNoChange = estimateP2WPKHSize(selected.length, 1);
        const feeNoChange = calculateFee(sizeNoChange, feeRate);
        
        if (total >= targetAmount + feeNoChange) {
          return { selected, change: 0, fee: total - targetAmount };
        }
      } else {
        return { selected, change, fee };
      }
    }
  }
  
  return null; // Insufficient funds
}

/**
 * Format satoshis to BTC string
 */
export function satsToBTC(satoshis: number): string {
  return (satoshis / 100_000_000).toFixed(8);
}

/**
 * Parse BTC to satoshis
 */
export function btcToSats(btc: number | string): number {
  const value = typeof btc === 'string' ? parseFloat(btc) : btc;
  return Math.round(value * 100_000_000);
}
