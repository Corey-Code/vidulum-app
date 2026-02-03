# Adding a New Network Type to Vidulum

This guide documents the complete process of adding a new blockchain network type (e.g., SVM/Solana, EVM, etc.) to the Vidulum wallet extension. This is different from adding a new chain to an existing network type (see `ADDING_COSMOS_CHAIN.md`, `ADDING_EVM_CHAIN.md`, `ADDING_UTXO_CHAIN.md` for those).

## Overview

Adding a new network type requires modifications across multiple layers of the application:

1. **Type Definitions** - Define the network configuration interface
2. **Network Configurations** - Create network-specific configurations
3. **Cryptography** - Implement key derivation and signing
4. **RPC Client** - Create client for blockchain interactions
5. **Keyring** - Add account management to the keyring
6. **Storage** - Update encrypted storage for derived addresses
7. **Wallet Store** - Add state management methods
8. **Network Registry** - Register and export the new network type
9. **Assets (Optional)** - Define known tokens for the network
10. **UI Components** - Update Dashboard and other UI components
11. **Tests** - Add comprehensive tests

---

## Step 1: Type Definitions

### File: `src/lib/networks/types.ts`

Add the new network type to the `NetworkType` union and create a configuration interface.

```typescript
// Add to NetworkType union
export type NetworkType = 'cosmos' | 'bitcoin' | 'evm' | 'svm' | 'YOUR_NEW_TYPE';

// Create new network config interface
export interface YourNetworkConfig extends BaseNetworkConfig {
  type: 'your_type';
  // Add network-specific fields
  yourSpecificField: string;
  rpcUrls: string[];
  // ... other required fields
}

// Update the NetworkConfig union
export type NetworkConfig =
  | CosmosNetworkConfig
  | BitcoinNetworkConfig
  | EvmNetworkConfig
  | SvmNetworkConfig
  | YourNetworkConfig;
```

### Required Fields in BaseNetworkConfig:

- `id` - Unique identifier (e.g., 'solana-mainnet')
- `name` - Display name
- `symbol` - Native token symbol
- `type` - Network type discriminator
- `enabled` - Whether the network is enabled by default
- `explorerUrl` - Block explorer base URL
- `explorerAccountPath` - Path template for account pages
- `explorerTxPath` - Path template for transaction pages

---

## Step 2: Network Configurations

### File: `src/lib/networks/your_network.ts` (new file)

Create network configurations for mainnet, testnet, etc.

```typescript
import type { YourNetworkConfig } from './types';

export const YOUR_NETWORK_MAINNET: YourNetworkConfig = {
  id: 'your-network-mainnet',
  name: 'Your Network',
  symbol: 'TOKEN',
  type: 'your_type',
  enabled: true,
  explorerUrl: 'https://explorer.yournetwork.com',
  explorerAccountPath: '/address/{address}',
  explorerTxPath: '/tx/{txHash}',
  rpcUrls: ['https://rpc1.yournetwork.com', 'https://rpc2.yournetwork.com'],
  // ... network-specific fields
};

export const YOUR_NETWORK_TESTNET: YourNetworkConfig = {
  // ... testnet config
};

// Array of all networks for this type
export const YOUR_NETWORKS: YourNetworkConfig[] = [YOUR_NETWORK_MAINNET, YOUR_NETWORK_TESTNET];

// Helper functions
export function getYourNetworkById(id: string): YourNetworkConfig | undefined {
  return YOUR_NETWORKS.find((n) => n.id === id);
}

export function getEnabledYourNetworks(): YourNetworkConfig[] {
  return YOUR_NETWORKS.filter((n) => n.enabled);
}
```

---

## Step 3: Cryptography

### File: `src/lib/crypto/your_network.ts` (new file)

Implement key derivation specific to your network's cryptographic requirements.

```typescript
import { mnemonicToSeedSync } from 'bip39';
// Import relevant crypto libraries

export interface YourNetworkKeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
  address: string;
}

/**
 * Get the BIP44 derivation path for this network
 * @param accountIndex - Account index (default: 0)
 * @returns BIP44 path string
 */
export function getYourNetworkDerivationPath(accountIndex: number = 0): string {
  // Use the appropriate coin type from SLIP-44
  // https://github.com/satoshilabs/slips/blob/master/slip-0044.md
  return `m/44'/${COIN_TYPE}'/${accountIndex}'/0/0`;
}

/**
 * Derive keypair from mnemonic
 */
export async function deriveYourNetworkKeyPair(
  mnemonic: string,
  accountIndex: number = 0
): Promise<YourNetworkKeyPair> {
  const seed = mnemonicToSeedSync(mnemonic);

  // Implement key derivation based on network requirements
  // - secp256k1 for Bitcoin/EVM-like chains
  // - Ed25519 for Solana-like chains (use SLIP-0010)
  // - Other curves as needed

  return {
    publicKey,
    privateKey,
    address,
  };
}

/**
 * Get address from mnemonic
 */
export async function getYourNetworkAddress(
  mnemonic: string,
  accountIndex: number = 0
): Promise<string> {
  const keyPair = await deriveYourNetworkKeyPair(mnemonic, accountIndex);
  return keyPair.address;
}

/**
 * Validate an address
 */
export function isValidYourNetworkAddress(address: string): boolean {
  // Implement address validation logic
  return true;
}
```

### Key Derivation Standards:

- **secp256k1 (Bitcoin, Ethereum)**: Use BIP32/BIP44
- **Ed25519 (Solana)**: Use SLIP-0010
- **Other curves**: Implement according to network specifications

---

## Step 4: RPC Client

### Files: `src/lib/your_network/client.ts` and `src/lib/your_network/index.ts` (new files)

Create the RPC client for blockchain interactions.

```typescript
// src/lib/your_network/client.ts
import type { YourNetworkConfig } from '../networks/types';

export interface YourNetworkBalance {
  amount: bigint;
  formatted: number;
}

export class YourNetworkClient {
  private rpcUrl: string;
  private network: YourNetworkConfig;

  constructor(network: YourNetworkConfig) {
    this.network = network;
    this.rpcUrl = network.rpcUrls[0];
  }

  /**
   * Make an RPC request
   */
  private async rpcRequest<T>(method: string, params: unknown[] = []): Promise<T> {
    const response = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        params,
      }),
    });

    const data = await response.json();
    if (data.error) {
      throw new Error(`RPC error: ${data.error.message}`);
    }
    return data.result;
  }

  /**
   * Get native token balance
   */
  async getBalance(address: string): Promise<YourNetworkBalance> {
    // Implement balance query
  }

  /**
   * Get token balances (if applicable)
   */
  async getTokenBalances(address: string): Promise<TokenBalance[]> {
    // Implement token balance query
  }

  /**
   * Send a transaction
   */
  async sendTransaction(signedTx: string): Promise<string> {
    // Implement transaction sending
  }

  /**
   * Get transaction status
   */
  async getTransactionStatus(txHash: string): Promise<TransactionStatus> {
    // Implement status query
  }

  /**
   * Switch RPC URL (for failover)
   */
  switchRpcUrl(index: number): void {
    if (index >= 0 && index < this.network.rpcUrls.length) {
      this.rpcUrl = this.network.rpcUrls[index];
    }
  }
}

export function createYourNetworkClient(network: YourNetworkConfig): YourNetworkClient {
  return new YourNetworkClient(network);
}
```

```typescript
// src/lib/your_network/index.ts
export { YourNetworkClient, createYourNetworkClient } from './client';
export type { YourNetworkBalance, TokenBalance } from './client';
```

---

## Step 5: Keyring

### File: `src/lib/crypto/keyring.ts`

Add account management for the new network type.

### 5.1 Add Import

```typescript
import { deriveYourNetworkKeyPair, getYourNetworkDerivationPath } from './your_network';
```

### 5.2 Add Account Interface

```typescript
export interface YourNetworkKeyringAccount {
  id: string;
  name: string;
  address: string;
  publicKey: Uint8Array;
  privateKey: Uint8Array;
  networkSpecificField: string; // e.g., chainId, cluster
  hdPath: string;
  accountIndex: number;
}
```

### 5.3 Add Private Map in Keyring Class

```typescript
export class Keyring {
  // ... existing fields
  private yourNetworkAccounts: Map<string, YourNetworkKeyringAccount> = new Map();
```

### 5.4 Add Derivation Method

```typescript
  /**
   * Derive an account for your network type
   */
  async deriveYourNetworkAccount(
    networkId: string,
    networkSpecificParam: string,
    accountIndex: number = 0
  ): Promise<YourNetworkKeyringAccount> {
    if (!this.mnemonic) {
      throw new Error('Wallet not initialized');
    }

    const accountKey = this.getAccountKey(networkId, accountIndex);
    const existing = this.yourNetworkAccounts.get(accountKey);
    if (existing && existing.privateKey.length > 0) {
      return existing;
    }

    const keyPair = await deriveYourNetworkKeyPair(this.mnemonic, accountIndex);
    const path = getYourNetworkDerivationPath(accountIndex);

    const account: YourNetworkKeyringAccount = {
      id: `your-network-${networkId}-${accountIndex}`,
      name: `Your Network Account ${accountIndex + 1}`,
      address: keyPair.address,
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey,
      networkSpecificField: networkSpecificParam,
      hdPath: path,
      accountIndex,
    };

    this.yourNetworkAccounts.set(accountKey, account);
    return account;
  }
```

### 5.5 Add Getter Methods

```typescript
  getYourNetworkAccount(networkId: string, accountIndex: number = 0): YourNetworkKeyringAccount | undefined {
    const accountKey = this.getAccountKey(networkId, accountIndex);
    return this.yourNetworkAccounts.get(accountKey);
  }

  getAllYourNetworkAccounts(): YourNetworkKeyringAccount[] {
    return Array.from(this.yourNetworkAccounts.values());
  }

  getYourNetworkAddress(networkId: string, accountIndex: number = 0): string | undefined {
    const accountKey = this.getAccountKey(networkId, accountIndex);
    return this.yourNetworkAccounts.get(accountKey)?.address;
  }

  async getYourNetworkPrivateKey(networkId: string, accountIndex: number = 0): Promise<Uint8Array | undefined> {
    // Implementation with re-derivation logic if needed
  }
```

### 5.6 Update Serialization

Add to the `serialize()` method:

```typescript
  async serialize(): Promise<string> {
    // ... existing serialization

    const yourNetworkAccountsData: Array<{
      accountKey: string;
      address: string;
      networkSpecificField: string;
      accountIndex: number;
    }> = [];

    for (const [accountKey, account] of this.yourNetworkAccounts) {
      yourNetworkAccountsData.push({
        accountKey,
        address: account.address,
        networkSpecificField: account.networkSpecificField,
        accountIndex: account.accountIndex,
      });
    }

    const data = {
      // ... existing data
      yourNetworkAccounts: yourNetworkAccountsData,
    };
    return JSON.stringify(data);
  }
```

### 5.7 Update Deserialization

Add to `restoreFromSerialized()`:

```typescript
// Restore your network accounts
this.yourNetworkAccounts.clear();
if (data.yourNetworkAccounts) {
  for (const accData of data.yourNetworkAccounts) {
    const account: YourNetworkKeyringAccount = {
      id: `your-network-restored-${accData.accountKey}`,
      name: `Your Network Account ${accData.accountIndex + 1}`,
      address: accData.address,
      publicKey: new Uint8Array(),
      privateKey: new Uint8Array(),
      networkSpecificField: accData.networkSpecificField,
      hdPath: '',
      accountIndex: accData.accountIndex,
    };
    this.yourNetworkAccounts.set(accData.accountKey, account);
  }
}
```

### 5.8 Update Clear Method

```typescript
  clear(): void {
    // ... existing clear
    this.yourNetworkAccounts.clear();
  }
```

---

## Step 6: Storage

### File: `src/lib/storage/encrypted-storage.ts`

Update the derived addresses type to include the new network.

```typescript
interface ImportedAccount {
  account: SerializedAccount;
  encryptedMnemonic: string;
  salt: string;
  derivedAddresses?: {
    bitcoin?: Record<string, string>;
    evm?: Record<string, string>;
    svm?: Record<string, string>;
    yourNetwork?: Record<string, string>; // Add this
  };
}
```

Update all method signatures that use `derivedAddresses`:

- `getImportedAccountDerivedAddresses()`
- `addImportedAccount()`
- `addImportedAccountFromSource()`

---

## Step 7: Wallet Store

### File: `src/store/walletStore.ts`

### 7.1 Add Import

```typescript
import {
  Keyring,
  KeyringAccount,
  BitcoinKeyringAccount,
  EvmKeyringAccount,
  SvmKeyringAccount,
  YourNetworkKeyringAccount, // Add this
} from '@/lib/crypto/keyring';
```

### 7.2 Update Pre-derivation Function

```typescript
async function preDeriveAllAccounts(keyring: Keyring): Promise<void> {
  const accounts = keyring.getAccounts();
  // ... existing network types
  const yourNetworks = networkRegistry.getEnabledByType('your_type');

  for (const account of accounts) {
    const accountIndex = account.accountIndex;

    // ... existing derivations

    // Derive all your network addresses
    for (const network of yourNetworks) {
      if (keyring.getYourNetworkAddress(network.id, accountIndex)) continue;

      try {
        await keyring.deriveYourNetworkAccount(
          network.id,
          network.networkSpecificField,
          accountIndex
        );
      } catch (error) {
        console.warn(`Could not derive ${network.id} address:`, error);
      }
    }
  }
}
```

### 7.3 Add Interface Methods

```typescript
interface WalletState {
  // ... existing methods

  // Your network-specific methods
  getYourNetworkAddress: (
    networkId: string,
    accountIndex?: number,
    cosmosAddress?: string
  ) => Promise<string | null>;
  deriveYourNetworkAccount: (
    networkId: string,
    accountIndex?: number
  ) => Promise<YourNetworkKeyringAccount | null>;
}
```

### 7.4 Implement Methods

```typescript
  getYourNetworkAddress: async (networkId, accountIndex, cosmosAddress) => {
    const { keyring, selectedAccount, accounts, updateSession } = get();
    if (!keyring) return null;

    const targetCosmosAddress = cosmosAddress ?? selectedAccount?.address;
    const targetAccount = accounts.find((acc) => acc.address === targetCosmosAddress);
    const isImportedAccount = targetAccount?.id?.startsWith('imported-');

    // Handle imported accounts
    if (isImportedAccount && targetCosmosAddress) {
      const derivedAddresses = await EncryptedStorage.getImportedAccountDerivedAddresses(targetCosmosAddress);
      if (derivedAddresses?.yourNetwork?.[networkId]) {
        return derivedAddresses.yourNetwork[networkId];
      }
      return null;
    }

    // Handle main wallet accounts
    const idx = accountIndex ?? selectedAccount?.accountIndex ?? 0;
    let account = keyring.getYourNetworkAccount(networkId, idx);

    if (account?.address && account.privateKey.length > 0) {
      return account.address;
    }

    if (keyring.hasMnemonic()) {
      const network = networkRegistry.getYourNetwork(networkId);
      if (!network) return null;

      try {
        account = await keyring.deriveYourNetworkAccount(
          networkId,
          network.networkSpecificField,
          idx
        );
        await updateSession();
      } catch (error) {
        console.error('Failed to derive address:', error);
        return null;
      }
    }

    return account?.address || null;
  },

  deriveYourNetworkAccount: async (networkId, accountIndex) => {
    const { keyring, selectedAccount, updateSession } = get();
    if (!keyring) return null;

    const network = networkRegistry.getYourNetwork(networkId);
    if (!network) return null;

    const idx = accountIndex ?? selectedAccount?.accountIndex ?? 0;

    try {
      const account = await keyring.deriveYourNetworkAccount(
        networkId,
        network.networkSpecificField,
        idx
      );
      await updateSession();
      return account;
    } catch (error) {
      console.error('Failed to derive account:', error);
      return null;
    }
  },
```

---

## Step 8: Network Registry

### File: `src/lib/networks/registry.ts`

### 8.1 Add Imports

```typescript
import {
  NetworkType,
  NetworkConfig,
  CosmosNetworkConfig,
  BitcoinNetworkConfig,
  EvmNetworkConfig,
  SvmNetworkConfig,
  YourNetworkConfig, // Add this
} from './types';
import { YOUR_NETWORKS } from './your_network';
```

### 8.2 Add Getter Method to NetworkRegistry Class

```typescript
  getYourNetwork(id: string): YourNetworkConfig | undefined {
    const network = this.get(id);
    return network?.type === 'your_type' ? network : undefined;
  }
```

### 8.3 Register Networks

```typescript
// Register networks
YOUR_NETWORKS.forEach((network) => networkRegistry.register(network));
```

### 8.4 Add Type Guard

```typescript
export function isYourNetwork(network: NetworkConfig): network is YourNetworkConfig {
  return network.type === 'your_type';
}
```

### File: `src/lib/networks/index.ts`

Export the new network type:

```typescript
// Types
export type {
  // ... existing types
  YourNetworkConfig,
} from './types';

// Network configurations
export {
  YOUR_NETWORKS,
  YOUR_NETWORK_MAINNET,
  YOUR_NETWORK_TESTNET,
  getYourNetworkById,
  getEnabledYourNetworks,
} from './your_network';

// Registry helpers
export {
  // ... existing exports
  isYourNetwork,
} from './registry';
```

---

## Step 9: Known Assets (Optional)

### File: `src/lib/assets/knownAssets.ts`

If your network supports tokens (ERC20, SPL, etc.), add token definitions:

```typescript
export interface KnownToken {
  denom: string;
  symbol: string;
  name: string;
  decimals: number;
  contractAddress: string;
  // Network-specific fields
}

export const YOUR_NETWORK_TOKENS: KnownToken[] = [
  {
    denom: 'your-token:0x...',
    symbol: 'TOKEN',
    name: 'Token Name',
    decimals: 18,
    contractAddress: '0x...',
  },
  // ... more tokens
];

// Helper functions
export function getKnownYourNetworkTokens(): KnownToken[] {
  return YOUR_NETWORK_TOKENS;
}

export function isYourNetworkToken(denom: string): boolean {
  return denom.startsWith('your-token:');
}
```

---

## Step 10: UI Components

Adding a new network type requires updates to several UI components to display networks and handle addresses.

### 10.1 Network Store

### File: `src/store/networkStore.ts`

Update the `getNetworksByType` type signature to include your new network type:

```typescript
interface NetworkState {
  // ... existing methods
  getNetworksByType: (type: 'cosmos' | 'bitcoin' | 'evm' | 'svm' | 'your_type') => NetworkConfig[];
}

// Implementation
getNetworksByType: (type: 'cosmos' | 'bitcoin' | 'evm' | 'svm' | 'your_type') => {
  return networkRegistry.getByType(type);
},
```

### 10.2 Network Manager Modal

### File: `src/popup/components/NetworkManagerModal.tsx`

Add a tab for the new network type in the Network Manager:

```typescript
const NetworkManagerModal: React.FC<NetworkManagerModalProps> = ({
  isOpen,
  onClose,
  onNetworkChange,
}) => {
  const { getNetworksByType, isNetworkEnabled, setNetworkEnabled } = useNetworkStore();

  // Add your network type
  const cosmosNetworks = getNetworksByType('cosmos');
  const bitcoinNetworks = getNetworksByType('bitcoin');
  const evmNetworks = getNetworksByType('evm');
  const svmNetworks = getNetworksByType('svm');
  const yourNetworks = getNetworksByType('your_type'); // Add this

  // ... rest of component
```

Update the `NetworkItem` badge color scheme:

```typescript
<Badge
  size="sm"
  colorScheme={
    network.type === 'cosmos'
      ? 'purple'
      : network.type === 'bitcoin'
        ? 'orange'
        : network.type === 'svm'
          ? 'green'
          : network.type === 'your_type'
            ? 'pink'  // Choose your color
            : 'blue'
  }
>
  {network.type.toUpperCase()}
</Badge>
```

Add the Tab and TabPanel:

```tsx
<Tabs variant="soft-rounded" colorScheme="cyan" size="sm">
  <TabList mb={4} bg="#141414" p={1} borderRadius="full">
    {/* ... existing tabs */}
    <Tab fontSize="xs" px={3} borderRadius="full" _selected={{ bg: 'pink.600', color: 'white' }}>
      YourType ({getEnabledCount(yourNetworks)}/{yourNetworks.length})
    </Tab>
  </TabList>

  <TabPanels>
    {/* ... existing panels */}
    <TabPanel p={0}>
      <VStack spacing={2} align="stretch">
        {yourNetworks.length === 0 ? (
          <Text color="gray.500" textAlign="center" py={4}>
            No YourType networks available
          </Text>
        ) : (
          yourNetworks.map((network) => (
            <NetworkItem
              key={network.id}
              network={network}
              isEnabled={isNetworkEnabled(network.id)}
              onToggle={(enabled) => handleToggle(network.id, enabled)}
            />
          ))
        )}
      </VStack>
    </TabPanel>
  </TabPanels>
</Tabs>
```

### 10.3 Dashboard

### File: `src/popup/pages/Dashboard.tsx`

#### 10.3.1 Import the address getter

```typescript
const {
  selectedAccount,
  // ... existing
  getYourNetworkAddress, // Add this
  updateActivity,
} = useWalletStore();
```

#### 10.3.2 Add network type detection

```typescript
const selectedNetworkType = getNetworkType(selectedChainId);
const isCosmosSelected = selectedNetworkType === 'cosmos';
const isBitcoinSelected = selectedNetworkType === 'bitcoin';
const isEvmSelected = selectedNetworkType === 'evm';
const isSvmSelected = selectedNetworkType === 'svm';
const isYourNetworkSelected = selectedNetworkType === 'your_type'; // Add this
```

#### 10.3.3 Add address state

```typescript
// State for your network address
const [yourNetworkAddress, setYourNetworkAddress] = useState<string>('');
const [loadingYourNetworkAddress, setLoadingYourNetworkAddress] = useState(false);

// Cache for all accounts' addresses (keyed by cosmos address)
const yourNetworkAddressCacheRef = useRef<Map<string, Map<string, string>>>(new Map());
const [, setYourNetworkAddressCacheTrigger] = useState(0);
```

#### 10.3.4 Add address clearing effect

```typescript
// Clear address display immediately when chain changes
useEffect(() => {
  setYourNetworkAddress('');
}, [selectedChainId]);
```

#### 10.3.5 Add address derivation effect

```typescript
// Derive address when your network is selected
useEffect(() => {
  if (isYourNetworkSelected && selectedAccount) {
    setLoadingYourNetworkAddress(true);
    getYourNetworkAddress(selectedChainId)
      .then((addr) => {
        setYourNetworkAddress(addr || '');
      })
      .catch((err) => {
        console.error('Failed to get YourNetwork address:', err);
        setYourNetworkAddress('');
      })
      .finally(() => {
        setLoadingYourNetworkAddress(false);
      });
  }
}, [isYourNetworkSelected, selectedChainId, selectedAccount, getYourNetworkAddress]);
```

#### 10.3.6 Add all-accounts derivation (for account switcher)

```typescript
// Derive addresses for all accounts when your network is selected
useEffect(() => {
  if (isYourNetworkSelected && accounts.length > 0) {
    const deriveAllAddresses = async () => {
      const addressesToDerive: Array<{ account: (typeof accounts)[0]; cosmosAddress: string }> = [];

      for (const account of accounts) {
        const accountCache = yourNetworkAddressCacheRef.current.get(account.address);
        if (!accountCache?.has(selectedChainId)) {
          addressesToDerive.push({ account, cosmosAddress: account.address });
        }
      }

      if (addressesToDerive.length > 0) {
        const derivedAddresses = new Map<string, string>();
        for (const { account, cosmosAddress } of addressesToDerive) {
          try {
            const addr = await getYourNetworkAddress(
              selectedChainId,
              account.accountIndex,
              cosmosAddress
            );
            if (addr) {
              derivedAddresses.set(cosmosAddress, addr);
            }
          } catch (err) {
            console.error(`Failed to derive address for ${cosmosAddress}:`, err);
          }
        }

        if (derivedAddresses.size > 0) {
          for (const [cosmosAddress, address] of derivedAddresses) {
            const accountCache = yourNetworkAddressCacheRef.current.get(cosmosAddress);
            const updatedCache = accountCache ? new Map(accountCache) : new Map<string, string>();
            updatedCache.set(selectedChainId, address);
            yourNetworkAddressCacheRef.current.set(cosmosAddress, updatedCache);
          }
          setYourNetworkAddressCacheTrigger((prev) => prev + 1);
        }
      }
    };
    deriveAllAddresses();
  }
}, [isYourNetworkSelected, selectedChainId, accounts, getYourNetworkAddress]);
```

#### 10.3.7 Update `getChainAddress()` function

```typescript
const getChainAddress = () => {
  if (!selectedAccount) return '';

  if (isCosmosSelected && selectedChain.prefix) {
    return getAddressForChain(selectedChain.prefix) || '';
  }
  if (isBitcoinSelected) {
    if (loadingBtcAddress) return 'Loading...';
    return bitcoinAddress || 'Deriving address...';
  }
  if (isEvmSelected) {
    if (loadingEvmAddress) return 'Loading...';
    return evmAddress || 'Deriving address...';
  }
  if (isSvmSelected) {
    if (loadingSvmAddress) return 'Loading...';
    return svmAddress || 'Deriving address...';
  }
  // Add your network type
  if (isYourNetworkSelected) {
    if (loadingYourNetworkAddress) return 'Loading...';
    return yourNetworkAddress || 'Deriving address...';
  }

  return selectedAccount.address;
};
```

#### 10.3.8 Update `getAccountChainAddress()` function

```typescript
const getAccountChainAddress = (account: { address: string; accountIndex?: number }) => {
  if (isBitcoinSelected) {
    const accountCache = bitcoinAddressCacheRef.current.get(account.address);
    return accountCache?.get(selectedChainId) || 'Deriving...';
  }
  if (isEvmSelected) {
    const accountCache = evmAddressCacheRef.current.get(account.address);
    return accountCache?.get(selectedChainId) || 'Deriving...';
  }
  if (isSvmSelected) {
    const accountCache = svmAddressCacheRef.current.get(account.address);
    return accountCache?.get(selectedChainId) || 'Deriving...';
  }
  // Add your network type
  if (isYourNetworkSelected) {
    const accountCache = yourNetworkAddressCacheRef.current.get(account.address);
    return accountCache?.get(selectedChainId) || 'Deriving...';
  }
  // ... Cosmos handling
};
```

#### 10.3.9 Update balance loading dependencies

```typescript
useEffect(() => {
  if (selectedAccount) {
    if (isBitcoinSelected && !bitcoinAddress) return;
    if (isEvmSelected && !evmAddress) return;
    if (isSvmSelected && !svmAddress) return;
    if (isYourNetworkSelected && !yourNetworkAddress) return; // Add this

    loadBalance();
    // ... WebSocket subscription for Cosmos
  }
  return () => unsubscribeAll();
}, [
  selectedAccount,
  selectedChainId,
  isCosmosSelected,
  isBitcoinSelected,
  isEvmSelected,
  isSvmSelected,
  isYourNetworkSelected, // Add this
  bitcoinAddress,
  evmAddress,
  svmAddress,
  yourNetworkAddress, // Add this
]);
```

#### 10.3.10 Update the network tab handler

```typescript
// Network tab: 0 = All, 1 = Cosmos, 2 = UTXO, 3 = EVM, 4 = SVM, 5 = YourType
const [networkTab, setNetworkTab] = useState(0);

const handleNetworkTabChange = (tabIndex: number) => {
  setNetworkTab(tabIndex);

  if (tabIndex === 1) {
    const network = enabledUIChains.find((n) => n.type === 'cosmos');
    if (network) selectChain(network.id);
  } else if (tabIndex === 2) {
    const network = enabledUIChains.find((n) => n.type === 'bitcoin');
    if (network) selectChain(network.id);
  } else if (tabIndex === 3) {
    const network = enabledUIChains.find((n) => n.type === 'evm');
    if (network) selectChain(network.id);
  } else if (tabIndex === 4) {
    const network = enabledUIChains.find((n) => n.type === 'svm');
    if (network) selectChain(network.id);
  } else if (tabIndex === 5) {
    const network = enabledUIChains.find((n) => n.type === 'your_type');
    if (network) selectChain(network.id);
  }
};
```

#### 10.3.11 Add network tab UI

```tsx
<TabList bg="#141414" borderRadius="full" p={0.5}>
  <Tab /* ... All */> All </Tab>
  <Tab _selected={{ bg: 'purple.600' }}> Cosmos </Tab>
  <Tab _selected={{ bg: 'orange.600' }}> UTXO </Tab>
  <Tab _selected={{ bg: 'blue.600' }}> EVM </Tab>
  <Tab _selected={{ bg: 'green.600' }}> SVM </Tab>
  <Tab _selected={{ bg: 'pink.600' }}> YourType </Tab>
</TabList>
```

#### 10.3.12 Update network filter in the chain list

```typescript
{
  enabledUIChains
    .filter((network) => {
      if (networkTab === 0) return true;
      if (networkTab === 1) return network.type === 'cosmos';
      if (networkTab === 2) return network.type === 'bitcoin';
      if (networkTab === 3) return network.type === 'evm';
      if (networkTab === 4) return network.type === 'svm';
      if (networkTab === 5) return network.type === 'your_type'; // Add this
      return true;
    })
    .map((network) => {
      const isYourType = network.type === 'your_type';
      const borderActiveColor = isBitcoin
        ? 'orange.500'
        : isEvm
          ? 'blue.500'
          : isSvm
            ? 'green.500'
            : isYourType
              ? 'pink.500'
              : 'cyan.500';
      // ... render network button
    });
}
```

### 10.4 Chain Info Helper

### File: `src/lib/cosmos/chains.ts`

Update `getNetworkType()` return type:

```typescript
export function getNetworkType(
  networkId: string
): 'cosmos' | 'bitcoin' | 'evm' | 'svm' | 'your_type' | undefined {
  return networkRegistry.get(networkId)?.type;
}
```

---

## Step 11: Tests

### File: `tests/lib/crypto/your_network.test.ts` (new file)

```typescript
import { describe, it, expect } from '@jest/globals';
import {
  deriveYourNetworkKeyPair,
  getYourNetworkDerivationPath,
  isValidYourNetworkAddress,
} from '@/lib/crypto/your_network';

const TEST_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

describe('Your Network Crypto', () => {
  describe('getYourNetworkDerivationPath', () => {
    it('should return correct path for account 0', () => {
      const path = getYourNetworkDerivationPath(0);
      expect(path).toBe("m/44'/COIN_TYPE'/0'/0/0");
    });

    it('should return correct path for account 1', () => {
      const path = getYourNetworkDerivationPath(1);
      expect(path).toBe("m/44'/COIN_TYPE'/1'/0/0");
    });
  });

  describe('deriveYourNetworkKeyPair', () => {
    it('should derive consistent keypairs', async () => {
      const keypair1 = await deriveYourNetworkKeyPair(TEST_MNEMONIC, 0);
      const keypair2 = await deriveYourNetworkKeyPair(TEST_MNEMONIC, 0);

      expect(keypair1.address).toBe(keypair2.address);
      expect(keypair1.publicKey).toEqual(keypair2.publicKey);
    });

    it('should derive different addresses for different account indices', async () => {
      const keypair0 = await deriveYourNetworkKeyPair(TEST_MNEMONIC, 0);
      const keypair1 = await deriveYourNetworkKeyPair(TEST_MNEMONIC, 1);

      expect(keypair0.address).not.toBe(keypair1.address);
    });

    it('should derive valid addresses', async () => {
      const keypair = await deriveYourNetworkKeyPair(TEST_MNEMONIC, 0);
      expect(isValidYourNetworkAddress(keypair.address)).toBe(true);
    });
  });

  describe('isValidYourNetworkAddress', () => {
    it('should validate correct addresses', () => {
      expect(isValidYourNetworkAddress('valid_address_here')).toBe(true);
    });

    it('should reject invalid addresses', () => {
      expect(isValidYourNetworkAddress('')).toBe(false);
      expect(isValidYourNetworkAddress('invalid')).toBe(false);
    });
  });
});
```

### File: `tests/lib/your_network/client.test.ts` (new file)

```typescript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { YourNetworkClient } from '@/lib/your_network/client';

describe('YourNetworkClient', () => {
  let client: YourNetworkClient;

  beforeEach(() => {
    client = new YourNetworkClient({
      id: 'your-network-testnet',
      name: 'Your Network Testnet',
      // ... config
    });
  });

  describe('getBalance', () => {
    it('should fetch balance for valid address', async () => {
      // Mock fetch or use test RPC
      const balance = await client.getBalance('test_address');
      expect(balance).toBeDefined();
      expect(typeof balance.amount).toBe('bigint');
    });
  });

  describe('switchRpcUrl', () => {
    it('should switch to valid RPC index', () => {
      client.switchRpcUrl(1);
      // Verify internal state if possible
    });

    it('should not switch to invalid index', () => {
      client.switchRpcUrl(999);
      // Verify no change
    });
  });
});
```

### File: `tests/lib/networks/registry.test.ts`

Add tests for the new network type:

```typescript
describe('NetworkRegistry - Your Network', () => {
  it('should register your network configs', () => {
    const network = networkRegistry.get('your-network-mainnet');
    expect(network).toBeDefined();
    expect(network?.type).toBe('your_type');
  });

  it('should get your network by id', () => {
    const network = networkRegistry.getYourNetwork('your-network-mainnet');
    expect(network).toBeDefined();
    expect(network?.name).toBe('Your Network');
  });

  it('should filter by your network type', () => {
    const networks = networkRegistry.getByType('your_type');
    expect(networks.length).toBeGreaterThan(0);
    networks.forEach((n) => expect(n.type).toBe('your_type'));
  });
});
```

---

## Checklist

Use this checklist when adding a new network type:

### Type Definitions

- [ ] Add network type to `NetworkType` union in `types.ts`
- [ ] Create `YourNetworkConfig` interface
- [ ] Update `NetworkConfig` union type

### Network Configurations

- [ ] Create `src/lib/networks/your_network.ts`
- [ ] Define mainnet/testnet configurations
- [ ] Add helper functions

### Cryptography

- [ ] Create `src/lib/crypto/your_network.ts`
- [ ] Implement key derivation (correct curve and BIP44 path)
- [ ] Implement address generation
- [ ] Implement address validation

### RPC Client

- [ ] Create `src/lib/your_network/client.ts`
- [ ] Create `src/lib/your_network/index.ts`
- [ ] Implement balance queries
- [ ] Implement transaction methods

### Keyring

- [ ] Add import for crypto utilities
- [ ] Add `YourNetworkKeyringAccount` interface
- [ ] Add private accounts map
- [ ] Add derivation method
- [ ] Add getter methods
- [ ] Update serialization
- [ ] Update deserialization
- [ ] Update clear method

### Storage

- [ ] Update `derivedAddresses` type in `encrypted-storage.ts`
- [ ] Update all method signatures using `derivedAddresses`

### Wallet Store

- [ ] Add account type import
- [ ] Update `preDeriveAllAccounts()`
- [ ] Add interface methods
- [ ] Implement store methods

### Network Registry

- [ ] Import new network config type
- [ ] Import network configurations
- [ ] Add getter method to registry class
- [ ] Register networks
- [ ] Add type guard function
- [ ] Export from `index.ts`

### Assets (Optional)

- [ ] Add token definitions to `knownAssets.ts`
- [ ] Add helper functions

### UI

- [ ] Update `getNetworksByType` type in `networkStore.ts`
- [ ] Add network tab to `NetworkManagerModal.tsx`
- [ ] Update `NetworkItem` badge color for new type
- [ ] Add `getYourNetworkAddress` to Dashboard imports
- [ ] Add network type detection flag (`isYourNetworkSelected`)
- [ ] Add address state and loading state
- [ ] Add address cache ref for all accounts
- [ ] Add address clearing effect on chain change
- [ ] Add address derivation effect
- [ ] Add all-accounts derivation effect (for account switcher)
- [ ] Update `getChainAddress()` function
- [ ] Update `getAccountChainAddress()` function
- [ ] Update balance loading dependencies
- [ ] Update network tab handler for new tab index
- [ ] Add network Tab in TabList
- [ ] Update network filter in chain list
- [ ] Update border colors for network buttons
- [ ] Update `getNetworkType()` return type in `chains.ts`

### Tests

- [ ] Add crypto tests
- [ ] Add client tests
- [ ] Add registry tests

### Dependencies

- [ ] Install required crypto libraries (e.g., `@noble/curves`)

---

## Dependencies

Common dependencies you might need:

```bash
# For Ed25519 (Solana-like chains)
npm install @noble/curves

# For secp256k1 (Bitcoin/EVM-like chains)
npm install @noble/secp256k1

# For hashing
npm install @noble/hashes

# BIP39/BIP32 utilities
npm install bip39
```

---

## Example: SVM (Solana) Implementation

For a complete reference implementation, see the SVM (Solana) support added in:

- `src/lib/networks/types.ts` - SvmNetworkConfig interface
- `src/lib/networks/solana.ts` - Network configurations
- `src/lib/crypto/solana.ts` - Key derivation (Ed25519/SLIP-0010)
- `src/lib/solana/client.ts` - RPC client
- `src/lib/crypto/keyring.ts` - SVM account management
- `src/lib/storage/encrypted-storage.ts` - SVM derived address storage
- `src/store/walletStore.ts` - State management (`getSvmAddress`, etc.)
- `src/lib/networks/registry.ts` - Registry integration
- `src/lib/assets/knownAssets.ts` - SPL token definitions
- `src/store/networkStore.ts` - Network store type updates
- `src/popup/components/NetworkManagerModal.tsx` - SVM tab in Network Manager
- `src/popup/pages/Dashboard.tsx` - SVM network tab and address handling
- `tests/lib/crypto/solana.test.ts` - Crypto tests
- `tests/lib/solana/client.test.ts` - Client tests
- `tests/lib/assets/knownAssets.test.ts` - Asset tests
