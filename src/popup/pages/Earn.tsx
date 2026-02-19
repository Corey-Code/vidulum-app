import React, { useEffect, useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  IconButton,
  Badge,
  Spinner,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Input,
  useDisclosure,
  Divider,
} from '@chakra-ui/react';
import { ArrowBackIcon, RepeatIcon } from '@chakra-ui/icons';
import { useWalletStore } from '@/store/walletStore';
import { useChainStore } from '@/store/chainStore';
import {
  createJoinStakingMsg,
  createClaimStakingRewardsMsg,
  toBaseUnits,
} from '@/lib/bze/rewards';

interface StakingPool {
  index: string;
  name: string;
  stakeDenom: string;
  stakeSymbol: string;
  rewardDenom: string;
  rewardSymbol: string;
  dailyReward: string;
  minStake: string;
  totalStaked: string;
  lockDays: number;
  status: 'running' | 'ended' | 'paused';
  apr?: number;
  userStake?: string;
  pendingRewards?: string;
  daysRemaining?: number;
  daysElapsed?: number;
  totalDays?: number;
}

interface EarnProps {
  onBack: () => void;
}

const Earn: React.FC<EarnProps> = ({ onBack }) => {
  const { selectedAccount, getAddressForChain, signAndBroadcast } = useWalletStore();
  const { getBalance, fetchBalance, balances } = useChainStore();
  const [pools, setPools] = useState<StakingPool[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPool, setSelectedPool] = useState<StakingPool | null>(null);
  const [expandedPoolId, setExpandedPoolId] = useState<string | null>(null);
  const [stakeAmount, setStakeAmount] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const { isOpen: isStakeOpen, onOpen: onStakeOpen, onClose: onStakeClose } = useDisclosure();
  const toast = useToast();

  const address = getAddressForChain('bze') || '';
  const balance = getBalance('beezee-1', address);

  // Get the available balance for the selected pool's stake token
  const getStakeTokenBalance = (): string => {
    if (!selectedPool || !address) return '0';

    // Get all balances for the address
    const chainBalances = balances[`beezee-1:${address}`] || [];
    const tokenBalance = chainBalances.find((b) => b.denom === selectedPool.stakeDenom);
    return tokenBalance?.amount || '0';
  };

  const handleMaxStake = () => {
    const availableBalance = getStakeTokenBalance();
    const availableNum = parseInt(availableBalance) / Math.pow(10, 6);
    // Leave a small buffer for fees if staking BZE
    if (selectedPool?.stakeDenom === 'ubze') {
      const maxWithBuffer = Math.max(0, availableNum - 0.01); // Reserve 0.01 BZE for fees
      setStakeAmount(maxWithBuffer.toFixed(6));
    } else {
      setStakeAmount(availableNum.toFixed(6));
    }
  };

  // Fetch staking pools from BZE REST API
  const fetchPools = async () => {
    setLoading(true);
    try {
      // Fetch all staking rewards (pools)
      const response = await fetch('https://rest.getbze.com/bze/rewards/all_staking_rewards');
      const data = await response.json();

      // Fetch user's participations if address available
      let userParticipations: Record<string, { amount: string; joined_at: string }> = {};
      if (address) {
        try {
          const userResponse = await fetch(
            `https://rest.getbze.com/bze/rewards/staking_reward_participant/${address}`
          );
          const userData = await userResponse.json();
          if (userData.list) {
            userData.list.forEach((p: any) => {
              userParticipations[p.reward_id] = {
                amount: p.amount || '0',
                joined_at: p.joined_at || '',
              };
            });
          }
        } catch (e) {
          // User has no stakes
        }
      }

      if (data.list) {
        const poolsData: StakingPool[] = data.list.map((pool: any) => {
          // Parse pool data
          const stakeDenom = pool.staking_denom || 'ubze';
          const rewardDenom = pool.prize_denom || 'ubze';

          // Get symbols from denoms
          const stakeSymbol = getSymbolFromDenom(stakeDenom);
          const rewardSymbol = getSymbolFromDenom(rewardDenom);

          // Calculate days from payouts and duration
          const totalDays = parseInt(pool.duration || '0');
          const daysElapsed = parseInt(pool.payouts || '0');
          const daysRemaining = Math.max(0, totalDays - daysElapsed);

          // Determine status
          let status: 'running' | 'ended' | 'paused' = 'running';
          if (daysRemaining <= 0) status = 'ended';

          // Calculate APR
          // APR = (daily_reward * 365 / total_staked) * 100
          const dailyReward = parseInt(pool.prize_amount || '0');
          const totalStaked = parseInt(pool.staked_amount || '1');
          const apr = totalStaked > 0 ? ((dailyReward * 365) / totalStaked) * 100 : 0;

          // Get user's stake from participations
          const rewardId = pool.reward_id;
          const userParticipation = userParticipations[rewardId];
          const userStake = userParticipation?.amount || '0';

          // Calculate pending rewards based on user's share
          // This is an estimate - actual rewards depend on when user joined
          let pendingRewards = '0';
          if (parseInt(userStake) > 0 && totalStaked > 0) {
            const userShare = parseInt(userStake) / totalStaked;
            const estimatedDailyReward = dailyReward * userShare;
            // Estimate based on distributed_stake percentage
            const distributedPct = parseFloat(pool.distributed_stake || '0');
            pendingRewards = Math.floor(estimatedDailyReward * distributedPct * 100).toString();
          }

          // Parse reward ID to get display number
          const displayId = parseInt(rewardId).toString();

          return {
            index: rewardId,
            name: `${stakeSymbol} #${displayId}`,
            stakeDenom,
            stakeSymbol,
            rewardDenom,
            rewardSymbol,
            dailyReward: pool.prize_amount || '0',
            minStake: pool.min_stake || '0',
            totalStaked: pool.staked_amount || '0',
            lockDays: parseInt(pool.lock || '0'),
            status,
            apr: Math.round(apr * 100) / 100,
            userStake,
            pendingRewards,
            daysRemaining,
            daysElapsed,
            totalDays,
          };
        });

        // Filter out ended pools
        const activePools = poolsData.filter((pool) => pool.status !== 'ended');

        // Sort by APR descending, then by user stake
        activePools.sort((a, b) => {
          const aUserStake = parseInt(a.userStake || '0');
          const bUserStake = parseInt(b.userStake || '0');
          if (aUserStake > 0 && bUserStake === 0) return -1;
          if (bUserStake > 0 && aUserStake === 0) return 1;
          return (b.apr || 0) - (a.apr || 0);
        });

        setPools(activePools);
      }
    } catch (error) {
      console.error('Failed to fetch staking pools:', error);
      toast({
        title: 'Failed to load pools',
        description: 'Could not fetch staking pools',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPools();
  }, [address]);

  // Known denom mappings for BZE ecosystem
  const denomSymbolMap: Record<string, string> = {
    ubze: 'BZE',
    'factory/bze13gzq40che93tgfm9kzmkpjamah5nj0j73pyhqk/uvdl': 'VDL',
    // USDC on BZE (via IBC)
    'ibc/6490A7EAB61059BFC1CDDEB05917DD70BDF3A611654162A1A47DB930D40D8AF4': 'USDC',
    // SHERPA on BZE (via IBC)
    'ibc/02EE50AB3A4B7540FA001B24CB75E688016F65547CABE885EA184338440080B2': 'SHERPA',
  };

  const getSymbolFromDenom = (denom: string): string => {
    // Check known mappings first
    if (denomSymbolMap[denom]) {
      return denomSymbolMap[denom];
    }

    if (denom === 'ubze') return 'BZE';
    if (denom.includes('uvdl') || denom.includes('VDL')) return 'VDL';
    if (denom.includes('usdc') || denom.includes('USDC')) return 'USDC';

    // Handle IBC denoms - show shortened hash
    if (denom.startsWith('ibc/')) {
      return `IBC/${denom.slice(4, 8)}`;
    }

    // Handle factory denoms
    if (denom.startsWith('factory/')) {
      const parts = denom.split('/');
      if (parts.length >= 3) {
        return parts[2].replace('u', '').toUpperCase();
      }
    }

    return denom.slice(0, 6).toUpperCase();
  };

  const formatAmount = (amount: string, decimals: number = 6): string => {
    const num = parseInt(amount) / Math.pow(10, decimals);
    if (num >= 1000000) return `${(num / 1000000).toFixed(3)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(3)}K`;
    return num.toFixed(3);
  };

  const handleStake = async () => {
    if (!selectedPool || !stakeAmount || !address) return;

    setActionLoading(true);
    try {
      // Validate amount
      const stakeAmountNum = parseFloat(stakeAmount);
      if (isNaN(stakeAmountNum) || stakeAmountNum <= 0) {
        throw new Error('Please enter a valid stake amount');
      }

      // Check minimum stake
      const minStakeNum = parseInt(selectedPool.minStake) / Math.pow(10, 6);
      if (stakeAmountNum < minStakeNum) {
        throw new Error(`Minimum stake is ${minStakeNum} ${selectedPool.stakeSymbol}`);
      }

      // Convert amount to base units (e.g., 1 BZE = 1000000 ubze)
      const baseAmount = toBaseUnits(stakeAmount, 6);

      // Create the join staking message
      const msg = createJoinStakingMsg(address, selectedPool.index, baseAmount);

      // Sign and broadcast transaction (fee dynamically simulated in walletStore)
      const txHash = await signAndBroadcast('beezee-1', [msg], undefined, '');

      toast({
        title: 'Stake Successful!',
        description: `Staked ${stakeAmount} ${selectedPool.stakeSymbol}. TX: ${txHash.slice(
          0,
          10
        )}...`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });

      // Refresh pools and balance
      await fetchPools();
      await fetchBalance('beezee-1', address);

      onStakeClose();
    } catch (error) {
      console.error('Stake failed:', error);
      toast({
        title: 'Stake Failed',
        description: error instanceof Error ? error.message : 'Transaction failed',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleClaim = async (pool: StakingPool) => {
    if (!address) return;

    setActionLoading(true);
    try {
      // Create the claim staking rewards message
      const msg = createClaimStakingRewardsMsg(address, pool.index);

      // Sign and broadcast transaction (fee dynamically simulated in walletStore)
      const txHash = await signAndBroadcast('beezee-1', [msg], undefined, '');

      toast({
        title: 'Rewards Claimed!',
        description: `Claimed rewards from ${pool.stakeSymbol} pool. TX: ${txHash.slice(0, 10)}...`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });

      // Refresh pools and balance
      await fetchPools();
      await fetchBalance('beezee-1', address);
    } catch (error) {
      console.error('Claim failed:', error);
      toast({
        title: 'Claim Failed',
        description: error instanceof Error ? error.message : 'Transaction failed',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setActionLoading(false);
    }
  };

  const openStakeModal = (pool: StakingPool) => {
    setSelectedPool(pool);
    setStakeAmount('');
    onStakeOpen();
  };

  return (
    <Box h="full" bg="#0a0a0a" overflow="hidden" display="flex" flexDirection="column">
      {/* Header */}
      <HStack px={4} py={3} borderBottom="1px" borderColor="#1a1a1a" justify="space-between">
        <HStack spacing={3}>
          <IconButton
            aria-label="Back"
            icon={<ArrowBackIcon />}
            variant="ghost"
            size="sm"
            onClick={onBack}
          />
          <Text fontSize="lg" fontWeight="semibold">
            Offers
          </Text>
          <Badge colorScheme="cyan" fontSize="xs">
            BeeZee
          </Badge>
        </HStack>
        <IconButton
          aria-label="Refresh"
          icon={<RepeatIcon />}
          variant="ghost"
          size="sm"
          onClick={fetchPools}
          isLoading={loading}
        />
      </HStack>

      {/* Content */}
      <Box flex={1} overflow="auto" p={4}>
        {loading ? (
          <VStack py={8} spacing={4}>
            <Spinner size="lg" color="cyan.400" />
            <Text color="gray.500">Loading staking pools...</Text>
          </VStack>
        ) : pools.length === 0 ? (
          <VStack py={8} spacing={4}>
            <Text color="gray.500">No staking pools available</Text>
          </VStack>
        ) : (
          <VStack spacing={3} align="stretch">
            {pools.map((pool) => (
              <PoolCard
                key={pool.index}
                pool={pool}
                isExpanded={expandedPoolId === pool.index}
                onToggle={() =>
                  setExpandedPoolId(expandedPoolId === pool.index ? null : pool.index)
                }
                onStake={() => openStakeModal(pool)}
                onClaim={() => handleClaim(pool)}
                formatAmount={formatAmount}
              />
            ))}
          </VStack>
        )}
      </Box>

      {/* Stake Modal */}
      <Modal isOpen={isStakeOpen} onClose={onStakeClose} isCentered>
        <ModalOverlay bg="blackAlpha.800" />
        <ModalContent bg="#141414" borderColor="#2a2a2a" borderWidth="1px" mx={4}>
          <ModalHeader>
            Stake {selectedPool?.stakeSymbol}
            <Text fontSize="sm" fontWeight="normal" color="gray.500">
              Earn {selectedPool?.rewardSymbol}
            </Text>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <Box>
                <HStack justify="space-between" mb={2}>
                  <Text fontSize="sm" color="gray.400">
                    Amount to Stake
                  </Text>
                  <Button
                    size="xs"
                    variant="ghost"
                    color="cyan.400"
                    onClick={handleMaxStake}
                    _hover={{ bg: 'whiteAlpha.100' }}
                  >
                    MAX
                  </Button>
                </HStack>
                <Input
                  placeholder="0.00"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  type="number"
                  bg="#0a0a0a"
                  borderColor="#2a2a2a"
                />
                <HStack justify="space-between" mt={1}>
                  <Text fontSize="xs" color="gray.500">
                    Minimum: {formatAmount(selectedPool?.minStake || '0')}{' '}
                    {selectedPool?.stakeSymbol}
                  </Text>
                  <Text fontSize="xs" color="cyan.400">
                    Available: {formatAmount(getStakeTokenBalance())} {selectedPool?.stakeSymbol}
                  </Text>
                </HStack>
              </Box>

              <Divider borderColor="#2a2a2a" />

              <HStack justify="space-between">
                <Text fontSize="sm" color="gray.400">
                  Lock Period
                </Text>
                <Text fontSize="sm">{selectedPool?.lockDays} days</Text>
              </HStack>
              <HStack justify="space-between">
                <Text fontSize="sm" color="gray.400">
                  Daily Rewards
                </Text>
                <Text fontSize="sm">
                  {formatAmount(selectedPool?.dailyReward || '0')} {selectedPool?.rewardSymbol}
                </Text>
              </HStack>
              <HStack justify="space-between">
                <Text fontSize="sm" color="gray.400">
                  APR
                </Text>
                <Text fontSize="sm" color="green.400">
                  ≈{selectedPool?.apr}%
                </Text>
              </HStack>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onStakeClose}>
              Cancel
            </Button>
            <Button
              colorScheme="cyan"
              onClick={handleStake}
              isLoading={actionLoading}
              isDisabled={!stakeAmount}
            >
              Stake
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

// Pool Card Component
interface PoolCardProps {
  pool: StakingPool;
  isExpanded: boolean;
  onToggle: () => void;
  onStake: () => void;
  onClaim: () => void;
  formatAmount: (amount: string, decimals?: number) => string;
}

const PoolCard: React.FC<PoolCardProps> = ({
  pool,
  isExpanded,
  onToggle,
  onStake,
  onClaim,
  formatAmount,
}) => {
  const userStakeAmount = parseInt(pool.userStake || '0');
  const hasStake = userStakeAmount > 0;
  const pendingRewards = parseInt(pool.pendingRewards || '0');
  const hasRewards = pendingRewards > 0;

  return (
    <Box
      bg="#141414"
      borderRadius="xl"
      borderWidth="1px"
      borderColor={isExpanded ? 'cyan.600' : hasStake ? 'cyan.800' : '#2a2a2a'}
      overflow="hidden"
      cursor="pointer"
      onClick={onToggle}
      transition="border-color 0.2s"
      _hover={{ borderColor: isExpanded ? 'cyan.600' : '#3a3a3a' }}
    >
      {/* Header */}
      <HStack px={3} py={2} justify="space-between" bg="#1a1a1a">
        <VStack align="start" spacing={0}>
          <HStack spacing={2}>
            <Text fontSize="sm" fontWeight="semibold">
              {pool.stakeSymbol}
            </Text>
            <Text fontSize="xs" color="gray.500">
              →
            </Text>
            <Text fontSize="sm" fontWeight="semibold" color="cyan.400">
              {pool.rewardSymbol}
            </Text>
          </HStack>
          <Text fontSize="xs" color="gray.500">
            {pool.daysRemaining} days left
          </Text>
        </VStack>
        <VStack align="end" spacing={0}>
          <Text fontSize="xs" color="gray.500">
            APR
          </Text>
          <Text color="green.400" fontWeight="bold" fontSize="sm">
            ≈{pool.apr}%
          </Text>
        </VStack>
      </HStack>

      {/* User Stats (if staked) */}
      {hasStake && (
        <HStack px={3} py={2} spacing={2} bg="#0d0d0d">
          <Box flex={1} bg="#1a1a1a" p={2} borderRadius="md">
            <Text fontSize="9px" color="cyan.400">
              YOUR STAKE
            </Text>
            <Text fontSize="sm" fontWeight="bold">
              {formatAmount(pool.userStake || '0')} {pool.stakeSymbol}
            </Text>
          </Box>
          <Box flex={1} bg="#1a1a1a" p={2} borderRadius="md">
            <Text fontSize="9px" color="purple.400">
              REWARDS
            </Text>
            <Text fontSize="sm" fontWeight="bold">
              {formatAmount(pool.pendingRewards || '0')} {pool.rewardSymbol}
            </Text>
          </Box>
        </HStack>
      )}

      {/* Stats Grid */}
      <HStack px={3} py={2} spacing={1}>
        <StatBox label="LOCK" value={`${pool.lockDays}d`} />
        <StatBox label="DAILY" value={`${formatAmount(pool.dailyReward)}`} />
        <StatBox label="MIN" value={`${formatAmount(pool.minStake)}`} />
        <StatBox label="TOTAL" value={`${formatAmount(pool.totalStaked)}`} />
      </HStack>

      {/* Actions - Only shown when expanded */}
      {isExpanded && (
        <HStack px={3} py={2} spacing={2}>
          <Button
            flex={1}
            size="sm"
            variant="outline"
            borderColor="cyan.500"
            color="cyan.400"
            _hover={{ bg: 'cyan.900', borderColor: 'cyan.400' }}
            onClick={(e) => {
              e.stopPropagation();
              onStake();
            }}
            isDisabled={pool.status !== 'running'}
          >
            {hasStake ? 'Stake More' : 'Stake'}
          </Button>
          {hasRewards && (
            <Button
              flex={1}
              size="sm"
              variant="outline"
              borderColor="purple.500"
              color="purple.400"
              _hover={{ bg: 'purple.900', borderColor: 'purple.400' }}
              onClick={(e) => {
                e.stopPropagation();
                onClaim();
              }}
            >
              Claim
            </Button>
          )}
        </HStack>
      )}
    </Box>
  );
};

// Stat Box Component
const StatBox: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <Box flex="1" minW="60px" bg="#1a1a1a" px={2} py={1} borderRadius="md">
    <Text fontSize="8px" color="gray.500">
      {label}
    </Text>
    <Text fontSize="xs" fontWeight="medium" isTruncated>
      {value}
    </Text>
  </Box>
);

export default Earn;
