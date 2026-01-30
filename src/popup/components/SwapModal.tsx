import React, { useState, useEffect, useCallback } from 'react';
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
  useToast,
  Box,
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Spinner,
} from '@chakra-ui/react';
import { ChevronDownIcon, RepeatIcon } from '@chakra-ui/icons';
import { useWalletStore } from '@/store/walletStore';
import { useChainStore } from '@/store/chainStore';
import { ChainInfo } from '@/types/wallet';
import { fetchChainAssets } from '@/lib/assets/chainRegistry';
import { estimateSwapFee, FeeEstimate } from '@/lib/cosmos/fees';
import {
  findBestRoute,
  getRoutePoolIds,
  formatRoutePath,
  SwapRoute,
  LiquidityPool as RouterPool,
} from '@/lib/cosmos/swap-router';
import { toBase64, fromBase64 } from '@cosmjs/encoding';
import { TxRaw, AuthInfo, TxBody, SignerInfo, Fee } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { SignMode } from 'cosmjs-types/cosmos/tx/signing/v1beta1/signing';
import { Any } from 'cosmjs-types/google/protobuf/any';
import { PubKey } from 'cosmjs-types/cosmos/crypto/secp256k1/keys';

// Helper to encode a string as protobuf bytes (wire type 2)
function encodeString(fieldNum: number, value: string): Uint8Array {
  const valueBytes = new TextEncoder().encode(value);
  const tag = (fieldNum << 3) | 2; // wire type 2 = length-delimited
  const result = new Uint8Array(1 + varintBytes(valueBytes.length).length + valueBytes.length);
  let offset = 0;
  result[offset++] = tag;
  const lenBytes = varintBytes(valueBytes.length);
  result.set(lenBytes, offset);
  offset += lenBytes.length;
  result.set(valueBytes, offset);
  return result;
}

// Helper to encode varint
function varintBytes(value: number): Uint8Array {
  const bytes: number[] = [];
  while (value > 127) {
    bytes.push((value & 0x7f) | 0x80);
    value >>>= 7;
  }
  bytes.push(value);
  return new Uint8Array(bytes);
}

// Helper to encode an embedded message (wire type 2)
function encodeMessage(fieldNum: number, messageBytes: Uint8Array): Uint8Array {
  const tag = (fieldNum << 3) | 2;
  const lenBytes = varintBytes(messageBytes.length);
  const result = new Uint8Array(1 + lenBytes.length + messageBytes.length);
  let offset = 0;
  result[offset++] = tag;
  result.set(lenBytes, offset);
  offset += lenBytes.length;
  result.set(messageBytes, offset);
  return result;
}

// Encode a Coin message
function encodeCoin(denom: string, amount: string): Uint8Array {
  const denomBytes = encodeString(1, denom);
  const amountBytes = encodeString(2, amount);
  const result = new Uint8Array(denomBytes.length + amountBytes.length);
  result.set(denomBytes, 0);
  result.set(amountBytes, denomBytes.length);
  return result;
}

// Encode MsgMultiSwap
function encodeMsgMultiSwap(
  creator: string,
  routes: string[],
  inputDenom: string,
  inputAmount: string,
  minOutputDenom: string,
  minOutputAmount: string
): Uint8Array {
  const parts: Uint8Array[] = [];

  // Field 1: creator (string)
  parts.push(encodeString(1, creator));

  // Field 2: routes (repeated string)
  for (const route of routes) {
    parts.push(encodeString(2, route));
  }

  // Field 3: input (Coin)
  const inputCoin = encodeCoin(inputDenom, inputAmount);
  parts.push(encodeMessage(3, inputCoin));

  // Field 4: min_output (Coin)
  const minOutputCoin = encodeCoin(minOutputDenom, minOutputAmount);
  parts.push(encodeMessage(4, minOutputCoin));

  // Concatenate all parts
  const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }

  return result;
}

interface SwapModalProps {
  isOpen: boolean;
  onClose: () => void;
  chainId: string;
  chainConfig?: ChainInfo;
  onSuccess?: () => void;
  onSwapSuccess?: (fromDenom: string, toDenom: string) => void;
}

interface TokenInfo {
  symbol: string;
  name: string;
  decimals: number;
  denom: string;
}

interface LiquidityPool {
  id: string;
  base: string;
  quote: string;
  reserve_base: string;
  reserve_quote: string;
  fee: string;
}

// Default tokens - will be replaced with chain registry data
const defaultBzeTokens: TokenInfo[] = [
  { symbol: 'BZE', name: 'BeeZee', decimals: 6, denom: 'ubze' },
];

// Calculate output amount using constant product formula (x * y = k)
const calculateSwapOutput = (
  inputAmount: bigint,
  inputReserve: bigint,
  outputReserve: bigint,
  feePercent: number
): bigint => {
  if (inputAmount <= 0n || inputReserve <= 0n || outputReserve <= 0n) {
    return 0n;
  }

  // Apply fee (fee is taken from input)
  const feeMultiplier = BigInt(Math.floor((1 - feePercent) * 10000));
  const inputWithFee = (inputAmount * feeMultiplier) / 10000n;

  // Constant product formula: outputAmount = (inputWithFee * outputReserve) / (inputReserve + inputWithFee)
  const numerator = inputWithFee * outputReserve;
  const denominator = inputReserve + inputWithFee;

  return numerator / denominator;
};

const SwapModal: React.FC<SwapModalProps> = ({
  isOpen,
  onClose,
  chainId,
  chainConfig,
  onSuccess,
  onSwapSuccess,
}) => {
  const { selectedAccount, getAddressForChain, updateActivity, keyring } = useWalletStore();
  const { getBalance, fetchBalance } = useChainStore();

  const [availableTokens, setAvailableTokens] = useState<TokenInfo[]>(defaultBzeTokens);
  const [fromToken, setFromToken] = useState<TokenInfo>(defaultBzeTokens[0]);
  const [toToken, setToToken] = useState<TokenInfo | null>(null);
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [slippage, setSlippage] = useState(0.1);
  const [loading, setLoading] = useState(false);
  const [fetchingQuote, setFetchingQuote] = useState(false);
  const [step, setStep] = useState<'input' | 'confirm'>('input');
  const [pools, setPools] = useState<LiquidityPool[]>([]);
  const [loadingPools, setLoadingPools] = useState(false);
  const [txFee, setTxFee] = useState<FeeEstimate | null>(null);
  const [tradeFee, setTradeFee] = useState<FeeEstimate | null>(null);
  const [currentRoute, setCurrentRoute] = useState<SwapRoute | null>(null);

  const toast = useToast();

  const addressPrefix = chainConfig?.bech32Config.bech32PrefixAccAddr || 'bze';
  const chainAddress = getAddressForChain(addressPrefix) || '';
  const balance = chainAddress ? getBalance(chainId, chainAddress) : undefined;

  // Fetch liquidity pools, tokens, and fees on mount
  const fetchPoolsAndTokens = useCallback(async () => {
    setLoadingPools(true);
    try {
      // Fetch pools
      const poolResponse = await fetch('https://rest.getbze.com/bze/tradebin/all_liquidity_pools');
      const poolData = await poolResponse.json();
      const fetchedPools: LiquidityPool[] = poolData.list || [];
      setPools(fetchedPools);

      // Get all denoms that have pools
      const poolDenoms = new Set<string>();
      fetchedPools.forEach((pool) => {
        poolDenoms.add(pool.base);
        poolDenoms.add(pool.quote);
      });

      // Fetch assets from chain registry
      const registryAssets = await fetchChainAssets(chainId);

      // Filter to only tokens with pools
      const tokensWithPools: TokenInfo[] = registryAssets
        .filter((asset) => poolDenoms.has(asset.denom))
        .map((asset) => ({
          symbol: asset.symbol,
          name: asset.name,
          decimals: asset.decimals,
          denom: asset.denom,
        }));

      if (tokensWithPools.length > 0) {
        setAvailableTokens(tokensWithPools);
        setFromToken(tokensWithPools[0]);
        setToToken(tokensWithPools.length > 1 ? tokensWithPools[1] : null);
      }

      // Fetch swap fees from chain params
      if (chainConfig?.rest) {
        const fees = await estimateSwapFee(chainConfig.rest, 250000);
        setTxFee(fees.txFee);
        setTradeFee(fees.tradeFee);
      }
    } catch (error) {
      console.error('Failed to fetch pools/tokens:', error);
    } finally {
      setLoadingPools(false);
    }
  }, [chainId, chainConfig?.rest]);

  useEffect(() => {
    if (isOpen && chainId === 'beezee-1') {
      fetchPoolsAndTokens();
    }
  }, [isOpen, chainId, fetchPoolsAndTokens]);

  // Get balance for a specific token
  const getTokenBalance = (denom: string): number => {
    if (!balance) return 0;
    const tokenBalance = balance.find((b) => b.denom === denom);
    if (!tokenBalance) return 0;
    const token = availableTokens.find((t) => t.denom === denom);
    return parseInt(tokenBalance.amount) / Math.pow(10, token?.decimals || 6);
  };

  const fromBalance = getTokenBalance(fromToken.denom);
  const toBalance = toToken ? getTokenBalance(toToken.denom) : 0;

  // Calculate swap quote using router
  useEffect(() => {
    if (!fromAmount || parseFloat(fromAmount) <= 0 || !toToken) {
      setToAmount('');
      setCurrentRoute(null);
      return;
    }

    const calculateQuote = async () => {
      setFetchingQuote(true);
      try {
        const inputAmountRaw = BigInt(
          Math.floor(parseFloat(fromAmount) * Math.pow(10, fromToken.decimals))
        );

        // Find best route using router (max 3 hops)
        // Note: LiquidityPool and RouterPool interfaces are identical
        const route = findBestRoute(
          pools as RouterPool[],
          fromToken.denom,
          toToken.denom,
          inputAmountRaw,
          3
        );

        if (!route || !toToken) {
          setToAmount('');
          setCurrentRoute(null);
          return;
        }

        // Apply slippage tolerance
        const outputWithSlippage =
          (route.outputAmount * BigInt(Math.floor((100 - slippage) * 100))) / 10000n;
        const outputFormatted = Number(outputWithSlippage) / Math.pow(10, toToken.decimals);

        setToAmount(outputFormatted.toFixed(6));
        setCurrentRoute(route);
      } catch (error) {
        console.error('Failed to get quote:', error);
        setToAmount('');
        setCurrentRoute(null);
      } finally {
        setFetchingQuote(false);
      }
    };

    const debounce = setTimeout(calculateQuote, 300);
    return () => clearTimeout(debounce);
  }, [fromAmount, fromToken, toToken, slippage, pools]);

  // Swap token positions
  const handleSwapTokens = () => {
    const tempToken = fromToken;
    setFromToken(toToken);
    setToToken(tempToken);
    setFromAmount(toAmount);
    setToAmount(fromAmount);
  };

  // Set max amount
  const handleMaxAmount = () => {
    const maxAmount = fromToken.denom === 'ubze' ? Math.max(0, fromBalance - 0.01) : fromBalance;
    setFromAmount(maxAmount.toFixed(6));
  };

  // Reset form
  useEffect(() => {
    if (!isOpen) {
      setFromAmount('');
      setToAmount('');
      setStep('input');
      // Reset to first available tokens
      if (availableTokens.length > 0) {
        setFromToken(availableTokens[0]);
        setToToken(availableTokens.length > 1 ? availableTokens[1] : null);
      }
    }
  }, [isOpen, availableTokens]);

  const handleContinue = () => {
    if (!fromAmount || parseFloat(fromAmount) <= 0) {
      toast({ title: 'Enter an amount', status: 'error', duration: 2000 });
      return;
    }

    if (parseFloat(fromAmount) > fromBalance) {
      toast({ title: 'Insufficient balance', status: 'error', duration: 2000 });
      return;
    }

    if (!toAmount || parseFloat(toAmount) <= 0) {
      toast({ title: 'Unable to get quote', status: 'error', duration: 2000 });
      return;
    }

    if (!currentRoute) {
      toast({ title: 'No route available', status: 'error', duration: 2000 });
      return;
    }

    setStep('confirm');
    updateActivity();
  };

  const handleSwap = async () => {
    if (!keyring || !chainAddress || !toToken) {
      toast({
        title: 'Wallet not connected or tokens not selected',
        status: 'error',
        duration: 2000,
      });
      return;
    }

    if (!currentRoute) {
      toast({ title: 'No route available', status: 'error', duration: 2000 });
      return;
    }

    setLoading(true);
    try {
      // Build the swap message amounts
      const inputAmountRaw = Math.floor(parseFloat(fromAmount) * Math.pow(10, fromToken.decimals));
      const minOutputAmountRaw = Math.floor(
        parseFloat(toAmount) * Math.pow(10, toToken.decimals) * 0.95
      ); // 5% slippage buffer

      // Get account info via REST
      const accountResponse = await fetch(
        `https://rest.getbze.com/cosmos/auth/v1beta1/accounts/${chainAddress}`
      );
      const accountData = await accountResponse.json();

      // Handle different account response formats
      let accountNumber = '0';
      let sequence = '0';

      if (accountData.account) {
        accountNumber = accountData.account.account_number || '0';
        sequence = accountData.account.sequence || '0';
        // Handle BaseAccount wrapped in other types
        if (accountData.account.base_account) {
          accountNumber = accountData.account.base_account.account_number || '0';
          sequence = accountData.account.base_account.sequence || '0';
        }
      }

      // Get route pool IDs
      const routePoolIds = getRoutePoolIds(currentRoute);

      // Build the Amino message for MsgMultiSwap (correct format from proto)
      const aminoMsg = {
        type: 'bze/x/tradebin/MsgMultiSwap',
        value: {
          creator: chainAddress,
          routes: routePoolIds,
          input: {
            denom: fromToken.denom,
            amount: inputAmountRaw.toString(),
          },
          min_output: {
            denom: toToken.denom,
            amount: minOutputAmountRaw.toString(),
          },
        },
      };

      // Build sign doc for Amino signing
      const signDoc = {
        chain_id: 'beezee-1',
        account_number: accountNumber,
        sequence: sequence,
        fee: {
          amount: [{ denom: 'ubze', amount: '15000' }],
          gas: '400000',
        },
        msgs: [aminoMsg],
        memo: '',
      };

      console.log('Sign doc:', JSON.stringify(signDoc, null, 2));

      // Sign using Amino
      const signResponse = await keyring.signAmino(chainAddress, signDoc);

      // Get the public key from the sign response
      const pubKey = signResponse.signature.pub_key;

      // Encode MsgMultiSwap as protobuf bytes
      const msgBytes = encodeMsgMultiSwap(
        chainAddress,
        routePoolIds,
        fromToken.denom,
        inputAmountRaw.toString(),
        toToken.denom,
        minOutputAmountRaw.toString()
      );

      // Create the Any wrapper for the message
      const msgAny: Any = {
        typeUrl: '/bze.tradebin.MsgMultiSwap',
        value: msgBytes,
      };

      // Build TxBody
      const txBody = TxBody.fromPartial({
        messages: [msgAny],
        memo: '',
      });

      // Build AuthInfo with SIGN_MODE_LEGACY_AMINO_JSON
      const pubKeyAny: Any = {
        typeUrl: '/cosmos.crypto.secp256k1.PubKey',
        value: PubKey.encode(
          PubKey.fromPartial({
            key: fromBase64(pubKey.value),
          })
        ).finish(),
      };

      const signerInfo: SignerInfo = {
        publicKey: pubKeyAny,
        modeInfo: {
          single: {
            mode: SignMode.SIGN_MODE_LEGACY_AMINO_JSON,
          },
        },
        sequence: BigInt(sequence),
      };

      const fee: Fee = {
        amount: [{ denom: 'ubze', amount: '15000' }],
        gasLimit: BigInt(400000),
        payer: '',
        granter: '',
      };

      const authInfo = AuthInfo.fromPartial({
        signerInfos: [signerInfo],
        fee: fee,
      });

      // Build TxRaw
      const txRaw = TxRaw.fromPartial({
        bodyBytes: TxBody.encode(txBody).finish(),
        authInfoBytes: AuthInfo.encode(authInfo).finish(),
        signatures: [fromBase64(signResponse.signature.signature)],
      });

      // Encode to bytes and then base64
      const txBytes = TxRaw.encode(txRaw).finish();
      const txBytesBase64 = toBase64(txBytes);

      console.log('Broadcasting tx bytes:', txBytesBase64);

      // Broadcast via cosmos/tx/v1beta1/txs endpoint
      const broadcastResponse = await fetch('https://rest.getbze.com/cosmos/tx/v1beta1/txs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tx_bytes: txBytesBase64,
          mode: 'BROADCAST_MODE_SYNC',
        }),
      });

      const broadcastResult = await broadcastResponse.json();
      console.log('Broadcast result:', broadcastResult);

      // Check for errors
      if (broadcastResult.tx_response?.code && broadcastResult.tx_response.code !== 0) {
        throw new Error(
          broadcastResult.tx_response.raw_log ||
            broadcastResult.tx_response.log ||
            'Transaction failed'
        );
      }

      if (broadcastResult.tx_response?.txhash) {
        toast({
          title: 'Swap successful!',
          description: `Swapped ${fromAmount} ${fromToken.symbol} for ~${toAmount} ${toToken.symbol}`,
          status: 'success',
          duration: 5000,
        });

        // Notify parent to show updating indicators and poll for balance
        onSwapSuccess?.(fromToken.denom, toToken.denom);

        onSuccess?.();
        onClose();
      } else if (broadcastResult.message) {
        throw new Error(broadcastResult.message);
      } else {
        console.error('Unexpected response:', broadcastResult);
        throw new Error('Unexpected response from broadcast endpoint');
      }
    } catch (error) {
      console.error('Swap error:', error);
      toast({
        title: 'Swap failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  // Get route info from current route
  const priceImpact = currentRoute ? currentRoute.priceImpact : 0;
  const totalFee = currentRoute ? currentRoute.totalFee * 100 : 0; // Convert to percentage
  const hopCount = currentRoute ? currentRoute.pools.length : 0;

  // Create token symbol map for route visualization
  const tokenSymbolMap = new Map<string, string>();
  availableTokens.forEach((token) => {
    tokenSymbolMap.set(token.denom, token.symbol);
  });

  const routePath = currentRoute ? formatRoutePath(currentRoute, tokenSymbolMap) : '';

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
        <ModalHeader>Swap</ModalHeader>
        <ModalCloseButton color="gray.500" _hover={{ color: 'white' }} />

        <ModalBody>
          {loadingPools ? (
            <VStack py={8}>
              <Spinner size="lg" color="cyan.400" />
              <Text color="gray.500">Loading pools...</Text>
            </VStack>
          ) : step === 'input' ? (
            <VStack spacing={4} align="stretch">
              {/* From Token */}
              <Box bg="#141414" borderRadius="xl" p={4}>
                <HStack justify="space-between" mb={2}>
                  <Text fontSize="sm" color="gray.500">
                    From
                  </Text>
                  <Text fontSize="xs" color="gray.500">
                    Balance: {fromBalance.toFixed(4)} {fromToken.symbol}
                  </Text>
                </HStack>
                <HStack spacing={3}>
                  <InputGroup flex={1}>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={fromAmount}
                      onChange={(e) => setFromAmount(e.target.value)}
                      fontSize="xl"
                      fontWeight="bold"
                      border="none"
                      bg="transparent"
                      _focus={{ boxShadow: 'none' }}
                      _placeholder={{ color: 'gray.600' }}
                    />
                    <InputRightElement width="auto" pr={0}>
                      <Button
                        size="xs"
                        variant="ghost"
                        color="cyan.400"
                        _hover={{ color: 'cyan.300' }}
                        onClick={handleMaxAmount}
                      >
                        MAX
                      </Button>
                    </InputRightElement>
                  </InputGroup>
                  <Menu>
                    <MenuButton
                      as={Button}
                      rightIcon={<ChevronDownIcon />}
                      bg="#0a0a0a"
                      _hover={{ bg: '#1a1a1a' }}
                      _active={{ bg: '#1a1a1a' }}
                      borderRadius="xl"
                      size="sm"
                    >
                      {fromToken.symbol}
                    </MenuButton>
                    <MenuList bg="#141414" borderColor="#2a2a2a" borderRadius="xl">
                      {availableTokens
                        .filter((t) => t.denom !== toToken?.denom)
                        .map((token) => (
                          <MenuItem
                            key={token.denom}
                            bg="transparent"
                            _hover={{ bg: 'whiteAlpha.100' }}
                            onClick={() => setFromToken(token)}
                          >
                            <HStack justify="space-between" w="full">
                              <Text>{token.symbol}</Text>
                              <Text fontSize="xs" color="gray.500">
                                {getTokenBalance(token.denom).toFixed(4)}
                              </Text>
                            </HStack>
                          </MenuItem>
                        ))}
                    </MenuList>
                  </Menu>
                </HStack>
              </Box>

              {/* Swap Direction Button */}
              <Box display="flex" justifyContent="center" my={-2}>
                <IconButton
                  aria-label="Swap tokens"
                  icon={<RepeatIcon />}
                  size="sm"
                  variant="outline"
                  borderColor="#3a3a3a"
                  borderRadius="full"
                  _hover={{ bg: 'whiteAlpha.100', borderColor: 'cyan.500' }}
                  onClick={handleSwapTokens}
                />
              </Box>

              {/* To Token */}
              <Box bg="#141414" borderRadius="xl" p={4}>
                <HStack justify="space-between" mb={2}>
                  <Text fontSize="sm" color="gray.500">
                    To (estimated)
                  </Text>
                  <Text fontSize="xs" color="gray.500">
                    Balance: {toBalance.toFixed(4)} {toToken?.symbol || ''}
                  </Text>
                </HStack>
                <HStack spacing={3}>
                  <InputGroup flex={1}>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={toAmount}
                      readOnly
                      fontSize="xl"
                      fontWeight="bold"
                      border="none"
                      bg="transparent"
                      _focus={{ boxShadow: 'none' }}
                      _placeholder={{ color: 'gray.600' }}
                      color={toAmount ? 'white' : 'gray.600'}
                    />
                    {fetchingQuote && (
                      <InputRightElement>
                        <Spinner size="sm" color="cyan.400" />
                      </InputRightElement>
                    )}
                  </InputGroup>
                  <Menu>
                    <MenuButton
                      as={Button}
                      rightIcon={<ChevronDownIcon />}
                      bg="#0a0a0a"
                      _hover={{ bg: '#1a1a1a' }}
                      _active={{ bg: '#1a1a1a' }}
                      borderRadius="xl"
                      size="sm"
                    >
                      {toToken?.symbol || 'Select'}
                    </MenuButton>
                    <MenuList bg="#141414" borderColor="#2a2a2a" borderRadius="xl">
                      {availableTokens
                        .filter((t) => t.denom !== fromToken.denom)
                        .map((token) => (
                          <MenuItem
                            key={token.denom}
                            bg="transparent"
                            _hover={{ bg: 'whiteAlpha.100' }}
                            onClick={() => setToToken(token)}
                          >
                            <HStack justify="space-between" w="full">
                              <Text>{token.symbol}</Text>
                              <Text fontSize="xs" color="gray.500">
                                {getTokenBalance(token.denom).toFixed(4)}
                              </Text>
                            </HStack>
                          </MenuItem>
                        ))}
                    </MenuList>
                  </Menu>
                </HStack>
              </Box>

              {/* No Route Warning */}
              {!currentRoute && fromAmount && toToken && (
                <Box
                  p={3}
                  bg="rgba(239, 68, 68, 0.1)"
                  borderRadius="xl"
                  border="1px"
                  borderColor="red.500"
                >
                  <Text fontSize="xs" color="red.400">
                    No route available for {fromToken.symbol}/{toToken.symbol}
                  </Text>
                </Box>
              )}

              {/* Slippage Settings */}
              <Box>
                <Text fontSize="xs" color="gray.500" mb={2}>
                  Slippage Tolerance
                </Text>
                <HStack spacing={2}>
                  {[0.1, 0.5, 1.0, 3.0].map((s) => (
                    <Button
                      key={s}
                      size="xs"
                      variant={slippage === s ? 'solid' : 'outline'}
                      colorScheme={slippage === s ? 'cyan' : 'gray'}
                      borderColor="#3a3a3a"
                      onClick={() => setSlippage(s)}
                    >
                      {s}%
                    </Button>
                  ))}
                </HStack>
              </Box>

              {/* Swap Info */}
              {fromAmount && toAmount && currentRoute && toToken && (
                <Box p={3} bg="#141414" borderRadius="xl">
                  <VStack spacing={2} align="stretch" fontSize="xs">
                    {/* Route Visualization - show for all routes */}
                    <HStack justify="space-between">
                      <Text color="gray.500">Route ({hopCount} {hopCount === 1 ? 'hop' : 'hops'})</Text>
                      <Text fontSize="2xs" color="cyan.400">
                        {routePath}
                      </Text>
                    </HStack>
                    <HStack justify="space-between">
                      <Text color="gray.500">Rate</Text>
                      <Text>
                        1 {fromToken.symbol} ≈{' '}
                        {(parseFloat(toAmount) / parseFloat(fromAmount)).toFixed(6)}{' '}
                        {toToken.symbol}
                      </Text>
                    </HStack>
                    <HStack justify="space-between">
                      <Text color="gray.500">Price Impact</Text>
                      <Text color={priceImpact > 1 ? 'orange.400' : 'green.400'}>
                        {priceImpact.toFixed(2)}%
                      </Text>
                    </HStack>
                    <HStack justify="space-between">
                      <Text color="gray.500">Total Fees</Text>
                      <Text>{totalFee.toFixed(2)}%</Text>
                    </HStack>
                    <HStack justify="space-between">
                      <Text color="gray.500">Min. Received</Text>
                      <Text>
                        {toAmount} {toToken.symbol}
                      </Text>
                    </HStack>
                  </VStack>
                </Box>
              )}
            </VStack>
          ) : toToken ? (
            <VStack spacing={4} align="stretch">
              {/* Confirmation Summary */}
              <Box p={4} bg="#141414" borderRadius="xl">
                <VStack spacing={4}>
                  <VStack spacing={1}>
                    <Text fontSize="sm" color="gray.500">
                      You're swapping
                    </Text>
                    <Text fontSize="2xl" fontWeight="bold" color="cyan.400">
                      {fromAmount} {fromToken.symbol}
                    </Text>
                  </VStack>

                  <Text color="gray.500">↓</Text>

                  <VStack spacing={1}>
                    <Text fontSize="sm" color="gray.500">
                      You'll receive (min.)
                    </Text>
                    <Text fontSize="2xl" fontWeight="bold" color="green.400">
                      {toAmount} {toToken.symbol}
                    </Text>
                  </VStack>
                </VStack>
              </Box>

              <Box p={3} bg="#141414" borderRadius="xl">
                <VStack spacing={2} align="stretch" fontSize="xs">
                  {/* Route Visualization in confirmation - show for all routes */}
                  <HStack justify="space-between">
                    <Text color="gray.500">Route ({hopCount} {hopCount === 1 ? 'hop' : 'hops'})</Text>
                    <Text fontSize="2xs" color="cyan.400">
                      {routePath}
                    </Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text color="gray.500">Rate</Text>
                    <Text>
                      1 {fromToken.symbol} ≈{' '}
                      {(parseFloat(toAmount) / parseFloat(fromAmount)).toFixed(6)} {toToken.symbol}
                    </Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text color="gray.500">Slippage</Text>
                    <Text>{slippage}%</Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text color="gray.500">Total Fees</Text>
                    <Text>{totalFee.toFixed(2)}%</Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text color="gray.500">Price Impact</Text>
                    <Text color={priceImpact > 1 ? 'orange.400' : 'green.400'}>
                      {priceImpact.toFixed(2)}%
                    </Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text color="gray.500">Network Fee</Text>
                    <Text>{txFee?.formatted || '~0.0025 BZE'}</Text>
                  </HStack>
                </VStack>
              </Box>

              <Text fontSize="xs" color="gray.600" textAlign="center">
                Output is estimated. You will receive at least {toAmount} {toToken.symbol} or the
                transaction will revert.
              </Text>
            </VStack>
          ) : null}
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
                bg="cyan.500"
                color="white"
                _hover={{ bg: 'cyan.600' }}
                flex={1}
                borderRadius="xl"
                onClick={handleContinue}
                isDisabled={!fromAmount || !toAmount || fetchingQuote || !pool}
              >
                Review Swap
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
                bg="cyan.500"
                color="white"
                _hover={{ bg: 'cyan.600' }}
                flex={1}
                borderRadius="xl"
                onClick={handleSwap}
                isLoading={loading}
                loadingText="Swapping..."
              >
                Confirm Swap
              </Button>
            </HStack>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default SwapModal;
