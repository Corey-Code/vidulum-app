/**
 * EVM Module
 *
 * Re-exports all EVM-related functionality.
 */

export {
  // Client
  EvmClient,
  getEvmClient,
  type EvmTransaction,
  type TransactionReceipt,
  type FeeData,

  // Errors
  RpcError,

  // Utilities
  formatEther,
  parseEther,
  formatGwei,
  parseGwei,
} from './client';

// Re-export address utilities from crypto module (proper EIP-55 implementation)
export { isValidEvmAddress, toChecksumAddress } from '@/lib/crypto/evm';
