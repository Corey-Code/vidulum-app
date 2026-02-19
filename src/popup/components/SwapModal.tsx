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
  FormControl,
  FormLabel,
} from '@chakra-ui/react';
import { ChevronDownIcon, RepeatIcon } from '@chakra-ui/icons';
import { useWalletStore } from '@/store/walletStore';
import { useChainStore } from '@/store/chainStore';
import { ChainInfo } from '@/types/wallet';
import { fetchChainAssets } from '@/lib/assets/chainRegistry';
import { estimateSwapFee, FeeEstimate, simulateTransaction } from '@/lib/cosmos/fees';
import { findBestRoute, SwapRoute, LiquidityPool as RouterPool } from '@/lib/cosmos/swap-router';
import { fetchOsmosisPools } from '@/lib/cosmos/osmosis-pools';
import { cosmosClient } from '@/lib/cosmos/client';
import { networkRegistry } from '@/lib/networks';
import { toBase64, fromBase64 } from '@cosmjs/encoding';
import { TxRaw, AuthInfo, TxBody, SignerInfo, Fee } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { SignMode } from 'cosmjs-types/cosmos/tx/signing/v1beta1/signing';
import { Any } from 'cosmjs-types/google/protobuf/any';
import { PubKey } from 'cosmjs-types/cosmos/crypto/secp256k1/keys';
import type { OfflineSigner } from '@cosmjs/proto-signing';

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
  const {
    selectedAccount,
    getAddressForChain,
    updateActivity,
    keyring,
    signAndBroadcast,
    signAndBroadcastWithPassword,
    hasMnemonicInMemory,
  } = useWalletStore();
  const { getBalance, fetchBalance } = useChainStore();

  const [availableTokens, setAvailableTokens] = useState<TokenInfo[]>(defaultBzeTokens);
  const [filteredAvailableTokens, setFilteredAvailableTokens] =
    useState<TokenInfo[]>(availableTokens);
  const [availableFromTokens, setAvailableFromTokens] = useState<TokenInfo[]>(defaultBzeTokens);
  const [fromToken, setFromToken] = useState<TokenInfo>(defaultBzeTokens[0]);
  const [toToken, setToToken] = useState<TokenInfo | null>(null);
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [slippage, setSlippage] = useState(0.1);
  const [loading, setLoading] = useState(false);
  const [fetchingQuote, setFetchingQuote] = useState(false);
  const [step, setStep] = useState<'input' | 'confirm' | 'password'>('input');
  const [password, setPassword] = useState('');
  const [pools, setPools] = useState<LiquidityPool[]>([]);
  const [loadingPools, setLoadingPools] = useState(false);
  const [txFee, setTxFee] = useState<FeeEstimate | null>(null);
  const [tradeFee, setTradeFee] = useState<FeeEstimate | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<SwapRoute | null>(null);

  const toast = useToast();

  const addressPrefix = chainConfig?.bech32Config.bech32PrefixAccAddr || 'bze';
  const chainAddress = getAddressForChain(addressPrefix) || '';
  const balance = chainAddress ? getBalance(chainId, chainAddress) : undefined;

  // Fetch liquidity pools, tokens, and fees on mount
  const fetchPoolsAndTokens = useCallback(
    async (signal: AbortSignal) => {
      setLoadingPools(true);
      try {
        let fetchedPools: LiquidityPool[] = [];

        if (chainId === 'beezee-1') {
          const poolResponse = await fetch(
            'https://rest.getbze.com/bze/tradebin/all_liquidity_pools',
            { signal }
          );
          const poolData = await poolResponse.json();
          fetchedPools = poolData.list || [];
        } else if (chainId === 'osmosis-1' && chainConfig?.rest) {
          fetchedPools = await fetchOsmosisPools(chainConfig.rest);
        }

        if (signal.aborted) return;

        setPools(fetchedPools);

        // Get all denoms that have pools
        const poolDenoms = new Set<string>();
        fetchedPools.forEach((pool) => {
          poolDenoms.add(pool.base);
          poolDenoms.add(pool.quote);
        });

        // Get all denoms with a balance on beezee-1 or osmosis-1
        const chainBalances = await fetchBalance(chainId, chainAddress);

        if (signal.aborted) return;

        const chainBalancesDenoms = new Set<string>();
        chainBalances.forEach((balance) => {
          chainBalancesDenoms.add(balance.denom);
        });

        // Fetch assets from chain registry
        const registryAssets = await fetchChainAssets(chainId);

        if (signal.aborted) return;

        // Filter to only tokens with pools
        const tokensWithPools: TokenInfo[] = registryAssets
          .filter((asset) => poolDenoms.has(asset.denom))
          .map((asset) => ({
            symbol: asset.symbol,
            name: asset.name,
            decimals: asset.decimals,
            denom: asset.denom,
          }));

        // Filter to only tokens with a balance on the chain
        const tokensWithPoolsAndBalance = tokensWithPools.filter((token) =>
          chainBalancesDenoms.has(token.denom)
        );

        if (tokensWithPools.length > 0) {
          setAvailableFromTokens(
            tokensWithPoolsAndBalance.length > 0 ? tokensWithPoolsAndBalance : tokensWithPools
          );
          setAvailableTokens(tokensWithPools);
          setFilteredAvailableTokens(tokensWithPools);
          setFromToken(tokensWithPools[0]);
          setToToken(tokensWithPools.length > 1 ? tokensWithPools[1] : null);
        }

        // Fetch BeeZee tradebin taker fee metadata.
        // Network fee is simulated dynamically once quote/route is available.
        if (chainId === 'beezee-1' && chainConfig?.rest) {
          const fees = await estimateSwapFee(chainConfig.rest, 250000);
          if (!signal.aborted) {
            setTradeFee(fees.tradeFee);
            setTxFee(null);
          }
        } else if (chainId === 'osmosis-1' && chainConfig) {
          // Keep empty until simulation fills the estimate.
          setTxFee(null);
          setTradeFee(null);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error('Failed to fetch pools/tokens:', error);
      } finally {
        if (!signal.aborted) {
          setLoadingPools(false);
        }
      }
    },
    [chainId, chainConfig, chainAddress, fetchBalance]
  );

  useEffect(() => {
    if (!isOpen || (chainId !== 'beezee-1' && chainId !== 'osmosis-1')) return;

    const controller = new AbortController();
    fetchPoolsAndTokens(controller.signal);

    return () => {
      controller.abort();
    };
  }, [isOpen, chainId, fetchPoolsAndTokens]);

  // Get balance for a specific token
  const getTokenBalance = (denom: string): number => {
    if (!balance) return 0;
    const tokenBalance = balance.find((b) => b.denom === denom);
    if (!tokenBalance) return 0;
    const token = availableTokens.find((t) => t.denom === denom);
    return parseInt(tokenBalance.amount) / Math.pow(10, token?.decimals || 6);
  };

  const fromBalance = fromToken ? getTokenBalance(fromToken.denom) : 0;
  const toBalance = toToken ? getTokenBalance(toToken.denom) : 0;

  // Find the best route (supports multi-hop)
  const findRoute = useCallback(
    (inputAmount: bigint): SwapRoute | null => {
      if (!fromToken || !toToken || pools.length === 0) return null;

      // Cast to RouterPool type (same structure)
      const routerPools = pools as RouterPool[];
      // Osmosis routes can include stale/illiquid multi-hop paths from legacy pools
      // that produce unrealistic quotes and inflated price impact. Prefer direct
      // routing on Osmosis for stable/accurate UX.
      const maxHops = chainId === 'osmosis-1' ? 1 : 3;
      return findBestRoute(routerPools, fromToken.denom, toToken.denom, inputAmount, maxHops);
    },
    [pools, fromToken, toToken, chainId]
  );

  // Get token symbol from denom
  const getSymbolForDenom = useCallback(
    (denom: string): string => {
      const token = availableTokens.find((t) => t.denom === denom);
      return token?.symbol || denom;
    },
    [availableTokens]
  );

  // Calculate swap quote using multi-hop router
  useEffect(() => {
    if (!fromAmount || parseFloat(fromAmount) <= 0 || !fromToken || !toToken) {
      setToAmount('');
      setSelectedRoute(null);
      return;
    }

    const currentFromToken = fromToken;
    const calculateQuote = async () => {
      setFetchingQuote(true);
      try {
        const inputAmountRaw = BigInt(
          Math.floor(parseFloat(fromAmount) * Math.pow(10, currentFromToken.decimals))
        );

        // Use multi-hop router to find best route
        const route = findRoute(inputAmountRaw);

        if (!route || !toToken) {
          setToAmount('');
          setSelectedRoute(null);
          return;
        }

        setSelectedRoute(route);

        // Apply slippage tolerance to the estimated output
        const outputWithSlippage =
          (route.estimatedOutput * BigInt(Math.floor((100 - slippage) * 100))) / 10000n;

        // Format outputWithSlippage as a decimal string with 6 fractional digits
        const scale = 10n ** BigInt(toToken.decimals);
        // Round to 6 decimal places: multiply by 1e6, add half scale, then divide
        const scaled = (outputWithSlippage * 1_000_000n + scale / 2n) / scale;
        const scaledStr = scaled.toString();
        let humanReadable: string;
        if (scaledStr.length <= 6) {
          const fractional = scaledStr.padStart(6, '0');
          humanReadable = `0.${fractional}`;
        } else {
          const integerPart = scaledStr.slice(0, -6);
          const fractionalPart = scaledStr.slice(-6);
          humanReadable = `${integerPart}.${fractionalPart}`;
        }

        setToAmount(humanReadable);
      } catch (error) {
        console.error('Failed to get quote:', error);
        setToAmount('');
        setSelectedRoute(null);
      } finally {
        setFetchingQuote(false);
      }
    };

    const debounce = setTimeout(calculateQuote, 300);
    return () => clearTimeout(debounce);
  }, [fromAmount, fromToken, toToken, slippage, findRoute]);

  // Dynamically simulate Osmosis swap fee for current quote.
  useEffect(() => {
    if (
      chainId !== 'osmosis-1' ||
      !chainConfig?.rpc ||
      !selectedRoute ||
      !fromToken ||
      !toToken ||
      !fromAmount ||
      parseFloat(fromAmount) <= 0 ||
      !selectedAccount?.pubKey ||
      !chainAddress
    ) {
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const inputAmountRaw = Math.floor(parseFloat(fromAmount) * Math.pow(10, fromToken.decimals));
        if (inputAmountRaw <= 0) return;

        const routes = selectedRoute.pools.map((poolId, i) => ({
          pool_id: parseInt(poolId, 10),
          token_out_denom: selectedRoute.path[i + 1],
        }));
        const msg = {
          typeUrl: '/osmosis.poolmanager.v1beta1.MsgSwapExactAmountIn',
          value: {
            sender: chainAddress,
            routes,
            token_in: { denom: fromToken.denom, amount: inputAmountRaw.toString() },
            // For fee simulation only, keep min output permissive so route pricing
            // changes don't make simulation fail with "lesser than min amount".
            token_out_min_amount: '1',
          },
        };

        // Build a lightweight signer from the selected account only.
        // simulate() needs account metadata, but does not require private keys.
        const simulationSigner: OfflineSigner = {
          getAccounts: async () => [
            {
              address: chainAddress,
              algo: 'secp256k1',
              pubkey: selectedAccount.pubKey,
            },
          ],
        };
        const rpcEndpoints = networkRegistry.getCosmos(chainId)?.rpc || [chainConfig.rpc];
        const { client: signingClient } = await cosmosClient.getSigningClientWithFailover(
          rpcEndpoints,
          simulationSigner
        );
        const signerAddress = chainAddress;
        const simulatedGas = await signingClient.simulate(signerAddress, [msg], '');
        const gasLimit = Math.max(Math.ceil(simulatedGas * 1.3), 120000);
        const gasPrice = parseFloat(networkRegistry.getCosmos(chainId)?.gasPrice || '0.025');
        const feeDenom = chainConfig.feeCurrencies?.[0]?.coinMinimalDenom || 'uosmo';
        const feeAmount = Math.max(1, Math.ceil(gasLimit * gasPrice));
        const symbol = chainConfig.feeCurrencies?.[0]?.coinDenom || 'OSMO';

        if (!cancelled) {
          setTxFee({
            amount: feeAmount.toString(),
            denom: feeDenom,
            formatted: `${(feeAmount / 1_000_000).toFixed(6)} ${symbol}`,
          });
        }
      } catch (error) {
        if (!cancelled) {
          // Osmosis often returns gas usage in simulation errors; recover it to
          // still provide an accurate fee estimate instead of "unavailable".
          const message = error instanceof Error ? error.message : String(error);
          const gasMatch = message.match(/gas used:\s*'(\d+)'/i);
          if (gasMatch) {
            const gasUsed = parseInt(gasMatch[1], 10);
            const gasLimit = Math.max(Math.ceil(gasUsed * 1.3), 120000);
            const gasPrice = parseFloat(networkRegistry.getCosmos(chainId)?.gasPrice || '0.025');
            const feeDenom = chainConfig.feeCurrencies?.[0]?.coinMinimalDenom || 'uosmo';
            const feeAmount = Math.max(1, Math.ceil(gasLimit * gasPrice));
            const symbol = chainConfig.feeCurrencies?.[0]?.coinDenom || 'OSMO';
            setTxFee({
              amount: feeAmount.toString(),
              denom: feeDenom,
              formatted: `${(feeAmount / 1_000_000).toFixed(6)} ${symbol}`,
            });
          } else {
            console.warn('Failed to simulate Osmosis swap fee:', error);
          }
        }
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    chainId,
    chainConfig,
    selectedRoute,
    fromToken,
    toToken,
    fromAmount,
    toAmount,
    selectedAccount,
    chainAddress,
  ]);

  // Dynamically simulate BeeZee swap fee for current quote.
  useEffect(() => {
    if (
      chainId !== 'beezee-1' ||
      !chainConfig?.rest ||
      !selectedRoute ||
      !fromToken ||
      !toToken ||
      !fromAmount ||
      parseFloat(fromAmount) <= 0 ||
      !selectedAccount?.pubKey
    ) {
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const inputAmountRaw = Math.floor(parseFloat(fromAmount) * Math.pow(10, fromToken.decimals));
        const minOutputAmountRaw = Math.floor(
          parseFloat(toAmount || '0') * Math.pow(10, toToken.decimals) * 0.95
        );
        if (inputAmountRaw <= 0) return;

        const msgBytes = encodeMsgMultiSwap(
          chainAddress,
          selectedRoute.pools,
          fromToken.denom,
          inputAmountRaw.toString(),
          toToken.denom,
          Math.max(minOutputAmountRaw, 1).toString()
        );
        const msgAny: Any = {
          typeUrl: '/bze.tradebin.MsgMultiSwap',
          value: msgBytes,
        };

        const simTxBody = TxBody.fromPartial({
          messages: [msgAny],
          memo: '',
        });
        const simAuthInfo = AuthInfo.fromPartial({
          signerInfos: [
            SignerInfo.fromPartial({
              publicKey: {
                typeUrl: '/cosmos.crypto.secp256k1.PubKey',
                value: PubKey.encode(PubKey.fromPartial({ key: selectedAccount.pubKey })).finish(),
              },
              modeInfo: { single: { mode: SignMode.SIGN_MODE_LEGACY_AMINO_JSON } },
              sequence: BigInt(0),
            }),
          ],
          fee: Fee.fromPartial({
            amount: [],
            gasLimit: BigInt(0),
          }),
        });

        const simResult = await simulateTransaction(
          chainConfig.rest,
          TxBody.encode(simTxBody).finish(),
          AuthInfo.encode(simAuthInfo).finish()
        );
        const gasLimit = Math.max(Math.ceil(simResult.gasUsed * 1.3), 150000);
        const gasPrice = parseFloat(networkRegistry.getCosmos(chainId)?.gasPrice || '0.025');
        const feeDenom = chainConfig.feeCurrencies?.[0]?.coinMinimalDenom || 'ubze';
        const symbol = chainConfig.feeCurrencies?.[0]?.coinDenom || 'BZE';
        const feeAmount = Math.max(1, Math.ceil(gasLimit * gasPrice));

        if (!cancelled) {
          setTxFee({
            amount: feeAmount.toString(),
            denom: feeDenom,
            formatted: `${(feeAmount / 1_000_000).toFixed(6)} ${symbol}`,
          });
        }
      } catch (error) {
        if (!cancelled) {
          console.warn('Failed to simulate BeeZee swap fee:', error);
        }
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    chainId,
    chainConfig,
    selectedRoute,
    fromToken,
    toToken,
    fromAmount,
    toAmount,
    selectedAccount,
    chainAddress,
  ]);

  // Swap token positions
  const handleSwapTokens = () => {
    if (!toToken) return;
    const tempToken = fromToken;
    setFromToken(toToken);
    setToToken(tempToken);
    setFromAmount(toAmount);
    setToAmount(fromAmount);
  };

  // Set max amount (reserve native token for tx fee)
  const handleMaxAmount = () => {
    if (!fromToken) return;
    const feeDenom = chainConfig?.feeCurrencies?.[0]?.coinMinimalDenom;
    const reserve = fromToken.denom === feeDenom ? (chainId === 'osmosis-1' ? 0.03 : 0.01) : 0;
    const maxAmount = Math.max(0, fromBalance - reserve);
    setFromAmount(maxAmount.toFixed(6));
  };

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFromAmount('');
      setToAmount('');
      setStep('input');
      setPassword('');
      setSelectedRoute(null);
      setPools([]);
      setAvailableTokens(defaultBzeTokens);
      setAvailableFromTokens(defaultBzeTokens);
      setFilteredAvailableTokens(defaultBzeTokens);
      setFromToken(defaultBzeTokens[0]);
      setToToken(null);
      setTxFee(null);
      setTradeFee(null);
      setLoadingPools(false);
    }
  }, [isOpen]);

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

    if (!selectedRoute) {
      toast({ title: 'No swap route available', status: 'error', duration: 2000 });
      return;
    }

    setStep('confirm');
    updateActivity();
  };

  const filterAvailableTokens = (search: string) => {
    setFilteredAvailableTokens(
      availableTokens.filter((t) => t.symbol.toLowerCase().includes(search.toLowerCase()))
    );
  };

  const handleSwap = async (passwordForSigning?: string) => {
    if (!chainAddress || !toToken) {
      toast({
        title: 'Wallet not connected or tokens not selected',
        status: 'error',
        duration: 2000,
      });
      return;
    }

    if (!selectedRoute) {
      toast({ title: 'No swap route available', status: 'error', duration: 2000 });
      return;
    }

    // Osmosis with imported account or when mnemonic not in memory: require password
    const isImportedAccount = selectedAccount?.id?.startsWith('imported-');
    const needsPassword =
      chainId === 'osmosis-1' &&
      (isImportedAccount || !hasMnemonicInMemory()) &&
      !passwordForSigning;

    if (needsPassword) {
      setStep('password');
      return;
    }

    setLoading(true);
    try {
      const inputAmountRaw = Math.floor(parseFloat(fromAmount) * Math.pow(10, fromToken.decimals));
      const minOutputAmountRaw = Math.floor(
        parseFloat(toAmount) * Math.pow(10, toToken.decimals) * 0.95
      );

      if (chainId === 'osmosis-1' && (signAndBroadcast || signAndBroadcastWithPassword)) {
        // Osmosis: MsgSwapExactAmountIn via signAndBroadcast
        const routes = selectedRoute.pools.map((poolId, i) => ({
          pool_id: parseInt(poolId, 10),
          token_out_denom: selectedRoute.path[i + 1],
        }));

        const msg = {
          typeUrl: '/osmosis.poolmanager.v1beta1.MsgSwapExactAmountIn',
          value: {
            sender: chainAddress,
            routes,
            token_in: { denom: fromToken.denom, amount: inputAmountRaw.toString() },
            token_out_min_amount: minOutputAmountRaw.toString(),
          },
        };

        let txHash: string;
        if (passwordForSigning && signAndBroadcastWithPassword) {
          txHash = await signAndBroadcastWithPassword(chainId, [msg], passwordForSigning);
        } else if (signAndBroadcast) {
          txHash = await signAndBroadcast(chainId, [msg], undefined, '');
        } else {
          throw new Error('Signing not available');
        }

        toast({
          title: 'Swap successful!',
          description: `Swapped ${fromAmount} ${fromToken.symbol} for ~${toAmount} ${toToken.symbol}`,
          status: 'success',
          duration: 5000,
        });
        onSwapSuccess?.(fromToken.denom, toToken.denom);
        onSuccess?.();
        onClose();
        return;
      }

      // BeeZee: MsgMultiSwap (manual Amino signing + broadcast)
      if (!keyring) {
        toast({ title: 'Wallet not ready', status: 'error', duration: 2000 });
        return;
      }

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

      // Build the Amino message for MsgMultiSwap (correct format from proto)
      // Use the route's pools array for multi-hop support
      const aminoMsg = {
        type: 'bze/x/tradebin/MsgMultiSwap',
        value: {
          creator: chainAddress,
          routes: selectedRoute.pools,
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

      // Pre-encode MsgMultiSwap for both simulation and final TxRaw.
      const msgBytes = encodeMsgMultiSwap(
        chainAddress,
        selectedRoute.pools,
        fromToken.denom,
        inputAmountRaw.toString(),
        toToken.denom,
        minOutputAmountRaw.toString()
      );
      const msgAny: Any = {
        typeUrl: '/bze.tradebin.MsgMultiSwap',
        value: msgBytes,
      };

      const feeDenom = chainConfig?.feeCurrencies?.[0]?.coinMinimalDenom || 'ubze';
      const gasPrice = parseFloat(networkRegistry.getCosmos(chainId)?.gasPrice || '0.025');
      let gasLimit = 400000;
      let feeAmount = Math.max(1, Math.ceil(gasLimit * gasPrice));
      if (selectedAccount?.pubKey && chainConfig?.rest) {
        try {
          const simTxBody = TxBody.fromPartial({
            messages: [msgAny],
            memo: '',
          });
          const simAuthInfo = AuthInfo.fromPartial({
            signerInfos: [
              SignerInfo.fromPartial({
                publicKey: {
                  typeUrl: '/cosmos.crypto.secp256k1.PubKey',
                  value: PubKey.encode(PubKey.fromPartial({ key: selectedAccount.pubKey })).finish(),
                },
                modeInfo: { single: { mode: SignMode.SIGN_MODE_LEGACY_AMINO_JSON } },
                sequence: BigInt(sequence),
              }),
            ],
            fee: Fee.fromPartial({
              amount: [],
              gasLimit: BigInt(0),
            }),
          });
          const simResult = await simulateTransaction(
            chainConfig.rest,
            TxBody.encode(simTxBody).finish(),
            AuthInfo.encode(simAuthInfo).finish()
          );
          gasLimit = Math.max(Math.ceil(simResult.gasUsed * 1.3), 150000);
          feeAmount = Math.max(1, Math.ceil(gasLimit * gasPrice));
        } catch (error) {
          console.warn('BeeZee swap fee simulation failed, using fallback fee:', error);
        }
      }

      // Build sign doc for Amino signing
      const signDoc = {
        chain_id: 'beezee-1',
        account_number: accountNumber,
        sequence: sequence,
        fee: {
          amount: [{ denom: feeDenom, amount: feeAmount.toString() }],
          gas: gasLimit.toString(),
        },
        msgs: [aminoMsg],
        memo: '',
      };

      // Sign using Amino
      const signResponse = await keyring.signAmino(chainAddress, signDoc);

      // Get the public key from the sign response
      const pubKey = signResponse.signature.pub_key;

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
        amount: [{ denom: feeDenom, amount: feeAmount.toString() }],
        gasLimit: BigInt(gasLimit),
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

  // Price impact and fees are now calculated by the swap router
  // and available in selectedRoute.priceImpact and selectedRoute.totalFee
  const networkFeeDisplay = txFee?.formatted || (fetchingQuote ? 'Estimating...' : 'Estimate unavailable');
  const totalFeeDisplay =
    chainId === 'beezee-1'
      ? txFee && tradeFee
        ? `${((parseInt(txFee.amount) + parseInt(tradeFee.amount)) / 1_000_000).toFixed(6)} BZE`
        : tradeFee
          ? `${tradeFee.formatted} + network fee`
          : networkFeeDisplay
      : networkFeeDisplay;

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
                    <MenuList
                      bg="#141414"
                      borderColor="#2a2a2a"
                      borderRadius="xl"
                      maxH="200px"
                      overflowY="auto"
                    >
                      {availableFromTokens
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
                    <MenuList
                      bg="#141414"
                      borderColor="#2a2a2a"
                      borderRadius="xl"
                      maxH="200px"
                      overflowY="auto"
                    >
                      {/* Searchable menu list */}
                      <MenuItem bg="transparent" _hover={{ bg: 'whiteAlpha.100' }}>
                        <HStack justify="space-between" w="full">
                          <Input
                            onClick={(e) => e.stopPropagation()}
                            type="text"
                            placeholder="Search"
                            onChange={(e) => filterAvailableTokens(e.target.value)}
                          />
                        </HStack>
                      </MenuItem>

                      {filteredAvailableTokens
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
              {!selectedRoute && fromAmount && toToken && !fetchingQuote && (
                <Box
                  p={3}
                  bg="rgba(239, 68, 68, 0.1)"
                  borderRadius="xl"
                  border="1px"
                  borderColor="red.500"
                >
                  <Text fontSize="xs" color="red.400">
                    No swap route available for {fromToken.symbol} → {toToken.symbol}
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
              {fromAmount && toAmount && selectedRoute && toToken && (
                <Box p={3} bg="#141414" borderRadius="xl">
                  <VStack spacing={2} align="stretch" fontSize="xs">
                    {/* Route visualization for multi-hop */}
                    {selectedRoute.hops > 1 && (
                      <>
                        <HStack justify="space-between">
                          <Text color="gray.500">Route</Text>
                          <HStack spacing={1}>
                            {selectedRoute.path.map((denom, idx) => (
                              <React.Fragment key={denom}>
                                <Text color="cyan.400" fontWeight="medium">
                                  {getSymbolForDenom(denom)}
                                </Text>
                                {idx < selectedRoute.path.length - 1 && (
                                  <Text color="gray.600">→</Text>
                                )}
                              </React.Fragment>
                            ))}
                          </HStack>
                        </HStack>
                        <HStack justify="space-between">
                          <Text color="gray.500">Hops</Text>
                          <Text>{selectedRoute.hops}</Text>
                        </HStack>
                      </>
                    )}
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
                      <Text color={selectedRoute.priceImpact > 1 ? 'orange.400' : 'green.400'}>
                        {selectedRoute.priceImpact.toFixed(2)}%
                      </Text>
                    </HStack>
                    <HStack justify="space-between">
                      <Text color="gray.500">Pool Fee</Text>
                      <Text>{(selectedRoute.totalFee * 100).toFixed(2)}%</Text>
                    </HStack>
                    <HStack justify="space-between">
                      <Text color="gray.500">Min. Received</Text>
                      <Text>
                        {toAmount} {toToken.symbol}
                      </Text>
                    </HStack>
                    <Box h="1px" bg="#2a2a2a" my={1} />
                    <HStack justify="space-between">
                      <Text color="gray.500">Network Fee</Text>
                      <Text>{networkFeeDisplay}</Text>
                    </HStack>
                    {chainId === 'beezee-1' && (
                      <HStack justify="space-between">
                        <Text color="gray.500">Taker Fee</Text>
                        <Text>{tradeFee?.formatted || '0.1 BZE'}</Text>
                      </HStack>
                    )}
                    <HStack justify="space-between">
                      <Text color="gray.500" fontWeight="medium">
                        Total Fees
                      </Text>
                      <Text fontWeight="medium">{totalFeeDisplay}</Text>
                    </HStack>
                  </VStack>
                </Box>
              )}
            </VStack>
          ) : step === 'password' ? (
            <VStack spacing={4} align="stretch">
              <Text color="gray.400" fontSize="sm">
                Enter your password to sign this swap
              </Text>

              <Box
                bg="rgba(0, 230, 230, 0.1)"
                borderRadius="lg"
                p={3}
                border="1px solid"
                borderColor="cyan.800"
              >
                <Text color="cyan.300" fontSize="sm">
                  🔐 Your password is required to sign transactions on Osmosis
                </Text>
              </Box>

              <FormControl>
                <FormLabel color="gray.400" fontSize="sm">
                  Password
                </FormLabel>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your wallet password"
                  bg="#0a0a0a"
                  borderColor="#3a3a3a"
                  color="white"
                  _hover={{ borderColor: '#4a4a4a' }}
                  _focus={{ borderColor: 'cyan.500', boxShadow: 'none' }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && password) {
                      handleSwap(password);
                    }
                  }}
                />
              </FormControl>

              <Box bg="#141414" borderRadius="lg" p={3}>
                <VStack spacing={2} align="stretch">
                  <HStack justify="space-between">
                    <Text color="gray.500" fontSize="sm">
                      Swapping
                    </Text>
                    <Text color="white" fontSize="sm" fontWeight="medium">
                      {fromAmount} {fromToken.symbol} → ~{toAmount} {toToken?.symbol}
                    </Text>
                  </HStack>
                </VStack>
              </Box>
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
                  {/* Route visualization for multi-hop */}
                  {selectedRoute && selectedRoute.hops > 1 && (
                    <HStack justify="space-between">
                      <Text color="gray.500">Route ({selectedRoute.hops} hops)</Text>
                      <HStack spacing={1}>
                        {selectedRoute.path.map((denom, idx) => (
                          <React.Fragment key={denom}>
                            <Text color="cyan.400" fontWeight="medium">
                              {getSymbolForDenom(denom)}
                            </Text>
                            {idx < selectedRoute.path.length - 1 && <Text color="gray.600">→</Text>}
                          </React.Fragment>
                        ))}
                      </HStack>
                    </HStack>
                  )}
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
                    <Text color="gray.500">Pool Fee</Text>
                    <Text>
                      {selectedRoute ? (selectedRoute.totalFee * 100).toFixed(2) : '0.00'}%
                    </Text>
                  </HStack>
                  <Box h="1px" bg="#2a2a2a" my={1} />
                  <HStack justify="space-between">
                    <Text color="gray.500">Network Fee</Text>
                    <Text>{networkFeeDisplay}</Text>
                  </HStack>
                  {chainId === 'beezee-1' && (
                    <HStack justify="space-between">
                      <Text color="gray.500">Taker Fee</Text>
                      <Text>{tradeFee?.formatted || '0.1 BZE'}</Text>
                    </HStack>
                  )}
                  <HStack justify="space-between">
                    <Text color="gray.500" fontWeight="medium">
                      Total Fees
                    </Text>
                    <Text fontWeight="medium" color="orange.300">{totalFeeDisplay}</Text>
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
                isDisabled={!fromAmount || !toAmount || fetchingQuote || !selectedRoute}
              >
                Review Swap
              </Button>
            </HStack>
          ) : step === 'password' ? (
            <HStack spacing={3} w="full">
              <Button
                variant="ghost"
                flex={1}
                onClick={() => setStep('confirm')}
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
                onClick={() => handleSwap(password)}
                isLoading={loading}
                loadingText="Swapping..."
                isDisabled={!password}
              >
                Confirm Swap
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
                onClick={() => handleSwap()}
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
