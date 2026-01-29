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
  isValidEvmAddress,
  checksumAddress,
} from './client';
