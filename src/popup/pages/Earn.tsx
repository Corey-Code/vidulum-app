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
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
} from '@chakra-ui/react';
import { ArrowBackIcon, RepeatIcon } from '@chakra-ui/icons';
import { useWalletStore } from '@/store/walletStore';
import { useChainStore } from '@/store/chainStore';
import {
  createJoinStakingMsg,
  createExitStakingMsg,
  createClaimStakingRewardsMsg,
  fetchAddressOffersPendingUnlocks,
  fetchCurrentHourEpoch,
  formatUnlockRemaining,
  getExitStakingFee,
  parseOffersUnlockIndex,
  remainingUnlockHours,
  toBaseUnits,
  type PendingUnlockParticipant,
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

interface UnlockView {
  pending: PendingUnlockParticipant;
  rewardId: string;
  remainingLabel: string;
  symbol: string;
}

interface EarnProps {
  onBack: () => void;
}

const Earn: React.FC<EarnProps> = ({ onBack }) => {
  const { isDemo, getAddressForChain, signAndBroadcast } = useWalletStore();
  const { getBalance, fetchBalance, balances } = useChainStore();
  const [pools, setPools] = useState<StakingPool[]>([]);
  const [unlocking, setUnlocking] = useState<UnlockView[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPool, setSelectedPool] = useState<StakingPool | null>(null);
  const [exitPool, setExitPool] = useState<StakingPool | null>(null);
  const [expandedPoolId, setExpandedPoolId] = useState<string | null>(null);
  const [stakeAmount, setStakeAmount] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const { isOpen: isStakeOpen, onOpen: onStakeOpen, onClose: onStakeClose } = useDisclosure();
  const { isOpen: isExitOpen, onOpen: onExitOpen, onClose: onExitClose } = useDisclosure();
  const exitCancelRef = React.useRef<HTMLButtonElement>(null);
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

  // Known denom mappings for BZE ecosystem
  const denomSymbolMap: Record<string, string> = {
    ubze: 'BZE',
    'factory/bze13gzq40che93tgfm9kzmkpjamah5nj0j73pyhqk/uvdl': 'VDL',
    'factory/bze1972aqfzdg29ugjln74edx0xvcg4ehvysjptk77/CTL': 'CTL',
    // USDC on BZE (via IBC)
    'ibc/6490A7EAB61059BFC1CDDEB05917DD70BDF3A611654162A1A47DB930D40D8AF4': 'USDC',
    // SHERPA on BZE (via IBC)
    'ibc/02EE50AB3A4B7540FA001B24CB75E688016F65547CABE885EA184338440080B2': 'SHERPA',
  };

  const getSymbolFromDenom = (denom: string): string => {
    if (denomSymbolMap[denom]) {
      return denomSymbolMap[denom];
    }

    if (denom === 'ubze') return 'BZE';
    if (denom.includes('uvdl') || denom.includes('VDL')) return 'VDL';
    if (denom.includes('/CTL') || denom.endsWith('CTL')) return 'CTL';
    if (denom.includes('usdc') || denom.includes('USDC')) return 'USDC';

    if (denom.startsWith('ibc/')) {
      return `IBC/${denom.slice(4, 8)}`;
    }

    if (denom.startsWith('factory/')) {
      const parts = denom.split('/');
      if (parts.length >= 3) {
        return parts[2].replace('u', '').toUpperCase();
      }
    }

    if (denom.startsWith('ulp/')) {
      return `ULP/${denom.slice(4, 6)}`;
    }

    return denom.slice(0, 6).toUpperCase();
  };

  const buildUnlockViews = (
    pendingList: PendingUnlockParticipant[],
    currentHourEpoch: number
  ): UnlockView[] => {
    return pendingList
      .map((pending) => {
        const { unlockEpoch, rewardId } = parseOffersUnlockIndex(pending.index);
        if (!rewardId) return null;
        const hours = remainingUnlockHours(unlockEpoch, currentHourEpoch);
        return {
          pending,
          rewardId,
          remainingLabel: formatUnlockRemaining(hours),
          symbol: getSymbolFromDenom(pending.denom),
        };
      })
      .filter((v): v is UnlockView => v !== null);
  };

  // Fetch staking pools from BZE REST API
  const fetchPools = async () => {
    setLoading(true);
    try {
      // Fetch all staking rewards (pools)
      const response = await fetch('https://rest.getbze.com/bze/rewards/all_staking_rewards');
      const data = await response.json();

      // Fetch user's participations + pending unlocks if address available
      let userParticipations: Record<string, { amount: string; joined_at: string }> = {};
      let pendingUnlocks: PendingUnlockParticipant[] = [];
      let currentHourEpoch = 0;
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

        const [unlocks, hourEpoch] = await Promise.all([
          fetchAddressOffersPendingUnlocks(address),
          fetchCurrentHourEpoch(),
        ]);
        pendingUnlocks = unlocks;
        currentHourEpoch = hourEpoch;
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

        // Demo wallet addresses never match on-chain participants — inject a
        // position + pending unlock so Offers exit / lock UX is exercisable.
        if (isDemo || useWalletStore.getState().isDemo) {
          const demo = demoPools()[0];
          const withoutDemo = activePools.filter((p) => p.index !== demo.index);
          setPools([demo, ...withoutDemo]);
          setUnlocking(demoUnlockViews());
          setExpandedPoolId((prev) => prev ?? demo.index);
        } else {
          setPools(activePools);
          setUnlocking(buildUnlockViews(pendingUnlocks, currentHourEpoch));
        }
      }
    } catch (error) {
      console.error('Failed to fetch staking pools:', error);
      if (isDemo || useWalletStore.getState().isDemo) {
        setPools(demoPools());
        setUnlocking(demoUnlockViews());
        setExpandedPoolId((prev) => prev ?? 'demo');
      } else {
        toast({
          title: 'Failed to load pools',
          description: 'Could not fetch staking pools',
          status: 'error',
          duration: 3000,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPools();
  }, [address]);

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

  const handleExit = async () => {
    if (!exitPool || !address) return;

    setActionLoading(true);
    try {
      const msg = createExitStakingMsg(address, exitPool.index);
      const fee = getExitStakingFee();
      const txHash = await signAndBroadcast('beezee-1', [msg], fee, '');

      toast({
        title: 'Exit submitted',
        description:
          exitPool.lockDays > 0
            ? `Unstake started. Funds unlock after ${exitPool.lockDays} days. TX: ${txHash.slice(0, 10)}...`
            : `Exited ${exitPool.stakeSymbol} offer. TX: ${txHash.slice(0, 10)}...`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });

      await fetchPools();
      await fetchBalance('beezee-1', address);
      onExitClose();
      setExitPool(null);
    } catch (error) {
      console.error('Exit failed:', error);
      toast({
        title: 'Exit Failed',
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

  const openExitDialog = (pool: StakingPool) => {
    setExitPool(pool);
    onExitOpen();
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
          <VStack align="start" spacing={0}>
            <HStack spacing={2}>
              <Text fontSize="lg" fontWeight="semibold">
                Offers
              </Text>
              <Badge colorScheme="cyan" fontSize="xs">
                BeeZee
              </Badge>
            </HStack>
            <Text fontSize="xs" color="gray.500">
              Time-boxed staking pools · not Stake
            </Text>
          </VStack>
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
        ) : pools.length === 0 && unlocking.length === 0 ? (
          <VStack py={8} spacing={4}>
            <Text color="gray.500">No offers available</Text>
          </VStack>
        ) : (
          <VStack spacing={3} align="stretch">
            {unlocking.length > 0 && (
              <Box
                bg="#141414"
                borderRadius="xl"
                borderWidth="1px"
                borderColor="orange.800"
                overflow="hidden"
              >
                <Box px={3} py={2} bg="#1a1a1a">
                  <Text fontSize="xs" fontWeight="semibold" color="orange.300">
                    Pending unlock
                  </Text>
                  <Text fontSize="xs" color="gray.500">
                    Exit starts a lock — funds return when the unlock finishes
                  </Text>
                </Box>
                <VStack spacing={0} align="stretch" divider={<Divider borderColor="#2a2a2a" />}>
                  {unlocking.map((u) => (
                    <HStack key={u.pending.index} px={3} py={2} justify="space-between">
                      <VStack align="start" spacing={0}>
                        <Text fontSize="sm" fontWeight="medium">
                          {formatAmount(u.pending.amount)} {u.symbol}
                        </Text>
                        <Text fontSize="xs" color="gray.500">
                          Offer #{parseInt(u.rewardId, 10)}
                        </Text>
                      </VStack>
                      <Badge colorScheme="orange" fontSize="xs">
                        {u.remainingLabel}
                      </Badge>
                    </HStack>
                  ))}
                </VStack>
              </Box>
            )}

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
                onExit={() => openExitDialog(pool)}
                formatAmount={formatAmount}
                actionLoading={actionLoading}
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
              {!!selectedPool?.lockDays && (
                <Text fontSize="xs" color="orange.300">
                  Exit starts a {selectedPool.lockDays}-day unlock. Staked funds return after the
                  lock — no rewards during unlock.
                </Text>
              )}
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

      <AlertDialog
        isOpen={isExitOpen}
        leastDestructiveRef={exitCancelRef}
        onClose={() => {
          onExitClose();
          setExitPool(null);
        }}
        isCentered
      >
        <AlertDialogOverlay>
          <AlertDialogContent bg="#141414" borderColor="#2a2a2a" borderWidth="1px" mx={4}>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Exit offer?
            </AlertDialogHeader>
            <AlertDialogBody>
              <VStack align="stretch" spacing={3}>
                <Text>
                  Unstakes your full position (
                  {formatAmount(exitPool?.userStake || '0')} {exitPool?.stakeSymbol}). Pending
                  rewards are claimed with the exit.
                </Text>
                {(exitPool?.lockDays || 0) > 0 ? (
                  <Box bg="#1a1208" borderRadius="md" px={3} py={2} borderWidth="1px" borderColor="orange.800">
                    <Text fontSize="sm" color="orange.300" fontWeight="medium">
                      {exitPool?.lockDays}-day unlock
                    </Text>
                    <Text fontSize="xs" color="gray.400">
                      Funds leave the offer now and return to your wallet after the lock. No
                      rewards accrue during unlock.
                    </Text>
                  </Box>
                ) : (
                  <Text fontSize="sm" color="gray.400">
                    This offer has no lock — funds return immediately.
                  </Text>
                )}
              </VStack>
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button
                ref={exitCancelRef}
                onClick={() => {
                  onExitClose();
                  setExitPool(null);
                }}
                variant="ghost"
              >
                Cancel
              </Button>
              <Button colorScheme="orange" onClick={handleExit} ml={3} isLoading={actionLoading}>
                Exit
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
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
  onExit: () => void;
  formatAmount: (amount: string, decimals?: number) => string;
  actionLoading: boolean;
}

const PoolCard: React.FC<PoolCardProps> = ({
  pool,
  isExpanded,
  onToggle,
  onStake,
  onClaim,
  onExit,
  formatAmount,
  actionLoading,
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
            {pool.lockDays > 0 ? ` · ${pool.lockDays}d unlock on exit` : ''}
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
            isDisabled={pool.status !== 'running' || actionLoading}
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
              isLoading={actionLoading}
            >
              Claim
            </Button>
          )}
          {hasStake && (
            <Button
              flex={1}
              size="sm"
              variant="outline"
              borderColor="orange.500"
              color="orange.300"
              _hover={{ bg: 'orange.900', borderColor: 'orange.400' }}
              onClick={(e) => {
                e.stopPropagation();
                onExit();
              }}
              isDisabled={actionLoading}
            >
              Exit
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

function demoPools(): StakingPool[] {
  return [
    {
      index: 'demo',
      name: 'BZE #demo',
      stakeDenom: 'ubze',
      stakeSymbol: 'BZE',
      rewardDenom: 'factory/bze13gzq40che93tgfm9kzmkpjamah5nj0j73pyhqk/uvdl',
      rewardSymbol: 'VDL',
      dailyReward: '10000000',
      minStake: '1000000',
      totalStaked: '103135000000',
      lockDays: 7,
      status: 'running',
      apr: 3.54,
      userStake: '2500000000',
      pendingRewards: '125000',
      daysRemaining: 27,
      daysElapsed: 3,
      totalDays: 30,
    },
  ];
}

function demoUnlockViews(): UnlockView[] {
  return [
    {
      pending: {
        index: '99999/000000000000/bze1DEMO',
        address: 'bze1DEMO',
        amount: '500000000',
        denom: 'ubze',
      },
      rewardId: '000000000000',
      remainingLabel: formatUnlockRemaining(72),
      symbol: 'BZE',
    },
  ];
}

export default Earn;
