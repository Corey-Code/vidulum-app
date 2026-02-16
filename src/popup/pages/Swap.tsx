import React, { useMemo, useCallback } from 'react';
import { Box, HStack, Text, useToast, IconButton } from '@chakra-ui/react';
import { ArrowBackIcon } from '@chakra-ui/icons';
import { Widget } from '@skip-go/widget';
import { useWalletStore } from '@/store/walletStore';
import { useNetworkStore } from '@/store/networkStore';
import { networkRegistry, isCosmosNetwork, getHealthyEndpoint } from '@/lib/networks';
import type { CosmosNetworkConfig } from '@/lib/networks';
import { Keyring } from '@/lib/crypto/keyring';

/**
 * Vidulum affiliate fee configuration.
 * basisPointsFee must be the same total across every chain entry.
 * 100 basis points = 1%.
 */
const VIDULUM_FEE_BPS = import.meta.env.VIDULUM_FEE_BPS || '';
const VIDULUM_FEE_BASE_ADDRESS = import.meta.env.VIDULUM_FEE_BASE_ADDRESS || '';

interface SwapPageProps {
  onBack: () => void;
}

const SwapPage: React.FC<SwapPageProps> = ({ onBack }) => {
  const { selectedAccount, keyring, isLocked } = useWalletStore();
  const { getEnabledNetworks } = useNetworkStore();
  const toast = useToast();

  /**
   * Build connected addresses map for all enabled Cosmos chains.
   * Maps Skip Go chain IDs to the user's derived address on each chain.
   */
  const connectedAddresses = useMemo<Record<string, string>>(() => {
    if (!selectedAccount) return {};

    const addresses: Record<string, string> = {};
    const enabledCosmosNetworks = getEnabledNetworks().filter(isCosmosNetwork);

    for (const network of enabledCosmosNetworks) {
      try {
        const address = Keyring.convertAddress(selectedAccount.address, network.bech32Prefix);
        addresses[network.id] = address;
      } catch {
        // Skip chains where address conversion fails
      }
    }

    return addresses;
  }, [selectedAccount, getEnabledNetworks]);

  /**
   * Provide an OfflineSigner for any Cosmos chain the widget requests.
   * The widget calls this when it needs to sign a transaction.
   */
  const getCosmosSigner = useCallback(
    async (chainId: string) => {
      if (isLocked || !keyring) {
        throw new Error('Wallet is locked. Please unlock your wallet first.');
      }
      if (!selectedAccount) {
        throw new Error('No account selected.');
      }

      const network = networkRegistry.getCosmos(chainId);
      if (!network) {
        throw new Error(`Unsupported chain: ${chainId}`);
      }

      const wallet = await keyring.getWalletForChain(
        network.bech32Prefix,
        selectedAccount.accountIndex
      );
      return wallet;
    },
    [keyring, isLocked, selectedAccount]
  );

  /**
   * Build the source filter so the widget only shows chains/assets
   * the user has enabled in their network preferences.
   */
  const sourceFilter = useMemo<Record<string, string[] | undefined>>(() => {
    const filter: Record<string, string[] | undefined> = {};
    const enabledCosmosNetworks = getEnabledNetworks().filter(isCosmosNetwork);

    for (const network of enabledCosmosNetworks) {
      // undefined = allow all assets on this chain
      filter[network.id] = undefined;
    }

    return filter;
  }, [getEnabledNetworks]);

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
      } else if (message.includes('PACKET_ERROR_TIMEOUT')) {
        description = 'IBC packet timed out. Funds are safe and may be refunded.';
      } else if (message.includes('PACKET_ERROR_ACKNOWLEDGEMENT')) {
        description = 'IBC packet acknowledgement error. Please check the transaction status.';
      } else if (message.includes('locked') || message.includes('Wallet is locked')) {
        description = 'Please unlock your wallet and try again.';
      }

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
              goFast: true,
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
            // --- Custom endpoints from our failover system ---
            endpointOptions={endpointOptions}
            // --- Affiliate fees: 0.75% to Vidulum on every chain ---
            chainIdsToAffiliates={chainIdsToAffiliates}
            // --- Injected wallet: pass connected addresses + Cosmos signer ---
            connectedAddresses={connectedAddresses}
            getCosmosSigner={getCosmosSigner}
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
