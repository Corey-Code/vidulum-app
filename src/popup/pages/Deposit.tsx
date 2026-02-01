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
import MoonPayWidget from '@/popup/components/MoonPayWidget';

// MoonPay supported cryptocurrencies mapping
const MOONPAY_CRYPTO_CODES: Record<string, string> = {
  'base-mainnet': 'usdc_base',
  'ethereum-mainnet': 'eth',
  'bnb-mainnet': 'bnb_bsc',
  'polygon-mainnet': 'matic_polygon',
  'arbitrum-mainnet': 'eth_arbitrum',
  'optimism-mainnet': 'eth_optimism',
  'avalanche-mainnet': 'avax_cchain',
  'cosmoshub-4': 'atom',
  'osmosis-1': 'osmo',
  'beezee-1': '',
  'atomone-1': '',
  'bitcoin-mainnet': 'btc',
  'litecoin-mainnet': 'ltc',
  'dogecoin-mainnet': 'doge',
  'zcash-mainnet': 'zec',
  'flux-mainnet': '',
  'ravencoin-mainnet': '',
  'bitcoinz-mainnet': '',
};

const MOONPAY_DISPLAY_NAMES: Record<string, string> = {
  'base-mainnet': 'USDC (Base)',
  'ethereum-mainnet': 'ETH (Ethereum)',
  'bnb-mainnet': 'BNB (BSC)',
  'polygon-mainnet': 'MATIC (Polygon)',
  'arbitrum-mainnet': 'ETH (Arbitrum)',
  'optimism-mainnet': 'ETH (Optimism)',
  'avalanche-mainnet': 'AVAX (C-Chain)',
  'cosmoshub-4': 'ATOM (Cosmos Hub)',
  'osmosis-1': 'OSMO (Osmosis)',
  'bitcoin-mainnet': 'BTC (Bitcoin)',
  'litecoin-mainnet': 'LTC (Litecoin)',
  'dogecoin-mainnet': 'DOGE (Dogecoin)',
  'zcash-mainnet': 'ZEC (Zcash)',
};

const DEFAULT_DEPOSIT_NETWORK = 'base-mainnet';
const MOONPAY_API_KEY = import.meta.env.VITE_MOONPAY_API_KEY ?? '';

interface DepositProps {
  onBack: () => void;
}

/**
 * Deposit Page
 * - Web App: Shows simplified MoonPay SDK widget with overlay popup
 * - Extension: Shows network selection and opens MoonPay in new tab
 */
const Deposit: React.FC<DepositProps> = ({ onBack }) => {
  // For web app, render simplified view with MoonPay SDK
  if (__IS_WEB_BUILD__) {
    return <DepositWeb onBack={onBack} />;
  }

  // Extension version with full network selection
  return <DepositExtension onBack={onBack} />;
};

/**
 * Simplified Deposit for Web App - Just MoonPay widget
 */
const DepositWeb: React.FC<DepositProps> = ({ onBack }) => {
  return (
    <Box minH="100vh" bg="#0a0a0a" color="white" p={4}>
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
          Deposit
        </Text>
        <Badge colorScheme="teal" ml={2}>
          Buy Crypto
        </Badge>
      </HStack>

      <VStack spacing={4} align="stretch">
        <MoonPayWidget flow="buy" colorCode="#14B8A6" />

        <Box textAlign="center" pt={2}>
          <Text fontSize="xs" color="gray.500">
            Powered by{' '}
            <Link href="https://www.moonpay.com" isExternal color="teal.400">
              MoonPay
            </Link>
          </Text>
        </Box>
      </VStack>
    </Box>
  );
};

/**
 * Full Deposit for Extension - Network selection + external MoonPay tab
 */
const DepositExtension: React.FC<DepositProps> = ({ onBack }) => {
  const { selectedAccount, getAddressForChain, getBitcoinAddress, getEvmAddress } =
    useWalletStore();
  const { loadPreferences, isLoaded: networkPrefsLoaded, isNetworkEnabled } = useNetworkStore();
  const toast = useToast();

  const [selectedNetwork, setSelectedNetwork] = useState(DEFAULT_DEPOSIT_NETWORK);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [loadingAddress, setLoadingAddress] = useState(false);

  useEffect(() => {
    if (!networkPrefsLoaded) {
      loadPreferences();
    }
  }, [networkPrefsLoaded, loadPreferences]);

  const supportedNetworks = networkRegistry
    .getAll()
    .filter((n) => isNetworkEnabled(n.id))
    .filter((n) => MOONPAY_CRYPTO_CODES[n.id] && MOONPAY_CRYPTO_CODES[n.id] !== '');

  useEffect(() => {
    if (
      networkPrefsLoaded &&
      supportedNetworks.length > 0 &&
      !supportedNetworks.some((n) => n.id === selectedNetwork)
    ) {
      setSelectedNetwork(supportedNetworks[0].id);
    }
  }, [networkPrefsLoaded, supportedNetworks, selectedNetwork]);

  const networkConfig = networkRegistry.get(selectedNetwork);
  const cryptoCode = MOONPAY_CRYPTO_CODES[selectedNetwork] || '';
  const isSupported = cryptoCode !== '';
  const displayAsset =
    MOONPAY_DISPLAY_NAMES[selectedNetwork] ||
    (networkConfig ? `${networkConfig.symbol} (${networkConfig.name})` : 'crypto');

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

  const buildMoonPayUrl = () => {
    const baseUrl = 'https://buy.moonpay.com';
    const params = new URLSearchParams({
      apiKey: MOONPAY_API_KEY,
      currencyCode: cryptoCode,
      walletAddress: walletAddress,
      colorCode: '14B8A6',
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
    browser.tabs.create({ url: buildMoonPayUrl() });
  };

  return (
    <Box minH="100vh" bg="#0a0a0a" color="white" p={4}>
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
          Deposit
        </Text>
        <Badge colorScheme="teal" ml={2}>
          Buy Crypto
        </Badge>
      </HStack>

      <VStack spacing={4} align="stretch">
        {!networkPrefsLoaded ? (
          <Box textAlign="center" py={8}>
            <Spinner size="lg" color="teal.400" />
            <Text fontSize="sm" color="gray.400" mt={2}>
              Loading network preferences...
            </Text>
          </Box>
        ) : (
          <>
            <Box>
              <Text fontSize="sm" color="gray.400" mb={2}>
                Select Network
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

            <Box>
              <HStack justify="space-between" mb={2}>
                <Text fontSize="sm" color="gray.400">
                  Receiving Address
                </Text>
                {walletAddress && (
                  <IconButton
                    aria-label="Copy address"
                    icon={<CopyIcon />}
                    size="xs"
                    variant="ghost"
                    color="gray.500"
                    _hover={{ color: 'teal.400' }}
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
            </Box>

            {!isSupported ? (
              <Box
                bg="orange.900"
                borderRadius="lg"
                p={4}
                borderWidth="1px"
                borderColor="orange.700"
              >
                <Text fontSize="sm" color="orange.200">
                  {networkConfig?.name || 'This network'} is not currently supported by MoonPay.
                </Text>
                <Text fontSize="xs" color="orange.300" mt={2}>
                  Please select a different network.
                </Text>
              </Box>
            ) : (
              <VStack spacing={4} align="stretch">
                <Box bg="#141414" borderRadius="xl" p={4} borderWidth="1px" borderColor="#2a2a2a">
                  <Text fontSize="sm" color="gray.400" mb={2}>
                    Buy {displayAsset} with credit card, debit card, or bank transfer.
                  </Text>
                  <Text fontSize="xs" color="gray.500">
                    Opens MoonPay in a new tab. Funds will be sent directly to your wallet.
                  </Text>
                </Box>

                <Button
                  colorScheme="teal"
                  size="lg"
                  onClick={handleOpenMoonPay}
                  isDisabled={!walletAddress || loadingAddress}
                  leftIcon={<ExternalLinkIcon />}
                >
                  {loadingAddress ? 'Loading...' : 'Buy with MoonPay'}
                </Button>
              </VStack>
            )}

            <Box textAlign="center" pt={2}>
              <Text fontSize="xs" color="gray.500">
                Powered by{' '}
                <Link href="https://www.moonpay.com" isExternal color="teal.400">
                  MoonPay
                </Link>
              </Text>
            </Box>
          </>
        )}
      </VStack>
    </Box>
  );
};

export default Deposit;
