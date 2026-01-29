import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  IconButton,
  Select,
  Spinner,
  useToast,
  Badge,
  Link,
} from '@chakra-ui/react';
import { ArrowBackIcon, ExternalLinkIcon, CopyIcon } from '@chakra-ui/icons';
import browser from 'webextension-polyfill';
import { useWalletStore } from '@/store/walletStore';
import { useNetworkStore } from '@/store/networkStore';
import { networkRegistry } from '@/lib/networks';

// MoonPay supported cryptocurrencies for selling (off-ramp)
const MOONPAY_SELL_CODES: Record<string, string> = {
  // EVM chains - Base USDC is the primary option
  'base-mainnet': 'usdc_base',
  'ethereum-mainnet': 'eth',
  'polygon-mainnet': 'matic_polygon',
  'arbitrum-mainnet': 'eth_arbitrum',
  'avalanche-mainnet': 'avax_cchain',
  // Cosmos chains - limited sell support
  'cosmoshub-4': 'atom',
  // UTXO chains
  'bitcoin-mainnet': 'btc',
  'litecoin-mainnet': 'ltc',
  'dogecoin-mainnet': 'doge',
};

// Default network for withdrawals
const DEFAULT_WITHDRAW_NETWORK = 'base-mainnet';

// MoonPay API Key (must be provided via environment; no test key fallback)
const MOONPAY_API_KEY = import.meta.env.VITE_MOONPAY_API_KEY;

interface WithdrawProps {
  onBack: () => void;
}

const Withdraw: React.FC<WithdrawProps> = ({ onBack }) => {
  const { selectedAccount, getAddressForChain, getBitcoinAddress, getEvmAddress } =
    useWalletStore();
  const { loadPreferences, getEnabledNetworks, isLoaded: networkPrefsLoaded } = useNetworkStore();
  const toast = useToast();

  const [selectedNetwork, setSelectedNetwork] = useState(DEFAULT_WITHDRAW_NETWORK);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [loadingAddress, setLoadingAddress] = useState(false);

  // Load network preferences on mount
  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  // Get supported networks for MoonPay sell from user preferences
  const supportedNetworks = getEnabledNetworks().filter(
    (n) => MOONPAY_SELL_CODES[n.id] && MOONPAY_SELL_CODES[n.id] !== ''
  );

  // Get current network config
  const networkConfig = networkRegistry.get(selectedNetwork);
  const cryptoCode = MOONPAY_SELL_CODES[selectedNetwork] || '';
  const isSupported = cryptoCode !== '';

  // Fetch wallet address when network changes
  useEffect(() => {
    const fetchAddress = async () => {
      if (!networkConfig || !selectedAccount) {
        setWalletAddress('');
        return;
      }

      setLoadingAddress(true);
      try {
        let address = '';
        if (networkConfig.type === 'cosmos') {
          address = getAddressForChain(networkConfig.bech32Prefix) || '';
        } else if (networkConfig.type === 'bitcoin') {
          address = (await getBitcoinAddress(selectedNetwork)) || '';
        } else if (networkConfig.type === 'evm') {
          address = (await getEvmAddress(selectedNetwork)) || '';
        }
        setWalletAddress(address);
      } catch (error) {
        console.error('Failed to get wallet address:', error);
        setWalletAddress('');
      } finally {
        setLoadingAddress(false);
      }
    };

    fetchAddress();
  }, [
    selectedNetwork,
    selectedAccount,
    networkConfig,
    getAddressForChain,
    getBitcoinAddress,
    getEvmAddress,
  ]);

  // Build MoonPay Sell URL for external link fallback
  const buildMoonPaySellUrl = () => {
    const baseUrl = 'https://sell.moonpay.com';
    const params = new URLSearchParams({
      apiKey: MOONPAY_API_KEY,
      baseCurrencyCode: cryptoCode,
      refundWalletAddress: walletAddress,
      colorCode: 'F97316',
      theme: 'dark',
      language: 'en',
    });
    return `${baseUrl}?${params.toString()}`;
  };

  const handleCopyAddress = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      toast({
        title: 'Address copied',
        status: 'success',
        duration: 2000,
      });
    }
  };

  const handleOpenMoonPay = () => {
    browser.tabs.create({ url: buildMoonPaySellUrl() });
  };

  return (
    <Box minH="100vh" bg="#0a0a0a" color="white" p={4}>
      {/* Header */}
      <HStack mb={4}>
        <IconButton
          aria-label="Back"
          icon={<ArrowBackIcon />}
          variant="ghost"
          color="gray.400"
          _hover={{ color: 'white', bg: 'whiteAlpha.100' }}
          onClick={onBack}
          size="sm"
        />
        <Text fontSize="lg" fontWeight="bold">
          Withdraw
        </Text>
        <Badge colorScheme="orange" ml={2}>
          Sell Crypto
        </Badge>
      </HStack>

      <VStack spacing={4} align="stretch">
        {/* Network Selection */}
        <Box>
          <Text fontSize="sm" color="gray.400" mb={2}>
            Select Crypto to Sell
          </Text>
          <Select
            value={selectedNetwork}
            onChange={(e) => setSelectedNetwork(e.target.value)}
            bg="#141414"
            borderColor="#2a2a2a"
            size="sm"
            _hover={{ borderColor: '#3a3a3a' }}
          >
            {supportedNetworks.map((network) => (
              <option key={network.id} value={network.id} style={{ background: '#141414' }}>
                {network.name} ({network.symbol})
              </option>
            ))}
          </Select>
        </Box>

        {/* Refund Address Display */}
        <Box>
          <HStack justify="space-between" mb={2}>
            <Text fontSize="sm" color="gray.400">
              Refund Address
            </Text>
            {walletAddress && (
              <IconButton
                aria-label="Copy address"
                icon={<CopyIcon />}
                size="xs"
                variant="ghost"
                color="gray.500"
                _hover={{ color: 'orange.400' }}
                onClick={handleCopyAddress}
              />
            )}
          </HStack>
          <Box
            bg="#141414"
            borderRadius="lg"
            p={2}
            borderWidth="1px"
            borderColor="#2a2a2a"
            fontFamily="mono"
            fontSize="xs"
            wordBreak="break-all"
          >
            {loadingAddress ? <Spinner size="sm" /> : walletAddress || 'No address available'}
          </Box>
          <Text fontSize="xs" color="gray.600" mt={1}>
            Used if the sale fails or is cancelled
          </Text>
        </Box>

        {/* Important Notes */}
        <Box bg="#1a1a1a" borderRadius="lg" p={3} borderWidth="1px" borderColor="#2a2a2a">
          <Text fontSize="xs" color="orange.400" fontWeight="medium" mb={1}>
            Important:
          </Text>
          <VStack align="start" spacing={0.5}>
            <Text fontSize="xs" color="gray.500">
              • KYC verification required
            </Text>
            <Text fontSize="xs" color="gray.500">
              • You'll send crypto to MoonPay's address
            </Text>
            <Text fontSize="xs" color="gray.500">
              • Fiat is deposited to your bank account
            </Text>
          </VStack>
        </Box>

        {/* MoonPay Action */}
        {!isSupported ? (
          <Box bg="orange.900" borderRadius="lg" p={4} borderWidth="1px" borderColor="orange.700">
            <Text fontSize="sm" color="orange.200">
              {networkConfig?.name || 'This network'} is not supported for selling via MoonPay.
            </Text>
            <Text fontSize="xs" color="orange.300" mt={2}>
              Sell support is limited to major cryptocurrencies.
            </Text>
          </Box>
        ) : (
          <VStack spacing={4} align="stretch">
            <Box bg="#141414" borderRadius="xl" p={4} borderWidth="1px" borderColor="#2a2a2a">
              <Text fontSize="sm" color="gray.400" mb={2}>
                Sell {networkConfig?.symbol || 'crypto'} and receive funds to your bank account.
              </Text>
              <Text fontSize="xs" color="gray.500">
                Opens MoonPay in a new tab to complete the sale.
              </Text>
            </Box>

            <Button
              colorScheme="orange"
              size="lg"
              onClick={handleOpenMoonPay}
              isDisabled={!walletAddress || loadingAddress}
              leftIcon={<ExternalLinkIcon />}
            >
              {loadingAddress ? 'Loading...' : 'Sell with MoonPay'}
            </Button>
          </VStack>
        )}

        {/* Footer */}
        <Box textAlign="center" pt={2}>
          <Text fontSize="xs" color="gray.500">
            Powered by{' '}
            <Link href="https://www.moonpay.com" isExternal color="orange.400">
              MoonPay
            </Link>
          </Text>
        </Box>
      </VStack>
    </Box>
  );
};

export default Withdraw;
