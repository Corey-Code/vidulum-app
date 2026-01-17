/**
 * Bitcoin Module
 * 
 * Re-exports all Bitcoin-related functionality.
 */

export {
  // Client
  BitcoinClient,
  getBitcoinClient,
  type UTXO,
  type BitcoinTransaction,
  type FeeEstimates,
  type AddressInfo,
  
  // Utilities
  calculateFee,
  estimateP2WPKHSize,
  selectUTXOs,
  satsToBTC,
  btcToSats,
} from './client';
