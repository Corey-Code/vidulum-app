import React, { useMemo, useCallback, useRef } from 'react';
import { Box, HStack, Text, useToast, IconButton } from '@chakra-ui/react';
import { ArrowBackIcon } from '@chakra-ui/icons';
import { Widget } from '@skip-go/widget';
import { useWalletStore } from '@/store/walletStore';
import { useNetworkStore } from '@/store/networkStore';
import {
  networkRegistry,
  isCosmosNetwork,
  isEvmNetwork,
  isSvmNetwork,
  getHealthyEndpoint,
} from '@/lib/networks';
import type { CosmosNetworkConfig, SvmNetworkConfig } from '@/lib/networks';
import { Keyring } from '@/lib/crypto/keyring';
import { fromBech32 } from '@cosmjs/encoding';
import { createWalletClient, defineChain, http, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { Keypair, PublicKey } from '@solana/web3.js';

/**
 * Vidulum affiliate fee configuration.
 * basisPointsFee must be the same total across every chain entry.
 * 100 basis points = 1%.
 */
const VIDULUM_FEE_BPS = import.meta.env.VIDULUM_FEE_BPS || '';
const VIDULUM_FEE_BASE_ADDRESS = import.meta.env.VIDULUM_FEE_BASE_ADDRESS || '';
const SKIP_API_URL = 'https://api.vidulum.app/skip/api/skip/v2';

const skipSvmChainIdByNetworkId: Record<string, string> = {
  'solana-mainnet': 'solana',
  'solana-devnet': 'solana-devnet',
  'solana-testnet': 'solana-testnet',
  'eclipse-mainnet': 'eclipse',
};

function toHex(bytes: Uint8Array): Hex {
  return `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}` as Hex;
}

function getSkipSvmChainId(network: SvmNetworkConfig): string {
  return skipSvmChainIdByNetworkId[network.id] || network.id;
}

interface SwapPageProps {
  onBack: () => void;
}

const SwapPage: React.FC<SwapPageProps> = ({ onBack }) => {
  const { selectedAccount, keyring } = useWalletStore();
  const { getEnabledNetworks } = useNetworkStore();
  const toast = useToast();
  const lastErrorToastRef = useRef<{ message: string; timestamp: number } | null>(null);

  /**
   * Build connected addresses map for ALL Cosmos chains in the registry.
   * Routes may traverse intermediate chains (e.g. Noble for USDC bridging)
   * that aren't in the user's enabled list, so we must provide addresses
   * for every known chain to prevent address resolution mismatches.
   */
  const connectedAddresses = useMemo<Record<string, string>>(() => {
    if (!selectedAccount || !keyring) return {};

    const addresses: Record<string, string> = {};
    const allCosmosNetworks = networkRegistry.getByType('cosmos');
    const allEvmNetworks = networkRegistry.getByType('evm');
    const allSvmNetworks = networkRegistry.getByType('svm');
    const accountIndex = selectedAccount.accountIndex;

    for (const network of allCosmosNetworks) {
      try {
        const address = Keyring.convertAddress(selectedAccount.address, network.bech32Prefix);
        addresses[network.id] = address;
      } catch {
        // Skip chains where address conversion fails (e.g. non-standard key derivation)
      }
    }

    for (const network of allEvmNetworks) {
      const evmAddress = keyring.getEvmAddress(network.id, accountIndex);
      if (evmAddress) {
        addresses[String(network.chainId)] = evmAddress;
      }
    }

    for (const network of allSvmNetworks) {
      const svmAddress = keyring.getSvmAddress(network.id, accountIndex);
      if (svmAddress) {
        addresses[getSkipSvmChainId(network)] = svmAddress;
      }
    }

    return addresses;
  }, [selectedAccount, keyring]);

  /**
   * Provide a combined OfflineSigner (Amino + Direct) for any Cosmos chain.
   * The widget requires both signAmino and signDirect on the signer object
   * for injected wallet functionality to work.
   *
   * IMPORTANT: We read keyring/isLocked/selectedAccount directly from the
   * Zustand store at call time (useWalletStore.getState()) instead of the
   * React closure. The widget caches this callback and invokes it later
   * during transaction execution, by which point the closure values from
   * the render may be stale.
   */
  const getCosmosSigner = useCallback(
    async (chainId: string) => {
      // Read the LATEST wallet state at call time, not from the closure
      const { keyring: currentKeyring, isLocked: currentIsLocked, selectedAccount: currentAccount } =
        useWalletStore.getState();

      if (currentIsLocked || !currentKeyring) {
        throw new Error('Wallet is locked. Please unlock your wallet first.');
      }
      if (!currentAccount) {
        throw new Error('No account selected.');
      }
      if (currentAccount.id.startsWith('imported-')) {
        throw new Error(
          'Imported accounts are not currently supported for Swap signing. Please switch to a main wallet account.'
        );
      }
      // Resolve the bech32 prefix: prefer our registry, fall back to
      // extracting from the address we gave the widget in connectedAddresses
      let bech32Prefix: string | undefined;

      const network = networkRegistry.getCosmos(chainId);
      if (network) {
        bech32Prefix = network.bech32Prefix;
      } else {
        const addr = connectedAddresses[chainId];
        if (addr) {
          try {
            bech32Prefix = fromBech32(addr).prefix;
          } catch {
            // not a valid bech32 address
          }
        }
      }

      if (!bech32Prefix) {
        throw new Error(`Unsupported chain: ${chainId}`);
      }

      const signer = await currentKeyring.getCombinedSignerForChain(
        bech32Prefix,
        currentAccount.accountIndex
      );

      // Ensure the signer exposes the exact account the widget expects.
      // This avoids opaque downstream errors from the widget when no matching
      // account is returned by getAccounts().
      const expectedAddress = connectedAddresses[chainId] ??
        Keyring.convertAddress(currentAccount.address, bech32Prefix);
      const signerAccounts = await signer.getAccounts();
      const hasExpectedAccount = signerAccounts.some((account) => account.address === expectedAddress);
      if (!hasExpectedAccount) {
        throw new Error(
          `Signer account mismatch for ${chainId}. Please switch accounts or lock/unlock your wallet and try again.`
        );
      }

      return signer;
    },
    [connectedAddresses]
  );

  /**
   * Provide a viem WalletClient for EVM routes.
   */
  const getEvmSigner = useCallback(async (chainId: string) => {
    const { keyring: currentKeyring, isLocked: currentIsLocked, selectedAccount: currentAccount } =
      useWalletStore.getState();

    if (currentIsLocked || !currentKeyring) {
      throw new Error('Wallet is locked. Please unlock your wallet first.');
    }
    if (!currentAccount) {
      throw new Error('No account selected.');
    }
    if (currentAccount.id.startsWith('imported-')) {
      throw new Error(
        'Imported accounts are not currently supported for Swap signing. Please switch to a main wallet account.'
      );
    }
    if (!currentKeyring.hasMnemonic()) {
      throw new Error(
        'Signing keys not available. Please lock and unlock your wallet, then try again.'
      );
    }

    const evmNetwork = networkRegistry
      .getByType('evm')
      .find((network) => String(network.chainId) === chainId || network.id === chainId);
    if (!evmNetwork) {
      throw new Error(`Unsupported EVM chain: ${chainId}`);
    }

    const accountIndex = currentAccount.accountIndex;
    let evmAccount = currentKeyring.getEvmAccount(evmNetwork.id, accountIndex);
    if (!evmAccount || evmAccount.privateKey.length === 0) {
      evmAccount = await currentKeyring.deriveEvmAccount(evmNetwork.id, evmNetwork.chainId, accountIndex);
    }
    if (!evmAccount.privateKey.length) {
      throw new Error(`Could not derive signing key for EVM chain ${chainId}`);
    }

    const account = privateKeyToAccount(toHex(evmAccount.privateKey));
    const rpc = getHealthyEndpoint(evmNetwork.rpcUrls) || evmNetwork.rpcUrls[0];
    const chain = defineChain({
      id: evmNetwork.chainId,
      name: evmNetwork.name,
      nativeCurrency: evmNetwork.nativeCurrency,
      rpcUrls: {
        default: { http: [rpc] },
        public: { http: [rpc] },
      },
      blockExplorers: evmNetwork.explorerUrl
        ? { default: { name: `${evmNetwork.name} Explorer`, url: evmNetwork.explorerUrl } }
        : undefined,
    });

    return createWalletClient({
      account,
      chain,
      transport: http(rpc),
    });
  }, []);

  /**
   * Provide an SVM signer adapter for Solana/SVM routes.
   */
  const getSvmSigner = useCallback(async () => {
    const { keyring: currentKeyring, isLocked: currentIsLocked, selectedAccount: currentAccount } =
      useWalletStore.getState();

    if (currentIsLocked || !currentKeyring) {
      throw new Error('Wallet is locked. Please unlock your wallet first.');
    }
    if (!currentAccount) {
      throw new Error('No account selected.');
    }
    if (currentAccount.id.startsWith('imported-')) {
      throw new Error(
        'Imported accounts are not currently supported for Swap signing. Please switch to a main wallet account.'
      );
    }
    if (!currentKeyring.hasMnemonic()) {
      throw new Error(
        'Signing keys not available. Please lock and unlock your wallet, then try again.'
      );
    }

    const svmNetwork =
      networkRegistry.getSvm('solana-mainnet') ||
      networkRegistry.getByType('svm').find((network) => network.cluster === 'mainnet-beta') ||
      networkRegistry.getByType('svm')[0];
    if (!svmNetwork) {
      throw new Error('No SVM network configured for signing.');
    }

    const privateKey = await currentKeyring.getSvmPrivateKey(svmNetwork.id, currentAccount.accountIndex);
    if (!privateKey || privateKey.length === 0) {
      throw new Error('Could not derive SVM signing key. Please lock and unlock your wallet.');
    }

    const keypair = Keypair.fromSeed(privateKey.slice(0, 32));
    const adapterLike = {
      publicKey: new PublicKey(keypair.publicKey),
      signTransaction: async (transaction: any) => {
        transaction.partialSign(keypair);
        return transaction;
      },
      connected: true,
      connecting: false,
      disconnecting: false,
      readyState: 'Installed',
      connect: async () => {},
      disconnect: async () => {},
    };

    return adapterLike as any;
  }, []);

  /**
   * Build the source filter so the widget only shows chains/assets
   * the user has enabled in their network preferences.
   */
  const sourceFilter = useMemo<Record<string, string[] | undefined>>(() => {
    const filter: Record<string, string[] | undefined> = {};
    const enabledNetworks = getEnabledNetworks();

    for (const network of enabledNetworks) {
      if (isCosmosNetwork(network)) {
        if (connectedAddresses[network.id]) {
          filter[network.id] = undefined;
        }
      } else if (isEvmNetwork(network)) {
        const skipChainId = String(network.chainId);
        if (connectedAddresses[skipChainId]) {
          filter[skipChainId] = undefined;
        }
      } else if (isSvmNetwork(network)) {
        const skipChainId = getSkipSvmChainId(network);
        if (connectedAddresses[skipChainId]) {
          filter[skipChainId] = undefined;
        }
      }
    }

    return filter;
  }, [getEnabledNetworks, connectedAddresses]);

  /**
   * Build chainIdsToAffiliates for Vidulum's fee collection.
   * Derives the fee recipient address on each enabled Cosmos chain from the
   * base BZE address, keeping basisPointsFee consistent across all chains.
   */
  const chainIdsToAffiliates = useMemo(() => {
    const affiliates: Record<
      string,
      { affiliates: Array<{ basisPointsFee: string; address: string }> }
    > = {};

    const enabledCosmosNetworks = getEnabledNetworks().filter(isCosmosNetwork);

    for (const network of enabledCosmosNetworks) {
      try {
        const feeAddress = Keyring.convertAddress(VIDULUM_FEE_BASE_ADDRESS, network.bech32Prefix);
        affiliates[network.id] = {
          affiliates: [
            {
              basisPointsFee: VIDULUM_FEE_BPS,
              address: feeAddress,
            },
          ],
        };
      } catch {
        // Skip chains where address derivation fails
      }
    }

    return affiliates;
  }, [getEnabledNetworks]);

  /**
   * Build custom endpoint overrides using our failover-aware endpoint lists.
   * Provides RPC/REST endpoints for each enabled Cosmos chain.
   */
  const endpointOptions = useMemo(() => {
    const endpoints: Record<string, { rpc?: string; rest?: string }> = {};
    const enabledCosmosNetworks = getEnabledNetworks().filter(isCosmosNetwork);

    for (const network of enabledCosmosNetworks) {
      const cosmosNet = network as CosmosNetworkConfig;
      const rpc = getHealthyEndpoint(cosmosNet.rpc) || cosmosNet.rpc[0];
      const rest = getHealthyEndpoint(cosmosNet.rest) || cosmosNet.rest[0];

      if (rpc || rest) {
        endpoints[network.id] = {
          ...(rpc ? { rpc } : {}),
          ...(rest ? { rest } : {}),
        };
      }
    }

    return { endpoints };
  }, [getEnabledNetworks]);

  /**
   * Widget theme matching Vidulum's dark UI
   */
  const widgetTheme = useMemo(
    () => ({
      brandColor: '#00e5ff',
      borderRadius: {
        main: '12px',
        selectionButton: '16px',
        ghostButton: '8px',
        modalContainer: '16px',
        rowItem: '10px',
      },
      primary: {
        background: {
          normal: '#0a0a0a',
        },
        text: {
          normal: '#ffffff',
          lowContrast: '#a0a0a0',
          ultraLowContrast: '#555555',
        },
        ghostButtonHover: '#1a1a2e',
      },
      secondary: {
        background: {
          normal: '#141424',
          transparent: 'rgba(20, 20, 36, 0.8)',
          hover: '#1a1a2e',
        },
      },
      success: {
        background: '#0d2b1a',
        text: '#34d399',
      },
      warning: {
        background: '#2b2200',
        text: '#fbbf24',
      },
      error: {
        background: '#2b0d0d',
        text: '#f87171',
      },
    }),
    []
  );

  // --- Callbacks ---

  const onTransactionBroadcasted = useCallback(
    (params: {
      txHash: string;
      chainId: string;
      explorerLink: string;
      sourceAddress: string;
      destinationAddress: string;
      sourceAssetDenom: string;
      sourceAssetChainId: string;
      destAssetDenom: string;
      destAssetChainId: string;
    }) => {
      toast({
        title: 'Transaction Broadcasted',
        description: `Tx sent on ${params.chainId}`,
        status: 'info',
        duration: 4000,
        isClosable: true,
      });
    },
    [toast]
  );

  const onTransactionComplete = useCallback(
    (params: {
      txHash: string;
      chainId: string;
      explorerLink: string;
      sourceAddress: string;
      destinationAddress: string;
      sourceAssetDenom: string;
      sourceAssetChainId: string;
      destAssetDenom: string;
      destAssetChainId: string;
    }) => {
      toast({
        title: 'Swap Complete',
        description: params.explorerLink
          ? `View on explorer`
          : `Tx: ${params.txHash.slice(0, 12)}...`,
        status: 'success',
        duration: 8000,
        isClosable: true,
      });
    },
    [toast]
  );

  const onTransactionFailed = useCallback(
    (params: { error: string }) => {
      const message = params.error || 'Unknown error';

      // Provide user-friendly messages for known error patterns
      let description = message;
      if (message.includes('STATE_ABANDONED')) {
        description =
          'Transaction timed out. The IBC relayer may be slow — this may still complete.';
      } else if (
        message.includes('STATE_COMPLETED_ERROR') ||
        message.includes('STATE_PENDING_ERROR')
      ) {
        description = 'Transaction encountered an error during processing.';
      } else if (
        message.toLowerCase().includes('no routes found') ||
        (message.includes('/fungible/route') && message.includes('404'))
      ) {
        description =
          'No swap route is currently available for this token pair/amount. Try a different amount, asset, or route.';
      } else if (
        message.includes('Difference in USD value of route input and output is too large') ||
        (message.includes('/fungible/route') &&
          message.includes('400') &&
          message.toLowerCase().includes('usd value'))
      ) {
        description =
          'Swap rejected due to high price impact/low liquidity for this amount. Try a smaller amount or a different token pair.';
      } else if (message.includes('PACKET_ERROR_TIMEOUT')) {
        description = 'IBC packet timed out. Funds are safe and may be refunded.';
      } else if (message.includes('PACKET_ERROR_ACKNOWLEDGEMENT')) {
        description = 'IBC packet acknowledgement error. Please check the transaction status.';
      } else if (message.includes('Wallet is locked')) {
        description = 'Please unlock your wallet and try again.';
      } else if (message.includes('Signing keys not available')) {
        description = 'Signing keys not available. Please lock and unlock your wallet, then try again.';
      } else if (message.includes('Imported accounts are not currently supported')) {
        description =
          'Swap signing is only available for main wallet accounts. Select a main account and retry.';
      } else if (message.includes('Signer account mismatch')) {
        description =
          'Could not match the selected account with the signer. Try switching accounts or locking/unlocking the wallet.';
      } else if (message.includes('not available') && message.includes('unlock')) {
        description = 'Please lock and unlock your wallet to reload signing keys.';
      }

      // Skip frequently duplicated error events from widget internals.
      const now = Date.now();
      const last = lastErrorToastRef.current;
      if (last && last.message === description && now - last.timestamp < 1500) {
        return;
      }
      lastErrorToastRef.current = { message: description, timestamp: now };

      toast({
        title: 'Transaction Failed',
        description,
        status: 'error',
        duration: 10000,
        isClosable: true,
      });
    },
    [toast]
  );

  const onWalletConnected = useCallback(
    (params: {
      walletName: string;
      chainIdToAddressMap?: Record<string, string>;
      chainId?: string;
      address?: string;
    }) => {
      console.log('[SkipGo] Wallet connected:', params.walletName, params.address);
    },
    []
  );

  const onWalletDisconnected = useCallback((params: { walletName: string; chainType?: string }) => {
    console.log('[SkipGo] Wallet disconnected:', params.walletName, params.chainType);
  }, []);

  return (
    <Box h="full" bg="#0a0a0a" color="white" display="flex" flexDirection="column">
      {/* Header */}
      <Box p={4} borderBottom="1px" borderColor="#2a2a2a">
        <HStack>
          <IconButton
            aria-label="Back"
            icon={<ArrowBackIcon />}
            variant="ghost"
            color="gray.400"
            _hover={{ color: 'white', bg: 'whiteAlpha.100' }}
            onClick={onBack}
          />
          <Text fontSize="xl" fontWeight="bold">
            Cross-Chain Swap
          </Text>
        </HStack>
      </Box>

      {/* Skip Go Widget */}
      <Box flex="1" overflow="auto" p={2}>
        <Box w="100%" maxW="480px" mx="auto">
          <Widget
            apiUrl={SKIP_API_URL}
            // --- Default route: start with Osmosis OSMO ---
            defaultRoute={{
              srcChainId: 'osmosis-1',
              srcAssetDenom: 'uosmo',
            }}
            // --- Route configuration ---
            routeConfig={{
              experimentalFeatures: ['hyperlane', 'cctp', 'eureka'],
              allowMultiTx: true,
              allowUnsafe: false,
              // Workaround for a current @skip-go/widget DOM nesting warning in
              // RoutePreferenceSelector (div rendered inside p).
              // Keeping this false avoids rendering that faulty section.
              goFast: false,
            }}
            // --- Sign all txs upfront for multi-tx routes ---
            batchSignTxs={true}
            // --- Only show chains the user has enabled ---
            filter={{
              source: sourceFilter,
            }}
            // --- Swap settings ---
            settings={{
              slippage: 0.5,
            }}
            // --- Theme ---
            theme={widgetTheme}
            // --- Disable external WalletConnect integration ---
            walletConnect={{
              options: null,
              walletConnectModal: null,
            }}
            // --- Custom endpoints from our failover system ---
            endpointOptions={endpointOptions}
            // --- Affiliate fees: 0.75% to Vidulum on every chain ---
            chainIdsToAffiliates={chainIdsToAffiliates}
            // --- Injected wallet: pass connected addresses + Cosmos signer ---
            connectedAddresses={connectedAddresses}
            hideAssetsUnlessWalletTypeConnected={true}
            getCosmosSigner={getCosmosSigner}
            getEvmSigner={getEvmSigner}
            getSvmSigner={getSvmSigner}
            // --- Callbacks ---
            onWalletConnected={onWalletConnected}
            onWalletDisconnected={onWalletDisconnected}
            onTransactionBroadcasted={onTransactionBroadcasted}
            onTransactionComplete={onTransactionComplete}
            onTransactionFailed={onTransactionFailed}
            // --- Disable shadow DOM for better extension compatibility ---
            disableShadowDom={true}
          />
        </Box>
      </Box>
    </Box>
  );
};

export default SwapPage;
