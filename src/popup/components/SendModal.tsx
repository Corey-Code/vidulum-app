import React, { useState, useEffect } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Button,
  VStack,
  HStack,
  Text,
  Input,
  InputGroup,
  InputRightElement,
  FormControl,
  FormLabel,
  FormHelperText,
  useToast,
  Divider,
  Box,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Spinner,
  Badge,
} from '@chakra-ui/react';
import { ChevronDownIcon } from '@chakra-ui/icons';
import { useWalletStore } from '@/store/walletStore';
import { useChainStore } from '@/store/chainStore';
import { ChainInfo } from '@/types/wallet';
import { fetchChainAssets, RegistryAsset } from '@/lib/assets/chainRegistry';
import { simulateSendFee, FeeEstimate } from '@/lib/cosmos/fees';
import { isValidBitcoinAddress } from '@/lib/crypto/bitcoin';
import { getBitcoinClient } from '@/lib/bitcoin/client';
import { isValidEvmAddress } from '@/lib/crypto/evm';
import { getEvmClient, formatEther } from '@/lib/evm/client';
import { NetworkType, networkRegistry } from '@/lib/networks';

interface SendModalProps {
  isOpen: boolean;
  onClose: () => void;
  chainId: string;
  chainConfig?: ChainInfo;
  onSuccess?: () => void;
  networkType?: NetworkType;
  bitcoinAddress?: string;
  evmAddress?: string;
}

const SendModal: React.FC<SendModalProps> = ({
  isOpen,
  onClose,
  chainId,
  chainConfig,
  onSuccess,
  networkType = 'cosmos',
  bitcoinAddress = '',
  evmAddress = '',
}) => {
  const { selectedAccount, sendTokens, getAddressForChain } = useWalletStore();
  const { getBalance, fetchBalance } = useChainStore();

  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'input' | 'confirm'>('input');
  const [selectedDenom, setSelectedDenom] = useState<string>('');
  const [registryAssets, setRegistryAssets] = useState<RegistryAsset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [estimatedFee, setEstimatedFee] = useState<FeeEstimate | null>(null);
  const [simulatingFee, setSimulatingFee] = useState(false);

  const toast = useToast();

  const isBitcoin = networkType === 'bitcoin';
  const isEvm = networkType === 'evm';
  const addressPrefix = chainConfig?.bech32Config.bech32PrefixAccAddr || 'bze';

  // Get network config from registry for UTXO/EVM chains
  const networkConfig = networkRegistry.get(chainId);

  // Get network-specific address placeholder
  const getAddressPlaceholder = (): string => {
    if (isEvm) return '0x...';
    if (!isBitcoin) return `${addressPrefix}1...`; // Cosmos

    // UTXO chains - check address type from network config
    if (networkConfig?.type === 'bitcoin') {
      const btcConfig = networkConfig;
      switch (btcConfig.addressType) {
        case 'p2wpkh': // Native SegWit (bc1..., ltc1...)
          return btcConfig.addressPrefix?.bech32
            ? `${btcConfig.addressPrefix.bech32}1...`
            : 'bc1...';
        case 'transparent': // Zcash-style (t1...)
          return 't1...';
        case 'p2pkh': // Legacy (1..., R..., L...)
          // Map pubKeyHash to first character
          const pubKeyHash = btcConfig.addressPrefix?.pubKeyHash;
          if (typeof pubKeyHash === 'number') {
            if (pubKeyHash === 0x00) return '1...'; // Bitcoin
            if (pubKeyHash === 0x30) return 'L...'; // Litecoin
            if (pubKeyHash === 0x3c) return 'R...'; // Ravencoin
          }
          return '1...';
        case 'p2sh-p2wpkh': // Nested SegWit (3..., M...)
          return '3...';
        default:
          return 'bc1...';
      }
    }
    return 'bc1...';
  };

  const addressPlaceholder = getAddressPlaceholder();
  const nativeSymbol = networkConfig?.symbol || (isBitcoin ? 'BTC' : isEvm ? 'ETH' : 'BZE');
  const nativeDecimals = networkConfig?.decimals || (isBitcoin ? 8 : isEvm ? 18 : 6);

  // Get the correct address for this chain
  const chainAddress = isBitcoin
    ? bitcoinAddress
    : isEvm
    ? evmAddress
    : getAddressForChain(addressPrefix) || '';

  // Get current balance for this chain
  const balance = chainAddress ? getBalance(chainId, chainAddress) : undefined;

  // Fetch assets from chain registry
  useEffect(() => {
    const loadAssets = async () => {
      setLoadingAssets(true);
      try {
        const assets = await fetchChainAssets(chainId);
        setRegistryAssets(assets);
      } catch (error) {
        console.error('Failed to fetch chain registry assets:', error);
        setRegistryAssets([]);
      } finally {
        setLoadingAssets(false);
      }
    };
    if (isOpen) {
      loadAssets();
    }
  }, [chainId, isOpen]);

  // Fetch Bitcoin/UTXO fee estimates when Bitcoin network is selected
  useEffect(() => {
    if (isBitcoin && isOpen) {
      const fetchFees = async () => {
        try {
          // Only fetch from API for Bitcoin mainnet/testnet
          if (chainId === 'bitcoin-mainnet' || chainId === 'bitcoin-testnet') {
            const client = getBitcoinClient(chainId);
            const fees = await client.getFeeEstimates();
            const feeAmount = fees.halfHourFee * 140;
            setEstimatedFee({
              amount: String(feeAmount),
              denom: nativeSymbol.toLowerCase(),
              formatted: `~${(feeAmount / Math.pow(10, nativeDecimals)).toFixed(
                8
              )} ${nativeSymbol}`,
            });
          } else {
            // For other UTXO chains, use a reasonable default
            const defaultFee = 10000; // 0.0001 of native token
            setEstimatedFee({
              amount: String(defaultFee),
              denom: nativeSymbol.toLowerCase(),
              formatted: `~${(defaultFee / Math.pow(10, nativeDecimals)).toFixed(
                8
              )} ${nativeSymbol}`,
            });
          }
        } catch (error) {
          console.warn('Failed to fetch UTXO fees:', error);
          // Set a reasonable default fee
          const defaultFee = 10000;
          setEstimatedFee({
            amount: String(defaultFee),
            denom: nativeSymbol.toLowerCase(),
            formatted: `~${(defaultFee / Math.pow(10, nativeDecimals)).toFixed(8)} ${nativeSymbol}`,
          });
        }
      };
      fetchFees();
    }
  }, [isBitcoin, isOpen, chainId, nativeSymbol, nativeDecimals]);

  // Fetch EVM gas price when EVM network is selected
  useEffect(() => {
    if (isEvm && isOpen) {
      const fetchGasPrice = async () => {
        try {
          const client = getEvmClient(chainId);
          const feeData = await client.getFeeData();
          // Estimate for 21000 gas (simple transfer)
          const estimatedGasCost = feeData.gasPrice * 21000n;
          setEstimatedFee({
            amount: estimatedGasCost.toString(),
            denom: 'wei',
            formatted: `~${formatEther(estimatedGasCost)} ${nativeSymbol}`,
          });
        } catch (error) {
          console.warn('Failed to fetch EVM gas price:', error);
          // Set a reasonable default
          setEstimatedFee({
            amount: '21000000000000', // ~0.000021 ETH
            denom: 'wei',
            formatted: `~0.000021 ${nativeSymbol}`,
          });
        }
      };
      fetchGasPrice();
    }
  }, [isEvm, isOpen, chainId, nativeSymbol]);

  // Simulate fee when form fields change (Cosmos only)
  useEffect(() => {
    // Skip for Bitcoin and EVM
    if (isBitcoin || isEvm) return;

    const simulateFee = async () => {
      if (!chainConfig?.rest || !chainAddress || !recipient || !amount || !selectedDenom) {
        return;
      }

      // Validate recipient address
      if (!recipient.startsWith(addressPrefix) || recipient.length < 39) {
        return;
      }

      // Validate amount
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        return;
      }

      // Get selected account's pubkey
      if (!selectedAccount?.pubKey) {
        return;
      }

      setSimulatingFee(true);
      try {
        const selectedToken = getTokenConfig(selectedDenom);
        const amountInSmallestUnit = Math.floor(
          amountNum * Math.pow(10, selectedToken.decimals)
        ).toString();

        const simResult = await simulateSendFee(
          chainConfig.rest,
          chainAddress,
          recipient,
          amountInSmallestUnit,
          selectedDenom,
          selectedAccount.pubKey
        );

        setEstimatedFee(simResult.fee);
        console.log(`Simulated fee: ${simResult.fee.formatted} (gas: ${simResult.gas})`);
      } catch (error) {
        console.warn('Fee simulation failed:', error);
        // Keep previous estimate or set higher default (150k gas * 0.01 = 1500 ubze)
        if (!estimatedFee) {
          setEstimatedFee({
            amount: '1500',
            denom: 'ubze',
            formatted: '0.001500 BZE',
          });
        }
      } finally {
        setSimulatingFee(false);
      }
    };

    // Debounce the simulation
    const debounceTimer = setTimeout(simulateFee, 500);
    return () => clearTimeout(debounceTimer);
  }, [
    isBitcoin,
    chainConfig?.rest,
    chainAddress,
    recipient,
    amount,
    selectedDenom,
    selectedAccount?.pubKey,
    addressPrefix,
  ]);

  // Get token config from registry
  const getTokenConfig = (denom: string) => {
    const registryAsset = registryAssets.find((a) => a.denom === denom);
    if (registryAsset) {
      return {
        symbol: registryAsset.symbol,
        name: registryAsset.name,
        decimals: registryAsset.decimals,
      };
    }
    // Fallback for unknown tokens
    return {
      symbol: denom.startsWith('ibc/') ? 'IBC' : denom.slice(0, 6).toUpperCase(),
      name: denom.startsWith('ibc/') ? 'IBC Token' : denom,
      decimals: 6,
    };
  };

  // For Bitcoin/UTXO and EVM, always show native asset even with 0 balance
  // For Cosmos, filter to only show tokens with balance > 0
  const tokensWithBalance = (() => {
    if (isBitcoin) {
      // UTXO chains always show native asset
      // Get the native denom from registry assets
      const nativeDenom =
        registryAssets.length > 0 ? registryAssets[0].denom : nativeSymbol.toLowerCase();
      const nativeBalance = balance?.find((b) => b.denom === nativeDenom || b.denom === 'sat');
      return [{ denom: nativeDenom, amount: nativeBalance?.amount || '0' }];
    }
    if (isEvm) {
      // EVM chains always show native asset
      const nativeDenom = registryAssets.length > 0 ? registryAssets[0].denom : 'wei';
      const nativeBalance = balance?.find((b) => b.denom === nativeDenom || b.denom === 'wei');
      return [{ denom: nativeDenom, amount: nativeBalance?.amount || '0' }];
    }
    // Cosmos: filter to tokens with balance > 0
    return balance?.filter((b) => parseInt(b.amount) > 0) || [];
  })();

  // Get selected token info
  const selectedToken = getTokenConfig(selectedDenom);
  const selectedBalance = tokensWithBalance.find((b) => b.denom === selectedDenom);
  const availableBalance = selectedBalance
    ? parseInt(selectedBalance.amount) / Math.pow(10, selectedToken.decimals)
    : 0;

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setRecipient('');
      setAmount('');
      setMemo('');
      setStep('input');
      setSelectedDenom('');
    }
  }, [isOpen]);

  // Reset selected denom when network changes to prevent stale asset selection
  useEffect(() => {
    setSelectedDenom('');
  }, [chainId]);

  // Auto-select native token for Bitcoin/EVM, or first token with balance for Cosmos
  useEffect(() => {
    if (!selectedDenom || selectedDenom === 'sat' || selectedDenom === 'wei') {
      if (isBitcoin || isEvm) {
        // Use first registry asset denom for UTXO/EVM chains
        if (registryAssets.length > 0) {
          setSelectedDenom(registryAssets[0].denom);
        } else if (tokensWithBalance.length > 0) {
          setSelectedDenom(tokensWithBalance[0].denom);
        }
      } else if (tokensWithBalance.length > 0) {
        setSelectedDenom(tokensWithBalance[0].denom);
      }
    }
  }, [tokensWithBalance, selectedDenom, isBitcoin, isEvm, registryAssets]);

  const validateAddress = (address: string): boolean => {
    if (isBitcoin) {
      const network = chainId === 'bitcoin-mainnet' ? 'mainnet' : 'testnet';
      return isValidBitcoinAddress(address, network);
    }
    if (isEvm) {
      return isValidEvmAddress(address);
    }
    return address.startsWith(addressPrefix) && address.length >= 39;
  };

  const handleMaxAmount = () => {
    // Leave some for fees if sending native token
    const feeDenom = chainConfig?.feeCurrencies[0]?.coinMinimalDenom || 'ubze';
    // Use estimated fee or default to 0.001 (1000 ubze)
    const feeReserve = estimatedFee ? parseInt(estimatedFee.amount) / 1_000_000 : 0.001;
    const maxAmount =
      selectedDenom === feeDenom
        ? Math.max(0, availableBalance - feeReserve - 0.001) // Extra buffer
        : availableBalance;
    setAmount(maxAmount.toFixed(6));
  };

  const handleContinue = () => {
    if (!selectedDenom) {
      toast({
        title: 'Select a token',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    if (!recipient) {
      toast({
        title: 'Recipient address required',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    if (!validateAddress(recipient)) {
      toast({
        title: 'Invalid recipient address',
        description: isBitcoin
          ? 'Enter a valid Bitcoin address'
          : isEvm
          ? 'Enter a valid Ethereum address (0x...)'
          : `Address must start with "${addressPrefix}"`,
        status: 'error',
        duration: 3000,
      });
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: 'Invalid amount',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    if (parseFloat(amount) > availableBalance) {
      toast({
        title: 'Insufficient balance',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    setStep('confirm');
  };

  const handleSend = async () => {
    if (!chainAddress) return;

    setLoading(true);
    try {
      if (isBitcoin) {
        // UTXO sending - show coming soon message for now
        // Full implementation requires PSBT/transaction construction and signing
        toast({
          title: `${nativeSymbol} Sending`,
          description: `${nativeSymbol} transaction signing is coming soon. Your address is ready to receive ${nativeSymbol}.`,
          status: 'info',
          duration: 5000,
        });
        onClose();
        return;
      }

      if (isEvm) {
        // EVM sending - show coming soon message for now
        // Full implementation requires transaction signing
        toast({
          title: `${nativeSymbol} Sending`,
          description: `EVM transaction signing is coming soon. Your address is ready to receive ${nativeSymbol}.`,
          status: 'info',
          duration: 5000,
        });
        onClose();
        return;
      }

      // Convert amount to smallest unit
      const amountInSmallestUnit = Math.floor(
        parseFloat(amount) * Math.pow(10, selectedToken.decimals)
      ).toString();

      const txHash = await sendTokens(
        chainId,
        chainAddress,
        recipient,
        amountInSmallestUnit,
        selectedDenom,
        memo
      );

      toast({
        title: 'Transaction sent!',
        description: `TX: ${txHash.slice(0, 16)}...`,
        status: 'success',
        duration: 5000,
      });

      // Refresh balance
      await fetchBalance(chainId, chainAddress);

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Send error:', error);
      toast({
        title: 'Transaction failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  const feeToken = chainConfig?.feeCurrencies[0];
  const feeDisplay = isBitcoin
    ? estimatedFee?.formatted || `~0.0001 ${nativeSymbol}`
    : isEvm
    ? estimatedFee?.formatted || `~0.0001 ${nativeSymbol}`
    : estimatedFee?.formatted || `~0.001 ${feeToken?.coinDenom || 'BZE'}`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="md">
      <ModalOverlay bg="blackAlpha.700" />
      <ModalContent
        bg="#0a0a0a"
        color="white"
        mx={4}
        borderRadius="2xl"
        border="1px"
        borderColor="#2a2a2a"
      >
        <ModalHeader>
          <HStack spacing={2}>
            <Text>{step === 'input' ? 'Send' : 'Confirm Transaction'}</Text>
            {isBitcoin && (
              <Badge colorScheme="orange" fontSize="xs">
                {nativeSymbol}
              </Badge>
            )}
            {isEvm && (
              <Badge colorScheme="blue" fontSize="xs">
                {nativeSymbol}
              </Badge>
            )}
          </HStack>
        </ModalHeader>
        <ModalCloseButton color="gray.500" _hover={{ color: 'white' }} />

        <ModalBody>
          {loadingAssets ? (
            <VStack py={8}>
              <Spinner size="lg" color="cyan.400" />
              <Text color="gray.500">Loading assets...</Text>
            </VStack>
          ) : step === 'input' ? (
            <VStack spacing={4} align="stretch">
              {/* Asset Selector */}
              <FormControl>
                <FormLabel fontSize="sm" color="gray.400">
                  Asset
                </FormLabel>
                <Menu>
                  <MenuButton
                    as={Button}
                    rightIcon={<ChevronDownIcon />}
                    w="full"
                    bg="#141414"
                    border="none"
                    borderRadius="xl"
                    _hover={{ bg: '#1a1a1a' }}
                    _active={{ bg: '#1a1a1a' }}
                    textAlign="left"
                    fontWeight="normal"
                  >
                    {selectedDenom ? (
                      <HStack justify="space-between" w="full">
                        <Text>{selectedToken.symbol}</Text>
                        <Text color="gray.500" fontSize="sm">
                          {availableBalance < 0.001 && availableBalance > 0
                            ? availableBalance.toFixed(6)
                            : availableBalance.toFixed(3)}{' '}
                          available
                        </Text>
                      </HStack>
                    ) : (
                      <Text color="gray.500">Select token</Text>
                    )}
                  </MenuButton>
                  <MenuList bg="#141414" borderColor="#2a2a2a" borderRadius="xl">
                    {tokensWithBalance.length > 0 ? (
                      tokensWithBalance.map((b) => {
                        const config = getTokenConfig(b.denom);
                        const tokenAmount = parseInt(b.amount) / Math.pow(10, config.decimals);
                        return (
                          <MenuItem
                            key={b.denom}
                            bg="transparent"
                            _hover={{ bg: 'whiteAlpha.100' }}
                            onClick={() => setSelectedDenom(b.denom)}
                          >
                            <HStack justify="space-between" w="full">
                              <VStack align="start" spacing={0}>
                                <Text fontWeight="medium">{config.symbol}</Text>
                                <Text fontSize="xs" color="gray.500">
                                  {config.name}
                                </Text>
                              </VStack>
                              <Text color="gray.400">
                                {tokenAmount < 0.001 && tokenAmount > 0
                                  ? tokenAmount.toFixed(6)
                                  : tokenAmount.toFixed(3)}
                              </Text>
                            </HStack>
                          </MenuItem>
                        );
                      })
                    ) : (
                      <MenuItem bg="transparent" isDisabled>
                        <Text color="gray.500">No tokens with balance</Text>
                      </MenuItem>
                    )}
                  </MenuList>
                </Menu>
              </FormControl>

              {/* Recipient */}
              <FormControl>
                <FormLabel fontSize="sm" color="gray.400">
                  Recipient Address
                </FormLabel>
                <Input
                  placeholder={addressPlaceholder}
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  fontFamily="mono"
                  fontSize="sm"
                  bg="#141414"
                  border="none"
                  borderRadius="xl"
                  _placeholder={{ color: 'gray.600' }}
                  _focus={{
                    ring: 2,
                    ringColor: isBitcoin ? 'orange.400' : isEvm ? 'blue.400' : 'cyan.400',
                  }}
                />
              </FormControl>

              {/* Amount */}
              <FormControl>
                <FormLabel fontSize="sm" color="gray.400">
                  Amount
                </FormLabel>
                <InputGroup>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    step="0.000001"
                    bg="#141414"
                    border="none"
                    borderRadius="xl"
                    _placeholder={{ color: 'gray.600' }}
                    _focus={{ ring: 2, ringColor: 'cyan.400' }}
                  />
                  <InputRightElement width="auto" pr={2}>
                    <HStack spacing={1}>
                      <Button
                        size="xs"
                        variant="ghost"
                        color="cyan.400"
                        _hover={{ color: 'cyan.300' }}
                        onClick={handleMaxAmount}
                      >
                        MAX
                      </Button>
                      <Text fontSize="sm" color="gray.500">
                        {selectedToken.symbol}
                      </Text>
                    </HStack>
                  </InputRightElement>
                </InputGroup>
              </FormControl>

              {/* Memo (optional) - Cosmos only */}
              {!isBitcoin && !isEvm && (
                <FormControl>
                  <FormLabel fontSize="sm" color="gray.400">
                    Memo (optional)
                  </FormLabel>
                  <Input
                    placeholder="Optional message"
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    bg="#141414"
                    border="none"
                    borderRadius="xl"
                    _placeholder={{ color: 'gray.600' }}
                    _focus={{ ring: 2, ringColor: 'cyan.400' }}
                  />
                  <FormHelperText fontSize="xs" color="gray.600">
                    Some exchanges require a memo
                  </FormHelperText>
                </FormControl>
              )}

              {/* Estimated Fee */}
              <Box p={3} bg="#141414" borderRadius="xl">
                <HStack justify="space-between">
                  <Text fontSize="sm" color="gray.500">
                    Estimated Fee
                  </Text>
                  <HStack spacing={2}>
                    {simulatingFee && <Spinner size="xs" color="cyan.400" />}
                    <Text fontSize="sm">{feeDisplay}</Text>
                  </HStack>
                </HStack>
              </Box>
            </VStack>
          ) : (
            <VStack spacing={4} align="stretch">
              {/* Transaction Summary */}
              <Box p={4} bg="#141414" borderRadius="xl">
                <VStack spacing={3} align="stretch">
                  <HStack justify="space-between">
                    <Text fontSize="sm" color="gray.500">
                      From
                    </Text>
                    <Text fontSize="sm" fontFamily="mono">
                      {chainAddress.slice(0, 12)}...
                      {chainAddress.slice(-6)}
                    </Text>
                  </HStack>

                  <HStack justify="space-between">
                    <Text fontSize="sm" color="gray.500">
                      To
                    </Text>
                    <Text fontSize="sm" fontFamily="mono">
                      {recipient.slice(0, 12)}...{recipient.slice(-6)}
                    </Text>
                  </HStack>

                  <Divider borderColor="#2a2a2a" />

                  <HStack justify="space-between">
                    <Text fontSize="sm" color="gray.500">
                      Amount
                    </Text>
                    <Text
                      fontSize="lg"
                      fontWeight="bold"
                      color={isBitcoin ? 'orange.400' : isEvm ? 'blue.400' : 'cyan.400'}
                    >
                      {amount} {selectedToken.symbol}
                    </Text>
                  </HStack>

                  {memo && (
                    <HStack justify="space-between">
                      <Text fontSize="sm" color="gray.500">
                        Memo
                      </Text>
                      <Text fontSize="sm">{memo}</Text>
                    </HStack>
                  )}

                  <Divider borderColor="#2a2a2a" />

                  <HStack justify="space-between">
                    <Text fontSize="sm" color="gray.500">
                      Network Fee
                    </Text>
                    <Text fontSize="sm">{feeDisplay}</Text>
                  </HStack>
                </VStack>
              </Box>

              <Text fontSize="xs" color="gray.600" textAlign="center">
                Review all details before confirming
              </Text>
            </VStack>
          )}
        </ModalBody>

        <ModalFooter>
          {step === 'input' ? (
            <HStack spacing={3} w="full">
              <Button
                variant="ghost"
                flex={1}
                onClick={onClose}
                color="gray.400"
                _hover={{ color: 'white', bg: 'whiteAlpha.100' }}
              >
                Cancel
              </Button>
              <Button
                bg={isBitcoin ? 'orange.500' : isEvm ? 'blue.500' : 'cyan.500'}
                color="white"
                _hover={{ bg: isBitcoin ? 'orange.600' : isEvm ? 'blue.600' : 'cyan.600' }}
                flex={1}
                borderRadius="xl"
                onClick={handleContinue}
                isDisabled={!recipient || !amount || !selectedDenom}
              >
                Continue
              </Button>
            </HStack>
          ) : (
            <HStack spacing={3} w="full">
              <Button
                variant="ghost"
                flex={1}
                onClick={() => setStep('input')}
                color="gray.400"
                _hover={{ color: 'white', bg: 'whiteAlpha.100' }}
              >
                Back
              </Button>
              <Button
                bg={isBitcoin ? 'orange.500' : isEvm ? 'blue.500' : 'cyan.500'}
                color="white"
                _hover={{ bg: isBitcoin ? 'orange.600' : isEvm ? 'blue.600' : 'cyan.600' }}
                flex={1}
                borderRadius="xl"
                onClick={handleSend}
                isLoading={loading}
                loadingText="Sending..."
              >
                {isBitcoin || isEvm ? `Send ${nativeSymbol}` : 'Confirm & Send'}
              </Button>
            </HStack>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default SendModal;
