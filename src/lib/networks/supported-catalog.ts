/**
 * User-facing catalog of networks advertised as supported today.
 *
 * The live registry can include additional auto-synced chains. This list is the
 * curated set shown in Settings and kept in sync with README.md.
 *
 * Last reviewed: 2026-09-20 (leftover Cosmos explorer refresh).
 */

export { DEPRECATED_SVM_ENDPOINT_HOSTS } from './svm-endpoints';

export type SupportedNetworkFamily = 'cosmos' | 'utxo' | 'evm' | 'svm';

export interface SupportedNetworkEntry {
  id: string;
  name: string;
  symbol: string;
  family: SupportedNetworkFamily;
}

export const SUPPORTED_NETWORK_CATALOG_REVIEWED_AT = '2026-09-20';

export const SUPPORTED_NETWORK_CATALOG: readonly SupportedNetworkEntry[] = [
  { id: 'beezee-1', name: 'BeeZee', symbol: 'BZE', family: 'cosmos' },
  { id: 'osmosis-1', name: 'Osmosis', symbol: 'OSMO', family: 'cosmos' },
  { id: 'atomone-1', name: 'AtomOne', symbol: 'ATONE', family: 'cosmos' },
  { id: 'cosmoshub-4', name: 'Cosmos Hub', symbol: 'ATOM', family: 'cosmos' },

  { id: 'bitcoin-mainnet', name: 'Bitcoin', symbol: 'BTC', family: 'utxo' },
  { id: 'litecoin-mainnet', name: 'Litecoin', symbol: 'LTC', family: 'utxo' },
  { id: 'dogecoin-mainnet', name: 'Dogecoin', symbol: 'DOGE', family: 'utxo' },
  { id: 'zcash-mainnet', name: 'Zcash', symbol: 'ZEC', family: 'utxo' },
  { id: 'flux-mainnet', name: 'Flux', symbol: 'FLUX', family: 'utxo' },
  { id: 'ravencoin-mainnet', name: 'Ravencoin', symbol: 'RVN', family: 'utxo' },
  { id: 'ritocoin-mainnet', name: 'Ritocoin', symbol: 'RITO', family: 'utxo' },
  { id: 'bitcoinz-mainnet', name: 'BitcoinZ', symbol: 'BTCZ', family: 'utxo' },
  { id: 'noso-mainnet', name: 'NOSO', symbol: 'NOSO', family: 'utxo' },

  { id: 'eth-mainnet', name: 'Ethereum', symbol: 'ETH', family: 'evm' },
  { id: 'oeth-mainnet', name: 'OP Mainnet', symbol: 'ETH', family: 'evm' },
  { id: 'bnb-mainnet', name: 'BNB Chain', symbol: 'BNB', family: 'evm' },
  { id: 'pol-mainnet', name: 'Polygon', symbol: 'POL', family: 'evm' },
  { id: 'base-mainnet', name: 'Base', symbol: 'ETH', family: 'evm' },
  { id: 'arb1-mainnet', name: 'Arbitrum One', symbol: 'ETH', family: 'evm' },

  { id: 'solana-mainnet', name: 'Solana', symbol: 'SOL', family: 'svm' },
];

export function getSupportedNetworkFamilyLabel(family: SupportedNetworkFamily): string {
  switch (family) {
    case 'cosmos':
      return 'Cosmos';
    case 'utxo':
      return 'Bitcoin-like (UTXO)';
    case 'evm':
      return 'Ethereum-like (EVM)';
    case 'svm':
      return 'Solana (SVM)';
    default: {
      const _exhaustive: never = family;
      return _exhaustive;
    }
  }
}

export function getSupportedNetworkFamilySummary(family: SupportedNetworkFamily): string {
  switch (family) {
    case 'cosmos':
      return 'Staking, IBC transfers, and Cosmos assets load through current public RPC and LCD hosts. Explorer links use current hosts (Mintscan, ATOMScan, BeeZee Explorer); retired leftover explorers such as ezstaking.app, finder.kujira.app, and explorers.guru were removed.';
    case 'utxo':
      return 'Bitcoin and Litecoin can load balances today. Other Bitcoin-like networks still show your address. Explorer links use current hosts (CipherScan, Ravencoin Explorer, OKLink, Flux Blockbook); retired sites such as dogechain.info, explorer.runonflux.io, and explorer.nosocoin.com were removed.';
    case 'evm':
      return 'Ethereum and compatible networks load balances through current public RPCs. Retired hosts such as MyCrypto and MaticVigil were removed.';
    case 'svm':
      return 'Solana mainnet balances load through current public RPCs (official Solana and PublicNode). Retired or key-gated hosts such as Ankr public RPC and Solana dRPC were removed.';
    default: {
      const _exhaustive: never = family;
      return _exhaustive;
    }
  }
}

export function getSupportedNetworksByFamily(): Record<
  SupportedNetworkFamily,
  SupportedNetworkEntry[]
> {
  const families: SupportedNetworkFamily[] = ['cosmos', 'utxo', 'evm', 'svm'];
  return families.reduce(
    (grouped, family) => {
      grouped[family] = SUPPORTED_NETWORK_CATALOG.filter((entry) => entry.family === family);
      return grouped;
    },
    {
      cosmos: [],
      utxo: [],
      evm: [],
      svm: [],
    } as Record<SupportedNetworkFamily, SupportedNetworkEntry[]>
  );
}

export function formatCatalogReviewMonth(reviewedAt: string = SUPPORTED_NETWORK_CATALOG_REVIEWED_AT): string {
  const [year, month] = reviewedAt.split('-');
  const monthIndex = Number(month) - 1;
  const labels = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  return `${labels[monthIndex] ?? month} ${year}`;
}
