import React, { useEffect, useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  IconButton,
  Input,
  Spinner,
  Divider,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  useToast,
  Badge,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Tooltip,
} from '@chakra-ui/react';
import { ArrowBackIcon, RepeatIcon } from '@chakra-ui/icons';
import { useWalletStore } from '@/store/walletStore';
import { SUPPORTED_CHAINS } from '@/lib/cosmos/chains';
import {
  fetchValidators,
  fetchDelegations,
  fetchRewards,
  fetchUnbondingDelegations,
  Validator,
  Delegation,
  UnbondingDelegation,
  formatCommission,
  formatVotingPower,
} from '@/lib/cosmos/staking';

// Fetch REStake compatible validators from restake.app registry
async function fetchRestakeValidators(chainName: string): Promise<Set<string>> {
  try {
    // REStake uses chain name in lowercase (e.g., "beezee", "osmosis")
    const response = await fetch(`https://restake.app/api/${chainName}/operators`);
    if (response.ok) {
      const data = await response.json();
      // The API returns an array of operators with their validator addresses
      const validators = new Set<string>();
      if (Array.isArray(data)) {
        data.forEach((op: any) => {
          if (op.address) {
            validators.add(op.address);
          }
        });
      }
      return validators;
    }
  } catch (e) {
    console.warn('Failed to fetch REStake validators:', e);
  }
  return new Set();
}

// Map chain IDs to REStake chain names
function getRestakeChainName(chainId: string): string {
  const mapping: Record<string, string> = {
    'beezee-1': 'beezee',
    'osmosis-1': 'osmosis',
    'atomone-1': 'atomone',
    'cosmoshub-4': 'cosmoshub',
  };
  return mapping[chainId] || chainId.split('-')[0];
}

// Fetch chain inflation/staking APR
async function fetchChainAPR(restEndpoint: string): Promise<number> {
  try {
    // Try to fetch inflation rate
    const inflationRes = await fetch(`${restEndpoint}/cosmos/mint/v1beta1/inflation`);
    if (inflationRes.ok) {
      const inflationData = await inflationRes.json();
      const inflation = parseFloat(inflationData.inflation || '0');
      // Base APR is inflation rate (assuming 100% bonded, actual is higher)
      return inflation * 100;
    }
  } catch (e) {
    console.warn('Failed to fetch inflation:', e);
  }

  try {
    // Fallback: try annual provisions / bonded tokens
    const [provisionsRes, poolRes] = await Promise.all([
      fetch(`${restEndpoint}/cosmos/mint/v1beta1/annual_provisions`),
      fetch(`${restEndpoint}/cosmos/staking/v1beta1/pool`),
    ]);

    if (provisionsRes.ok && poolRes.ok) {
      const provisionsData = await provisionsRes.json();
      const poolData = await poolRes.json();
      const provisions = parseFloat(provisionsData.annual_provisions || '0');
      const bondedTokens = parseFloat(poolData.pool?.bonded_tokens || '1');
      return (provisions / bondedTokens) * 100;
    }
  } catch (e) {
    console.warn('Failed to fetch provisions/pool:', e);
  }

  // Default APR estimate if we can't fetch
  return 10; // 10% default
}

// Calculate validator APR based on base APR and commission
function calculateValidatorAPR(baseAPR: number, commissionRate: string): number {
  const commission = parseFloat(commissionRate);
  return baseAPR * (1 - commission);
}

interface StakingProps {
  onBack: () => void;
}

const Staking: React.FC<StakingProps> = ({ onBack }) => {
  const { selectedChainId, getAddressForChain, signAndBroadcast } = useWalletStore();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [validators, setValidators] = useState<Validator[]>([]);
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [rewards, setRewards] = useState<{ denom: string; amount: string }[]>([]);
  const [unbonding, setUnbonding] = useState<UnbondingDelegation[]>([]);
  const [availableBalance, setAvailableBalance] = useState('0');
  const [baseAPR, setBaseAPR] = useState<number>(10); // Default 10% APR
  const [restakeValidators, setRestakeValidators] = useState<Set<string>>(new Set());
  const [validatorPage, setValidatorPage] = useState(0); // Pagination for validators
  const VALIDATORS_PER_PAGE = 50;

  // Modal states
  const {
    isOpen: isDelegateOpen,
    onOpen: onDelegateOpen,
    onClose: onDelegateClose,
  } = useDisclosure();
  const [selectedValidator, setSelectedValidator] = useState<Validator | null>(null);
  const [delegateAmount, setDelegateAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionType, setActionType] = useState<'delegate' | 'undelegate' | 'redelegate'>(
    'delegate'
  );

  const chainConfig = SUPPORTED_CHAINS.get(selectedChainId);
  const chainAddress = getAddressForChain(chainConfig?.bech32Config.bech32PrefixAccAddr || 'bze');
  const stakeCurrency = chainConfig?.stakeCurrency;
  const decimals = stakeCurrency?.coinDecimals || 6;
  const symbol = stakeCurrency?.coinDenom || 'BZE';

  useEffect(() => {
    if (chainAddress && chainConfig) {
      loadStakingData();
    }
  }, [chainAddress, selectedChainId]);

  const loadStakingData = async () => {
    if (!chainConfig || !chainAddress) return;

    setLoading(true);
    try {
      const restakeChainName = getRestakeChainName(selectedChainId);
      const [
        validatorsData,
        delegationsData,
        rewardsData,
        unbondingData,
        balanceData,
        chainAPR,
        restakeOps,
      ] = await Promise.all([
        fetchValidators(chainConfig.rest),
        fetchDelegations(chainConfig.rest, chainAddress),
        fetchRewards(chainConfig.rest, chainAddress),
        fetchUnbondingDelegations(chainConfig.rest, chainAddress),
        fetchAvailableBalance(),
        fetchChainAPR(chainConfig.rest),
        fetchRestakeValidators(restakeChainName),
      ]);

      // Sort validators by voting power
      validatorsData.sort((a, b) => parseInt(b.tokens) - parseInt(a.tokens));
      setValidators(validatorsData);
      setDelegations(delegationsData);
      setRewards(rewardsData.total);
      setUnbonding(unbondingData);
      setAvailableBalance(balanceData);
      setBaseAPR(chainAPR);
      setRestakeValidators(restakeOps);
    } catch (error) {
      console.error('Failed to load staking data:', error);
      toast({
        title: 'Failed to load staking data',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableBalance = async (): Promise<string> => {
    if (!chainConfig || !chainAddress) return '0';

    try {
      const response = await fetch(
        `${chainConfig.rest}/cosmos/bank/v1beta1/balances/${chainAddress}`
      );
      const data = await response.json();
      const balance = data.balances?.find((b: any) => b.denom === stakeCurrency?.coinMinimalDenom);
      return balance?.amount || '0';
    } catch {
      return '0';
    }
  };

  const getTotalStaked = (): string => {
    const total = delegations.reduce((sum, d) => sum + parseInt(d.balance.amount), 0);
    return (total / Math.pow(10, decimals)).toFixed(6);
  };

  const getTotalRewards = (): string => {
    const stakeReward = rewards.find((r) => r.denom === stakeCurrency?.coinMinimalDenom);
    if (!stakeReward) return '0';
    return (parseFloat(stakeReward.amount) / Math.pow(10, decimals)).toFixed(6);
  };

  const getTotalUnbonding = (): string => {
    const total = unbonding.reduce((sum, u) => {
      return sum + u.entries.reduce((eSum, e) => eSum + parseInt(e.balance), 0);
    }, 0);
    return (total / Math.pow(10, decimals)).toFixed(6);
  };

  const getValidatorDelegation = (validatorAddress: string): string => {
    const delegation = delegations.find((d) => d.delegation.validatorAddress === validatorAddress);
    if (!delegation) return '0';
    return (parseInt(delegation.balance.amount) / Math.pow(10, decimals)).toFixed(6);
  };

  const handleDelegate = (validator: Validator) => {
    setSelectedValidator(validator);
    setActionType('delegate');
    setDelegateAmount('');
    onDelegateOpen();
  };

  const handleUndelegate = (validator: Validator) => {
    setSelectedValidator(validator);
    setActionType('undelegate');
    setDelegateAmount('');
    onDelegateOpen();
  };

  const handleMaxAmount = () => {
    if (actionType === 'delegate') {
      // Leave some for fees
      const available = parseInt(availableBalance);
      const feeBuffer = 50000; // 0.05 tokens for fees
      const maxAmount = Math.max(0, available - feeBuffer);
      setDelegateAmount((maxAmount / Math.pow(10, decimals)).toString());
    } else if (actionType === 'undelegate' && selectedValidator) {
      const delegated = getValidatorDelegation(selectedValidator.operatorAddress);
      setDelegateAmount(delegated);
    }
  };

  const handleSubmitDelegation = async () => {
    if (!selectedValidator || !chainConfig || !chainAddress) return;

    const amountNum = parseFloat(delegateAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast({ title: 'Invalid amount', status: 'error', duration: 2000 });
      return;
    }

    setIsSubmitting(true);
    try {
      const amountInMinimal = Math.floor(amountNum * Math.pow(10, decimals)).toString();
      let txHash: string;
      if (actionType === 'delegate') {
        const msg = {
          typeUrl: '/cosmos.staking.v1beta1.MsgDelegate',
          value: {
            delegatorAddress: chainAddress,
            validatorAddress: selectedValidator.operatorAddress,
            amount: {
              denom: stakeCurrency?.coinMinimalDenom || 'ubze',
              amount: amountInMinimal,
            },
          },
        };
        txHash = await signAndBroadcast(selectedChainId, [msg], undefined, '');
      } else if (actionType === 'undelegate') {
        const msg = {
          typeUrl: '/cosmos.staking.v1beta1.MsgUndelegate',
          value: {
            delegatorAddress: chainAddress,
            validatorAddress: selectedValidator.operatorAddress,
            amount: {
              denom: stakeCurrency?.coinMinimalDenom || 'ubze',
              amount: amountInMinimal,
            },
          },
        };
        txHash = await signAndBroadcast(selectedChainId, [msg], undefined, '');
      } else {
        throw new Error('Invalid staking action');
      }

      toast({
        title: actionType === 'delegate' ? 'Delegation successful' : 'Undelegation started',
        description:
          actionType === 'undelegate'
            ? 'Tokens will be available after unbonding period'
            : undefined,
        status: 'success',
        duration: 3000,
      });
      console.log('Staking tx hash:', txHash);
      onDelegateClose();
      loadStakingData();
    } catch (error) {
      console.error('Staking transaction failed:', error);
      toast({
        title: 'Transaction failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClaimRewards = async () => {
    if (!chainConfig || !chainAddress || delegations.length === 0) return;

    setIsSubmitting(true);
    try {
      // Claim from all validators
      const msgs = delegations.map((d) => ({
        typeUrl: '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward',
        value: {
          delegatorAddress: chainAddress,
          validatorAddress: d.delegation.validatorAddress,
        },
      }));

      await signAndBroadcast(selectedChainId, msgs, undefined, '');
      toast({
        title: 'Rewards claimed',
        status: 'success',
        duration: 3000,
      });
      loadStakingData();
    } catch (error) {
      console.error('Claim rewards failed:', error);
      toast({
        title: 'Failed to claim rewards',
        description: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatAmount = (amount: string): string => {
    const num = parseFloat(amount);
    if (num < 0.001 && num > 0) {
      return num.toFixed(6);
    }
    return num.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 6 });
  };

  return (
    <Box h="full" bg="#0a0a0a" display="flex" flexDirection="column" color="white">
      {/* Header */}
      <HStack px={4} py={3} borderBottom="1px" borderColor="#2a2a2a">
        <IconButton
          aria-label="Back"
          icon={<ArrowBackIcon />}
          variant="ghost"
          size="sm"
          color="gray.400"
          _hover={{ color: 'white' }}
          onClick={onBack}
        />
        <Text fontSize="lg" fontWeight="semibold" flex={1}>
          Stake {symbol}
        </Text>
        <IconButton
          aria-label="Refresh"
          icon={<RepeatIcon />}
          variant="ghost"
          size="sm"
          color="gray.400"
          _hover={{ color: 'white' }}
          onClick={loadStakingData}
          isLoading={loading}
        />
      </HStack>

      {/* Content */}
      <Box flex={1} overflowY="auto" px={4} py={4}>
        {loading ? (
          <VStack py={8}>
            <Spinner color="cyan.400" />
            <Text color="gray.500">Loading staking data...</Text>
          </VStack>
        ) : (
          <VStack spacing={4} align="stretch">
            {/* Overview Cards */}
            <HStack spacing={3}>
              <Box bg="#141414" borderRadius="xl" p={3} flex={1}>
                <Text color="gray.500" fontSize="xs" mb={1}>
                  Staked
                </Text>
                <Text fontWeight="semibold" fontSize="md">
                  {formatAmount(getTotalStaked())} {symbol}
                </Text>
              </Box>
              <Box bg="#141414" borderRadius="xl" p={3} flex={1}>
                <Text color="gray.500" fontSize="xs" mb={1}>
                  Available
                </Text>
                <Text fontWeight="semibold" fontSize="md">
                  {formatAmount((parseInt(availableBalance) / Math.pow(10, decimals)).toFixed(6))}{' '}
                  {symbol}
                </Text>
              </Box>
            </HStack>

            {/* Rewards Card */}
            <Box bg="#141414" borderRadius="xl" p={4}>
              <HStack justify="space-between" align="center">
                <VStack align="start" spacing={0}>
                  <Text color="gray.500" fontSize="xs">
                    Pending Rewards
                  </Text>
                  <Text fontWeight="semibold" fontSize="lg" color="green.400">
                    {formatAmount(getTotalRewards())} {symbol}
                  </Text>
                </VStack>
                <Button
                  size="sm"
                  colorScheme="green"
                  borderRadius="lg"
                  isDisabled={parseFloat(getTotalRewards()) <= 0}
                  isLoading={isSubmitting}
                  onClick={handleClaimRewards}
                >
                  Claim
                </Button>
              </HStack>
            </Box>

            {/* Unbonding Notice */}
            {unbonding.length > 0 && (
              <Box bg="#1a1a1a" borderRadius="xl" p={3} border="1px" borderColor="orange.800">
                <HStack justify="space-between">
                  <Text color="orange.300" fontSize="sm">
                    Unbonding
                  </Text>
                  <Text color="orange.300" fontSize="sm" fontWeight="medium">
                    {formatAmount(getTotalUnbonding())} {symbol}
                  </Text>
                </HStack>
              </Box>
            )}

            <Divider borderColor="#2a2a2a" />

            {/* Tabs */}
            <Tabs variant="soft-rounded" colorScheme="cyan" size="sm">
              <TabList>
                <Tab _selected={{ bg: 'cyan.900', color: 'cyan.200' }} color="gray.500">
                  My Delegations ({delegations.length})
                </Tab>
                <Tab _selected={{ bg: 'cyan.900', color: 'cyan.200' }} color="gray.500">
                  Validators ({validators.length})
                </Tab>
              </TabList>

              <TabPanels>
                {/* My Delegations Tab */}
                <TabPanel px={0}>
                  <VStack spacing={3} align="stretch">
                    {delegations.length === 0 ? (
                      <Text color="gray.500" textAlign="center" py={4}>
                        No active delegations
                      </Text>
                    ) : (
                      delegations.map((d) => {
                        const validator = validators.find(
                          (v) => v.operatorAddress === d.delegation.validatorAddress
                        );
                        const amount = parseInt(d.balance.amount) / Math.pow(10, decimals);
                        const validatorAPR = validator
                          ? calculateValidatorAPR(
                              baseAPR,
                              validator.commission.commissionRates.rate
                            )
                          : 0;
                        const hasRestake = restakeValidators.has(d.delegation.validatorAddress);

                        return (
                          <Box
                            key={d.delegation.validatorAddress}
                            bg="#141414"
                            borderRadius="xl"
                            p={3}
                          >
                            <HStack justify="space-between" mb={2}>
                              <VStack align="start" spacing={0}>
                                <HStack spacing={1}>
                                  <Text fontWeight="medium" fontSize="sm">
                                    {validator?.description.moniker || 'Unknown Validator'}
                                  </Text>
                                  {hasRestake && (
                                    <Tooltip
                                      label="REStake enabled - auto-compounds rewards"
                                      hasArrow
                                    >
                                      <Text fontSize="xs" cursor="help">
                                        🔄
                                      </Text>
                                    </Tooltip>
                                  )}
                                </HStack>
                                <Text color="gray.500" fontSize="xs">
                                  {formatAmount(amount.toFixed(6))} {symbol}
                                </Text>
                              </VStack>
                              {validator?.commission && (
                                <Tooltip
                                  label={`Commission: ${formatCommission(
                                    validator.commission.commissionRates.rate
                                  )}`}
                                  hasArrow
                                >
                                  <Badge colorScheme="green" fontSize="xs">
                                    {validatorAPR.toFixed(1)}% APR
                                  </Badge>
                                </Tooltip>
                              )}
                            </HStack>
                            <HStack spacing={2}>
                              <Button
                                size="xs"
                                variant="outline"
                                borderColor="#3a3a3a"
                                flex={1}
                                onClick={() => validator && handleDelegate(validator)}
                              >
                                Delegate More
                              </Button>
                              <Button
                                size="xs"
                                variant="outline"
                                borderColor="orange.800"
                                color="orange.300"
                                flex={1}
                                onClick={() => validator && handleUndelegate(validator)}
                              >
                                Undelegate
                              </Button>
                            </HStack>
                          </Box>
                        );
                      })
                    )}
                  </VStack>
                </TabPanel>

                {/* Validators Tab */}
                <TabPanel px={0}>
                  <VStack spacing={2} align="stretch">
                    {validators
                      .slice(
                        validatorPage * VALIDATORS_PER_PAGE,
                        (validatorPage + 1) * VALIDATORS_PER_PAGE
                      )
                      .map((v, index) => {
                        const actualIndex = validatorPage * VALIDATORS_PER_PAGE + index;
                        const myDelegation = getValidatorDelegation(v.operatorAddress);
                        const hasDelegation = parseFloat(myDelegation) > 0;
                        const validatorAPR = calculateValidatorAPR(
                          baseAPR,
                          v.commission.commissionRates.rate
                        );
                        const hasRestake = restakeValidators.has(v.operatorAddress);

                        return (
                          <Box
                            key={v.operatorAddress}
                            bg="#141414"
                            borderRadius="xl"
                            p={3}
                            border={hasDelegation ? '1px' : 'none'}
                            borderColor={hasDelegation ? 'cyan.800' : 'transparent'}
                          >
                            <HStack justify="space-between">
                              <HStack spacing={2}>
                                <Text color="gray.600" fontSize="xs" w="28px" textAlign="left">
                                  #{actualIndex + 1}
                                </Text>
                                <VStack align="start" spacing={0} maxW="140px">
                                  <HStack spacing={1}>
                                    <Text
                                      fontWeight="medium"
                                      fontSize="sm"
                                      noOfLines={1}
                                      maxW={hasRestake ? '120px' : '140px'}
                                      isTruncated
                                    >
                                      {v.description.moniker}
                                    </Text>
                                    {hasRestake && (
                                      <Tooltip
                                        label="REStake enabled - auto-compounds rewards"
                                        hasArrow
                                      >
                                        <Text fontSize="xs" cursor="help">
                                          🔄
                                        </Text>
                                      </Tooltip>
                                    )}
                                  </HStack>
                                  <HStack spacing={2}>
                                    <Text color="gray.500" fontSize="xs">
                                      {formatVotingPower(v.tokens, decimals)} {symbol}
                                    </Text>
                                    <Tooltip
                                      label={`Commission: ${formatCommission(
                                        v.commission.commissionRates.rate
                                      )}`}
                                      hasArrow
                                    >
                                      <Badge colorScheme="green" fontSize="2xs">
                                        {validatorAPR.toFixed(1)}% APR
                                      </Badge>
                                    </Tooltip>
                                  </HStack>
                                </VStack>
                              </HStack>
                              <Button
                                size="xs"
                                colorScheme="cyan"
                                variant={hasDelegation ? 'solid' : 'outline'}
                                onClick={() => handleDelegate(v)}
                              >
                                {hasDelegation ? 'Manage' : 'Stake'}
                              </Button>
                            </HStack>
                          </Box>
                        );
                      })}

                    {/* Pagination Controls */}
                    {validators.length > VALIDATORS_PER_PAGE && (
                      <HStack justify="center" spacing={4} pt={3}>
                        <Button
                          size="sm"
                          variant="outline"
                          borderColor="#3a3a3a"
                          isDisabled={validatorPage === 0}
                          onClick={() => setValidatorPage((p) => Math.max(0, p - 1))}
                        >
                          Previous
                        </Button>
                        <Text fontSize="sm" color="gray.400">
                          Page {validatorPage + 1} of{' '}
                          {Math.ceil(validators.length / VALIDATORS_PER_PAGE)}
                        </Text>
                        <Button
                          size="sm"
                          variant="outline"
                          borderColor="#3a3a3a"
                          isDisabled={
                            (validatorPage + 1) * VALIDATORS_PER_PAGE >= validators.length
                          }
                          onClick={() => setValidatorPage((p) => p + 1)}
                        >
                          Next
                        </Button>
                      </HStack>
                    )}
                  </VStack>
                </TabPanel>
              </TabPanels>
            </Tabs>
          </VStack>
        )}
      </Box>

      {/* Delegate/Undelegate Modal */}
      <Modal isOpen={isDelegateOpen} onClose={onDelegateClose} isCentered>
        <ModalOverlay bg="blackAlpha.700" />
        <ModalContent
          bg="#0a0a0a"
          color="white"
          borderRadius="2xl"
          border="1px"
          borderColor="#2a2a2a"
          mx={4}
        >
          <ModalHeader>
            {actionType === 'delegate' ? 'Delegate' : 'Undelegate'} {symbol}
          </ModalHeader>
          <ModalCloseButton color="gray.500" _hover={{ color: 'white' }} />
          <ModalBody pb={6}>
            <VStack spacing={4} align="stretch">
              {/* Validator Info */}
              {selectedValidator && (
                <Box bg="#141414" borderRadius="xl" p={3}>
                  <HStack spacing={1}>
                    <Text fontWeight="medium">{selectedValidator.description.moniker}</Text>
                    {restakeValidators.has(selectedValidator.operatorAddress) && (
                      <Tooltip label="REStake enabled - auto-compounds rewards" hasArrow>
                        <Text fontSize="xs" cursor="help">
                          🔄
                        </Text>
                      </Tooltip>
                    )}
                  </HStack>
                  <HStack spacing={3} mt={1}>
                    <Badge colorScheme="green" fontSize="xs">
                      {calculateValidatorAPR(
                        baseAPR,
                        selectedValidator.commission.commissionRates.rate
                      ).toFixed(1)}
                      % APR
                    </Badge>
                    <Text color="gray.500" fontSize="xs">
                      Commission:{' '}
                      {formatCommission(selectedValidator.commission.commissionRates.rate)}
                    </Text>
                  </HStack>
                  <Text color="gray.500" fontSize="xs" mt={1}>
                    VP: {formatVotingPower(selectedValidator.tokens, decimals)} {symbol}
                  </Text>
                  {actionType === 'undelegate' && (
                    <Text color="gray.500" fontSize="xs" mt={1}>
                      Delegated: {getValidatorDelegation(selectedValidator.operatorAddress)}{' '}
                      {symbol}
                    </Text>
                  )}
                </Box>
              )}

              {/* Amount Input */}
              <Box>
                <HStack justify="space-between" mb={2}>
                  <Text fontSize="sm" color="gray.400">
                    Amount
                  </Text>
                  <Button size="xs" variant="ghost" color="cyan.400" onClick={handleMaxAmount}>
                    MAX
                  </Button>
                </HStack>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={delegateAmount}
                  onChange={(e) => setDelegateAmount(e.target.value)}
                  bg="#141414"
                  border="none"
                  borderRadius="xl"
                  _placeholder={{ color: 'gray.600' }}
                  _focus={{ ring: 2, ringColor: 'cyan.500' }}
                />
                <Text fontSize="xs" color="gray.500" mt={1}>
                  {actionType === 'delegate'
                    ? `Available: ${formatAmount(
                        (parseInt(availableBalance) / Math.pow(10, decimals)).toFixed(6)
                      )} ${symbol}`
                    : `Delegated: ${
                        selectedValidator
                          ? getValidatorDelegation(selectedValidator.operatorAddress)
                          : '0'
                      } ${symbol}`}
                </Text>
              </Box>

              {/* Warning for undelegate */}
              {actionType === 'undelegate' && (
                <Box
                  p={3}
                  bg="rgba(245, 158, 11, 0.1)"
                  borderRadius="lg"
                  border="1px"
                  borderColor="orange.800"
                >
                  <Text fontSize="xs" color="orange.300">
                    ⚠️ Undelegated tokens will be locked for 21 days before becoming available.
                  </Text>
                </Box>
              )}

              {/* Submit Button */}
              <Button
                colorScheme={actionType === 'delegate' ? 'cyan' : 'orange'}
                borderRadius="xl"
                isLoading={isSubmitting}
                onClick={handleSubmitDelegation}
                isDisabled={!delegateAmount || parseFloat(delegateAmount) <= 0}
              >
                {actionType === 'delegate' ? 'Delegate' : 'Undelegate'}
              </Button>
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default Staking;
