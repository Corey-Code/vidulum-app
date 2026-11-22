import React, { useCallback, useEffect, useState } from 'react';
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
  ButtonGroup,
} from '@chakra-ui/react';
import { ArrowBackIcon, RepeatIcon } from '@chakra-ui/icons';
import { useWalletStore } from '@/store/walletStore';
import { useChainStore } from '@/store/chainStore';
import {
  CTL_DENOM,
  DENOM_REWARD_ASSETS,
  VDL_DENOM,
  createClaimDenomRewardsMsg,
  createExitDenomRewardMsg,
  createJoinDenomRewardMsg,
  estimateDenomRewardApr,
  fetchDenomReward,
  fetchDenomRewardParticipant,
  fetchDenomRewardSchedules,
  getDenomRewardAsset,
  getDenomRewardExitFee,
  sumPendingForDenom,
  toBaseUnits,
  type DenomReward,
  type DenomRewardAsset,
  type DenomRewardSchedule,
  type PendingPrizeCoin,
} from '@/lib/bze/denomRewards';

interface DenomEarnProps {
  onBack: () => void;
  /** Factory denom or symbol (VDL / CTL). Defaults to VDL. */
  initialDenom?: string;
}

interface PoolView {
  pool: DenomReward;
  schedules: DenomRewardSchedule[];
  dailyReward: string;
  prizeDenom: string;
  apr: number;
  daysRemaining: number;
  userStake: string;
  pendingRewards: string;
  pending: PendingPrizeCoin[];
}

function resolveAsset(initialDenom?: string): DenomRewardAsset {
  return getDenomRewardAsset(initialDenom || VDL_DENOM) || DENOM_REWARD_ASSETS[0];
}

const DenomEarn: React.FC<DenomEarnProps> = ({ onBack, initialDenom }) => {
  const { isDemo, getAddressForChain, signAndBroadcast } = useWalletStore();
  const { fetchBalance, getBalance } = useChainStore();
  const [asset, setAsset] = useState<DenomRewardAsset>(() => resolveAsset(initialDenom));
  const [view, setView] = useState<PoolView | null>(null);
  const [loading, setLoading] = useState(true);
  const [stakeAmount, setStakeAmount] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const { isOpen: isStakeOpen, onOpen: onStakeOpen, onClose: onStakeClose } = useDisclosure();
  const { isOpen: isExitOpen, onOpen: onExitOpen, onClose: onExitClose } = useDisclosure();
  const exitCancelRef = React.useRef<HTMLButtonElement>(null);
  const toast = useToast();

  const address = getAddressForChain('bze') || '';
  const chainBalances = getBalance('beezee-1', address) || [];
  const walletBalance = chainBalances.find((b) => b.denom === asset.denom)?.amount || '0';
  const symbol = asset.symbol;
  const accent = asset.colorScheme;

  useEffect(() => {
    setAsset(resolveAsset(initialDenom));
  }, [initialDenom]);

  const loadPool = useCallback(async () => {
    setLoading(true);
    try {
      const [pool, schedules, participantView] = await Promise.all([
        fetchDenomReward(asset.denom),
        fetchDenomRewardSchedules(asset.denom),
        address
          ? fetchDenomRewardParticipant(address, asset.denom)
          : Promise.resolve({ participant: null, pending: [] as PendingPrizeCoin[] }),
      ]);

      if (!pool) {
        if (isDemo) {
          setView(demoPoolView(asset));
        } else {
          setView(null);
        }
        return;
      }

      const activeSchedules = schedules.filter(
        (s) => (Number(s.duration) || 0) - (Number(s.payouts) || 0) > 0
      );
      const primary =
        activeSchedules.find((s) => s.prize_denom === asset.denom) ||
        activeSchedules[0] ||
        schedules[0];
      const dailyReward = activeSchedules.reduce(
        (sum, s) => sum + (parseInt(s.daily_amount, 10) || 0),
        0
      );
      const daysRemaining = primary
        ? Math.max(0, (Number(primary.duration) || 0) - (Number(primary.payouts) || 0))
        : 0;
      const pending = participantView.pending || [];
      const prizeDenom = primary?.prize_denom || asset.denom;

      setView({
        pool,
        schedules,
        dailyReward: String(dailyReward),
        prizeDenom,
        apr: estimateDenomRewardApr(schedules, pool.staked_amount),
        daysRemaining,
        userStake: participantView.participant?.amount || '0',
        pendingRewards: sumPendingForDenom(pending, prizeDenom),
        pending,
      });
    } catch (error) {
      console.error('Failed to load DenomReward:', error);
      if (isDemo) {
        setView(demoPoolView(asset));
      } else {
        setView(null);
        toast({
          title: `Failed to load ${symbol} earn pool`,
          description: error instanceof Error ? error.message : 'Could not fetch DenomReward',
          status: 'error',
          duration: 3000,
        });
      }
    } finally {
      setLoading(false);
    }
  }, [address, asset, isDemo, symbol, toast]);

  useEffect(() => {
    loadPool();
  }, [loadPool]);

  const formatAmount = (amount: string, decimals: number = asset.decimals): string => {
    const num = parseInt(amount, 10) / Math.pow(10, decimals);
    if (Number.isNaN(num)) return '0';
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(3)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(3)}K`;
    return num.toFixed(3);
  };

  const handleMaxStake = () => {
    const availableNum = parseInt(walletBalance, 10) / Math.pow(10, asset.decimals);
    setStakeAmount(Math.max(0, availableNum).toFixed(asset.decimals));
  };

  const handleJoin = async () => {
    if (!view || !stakeAmount || !address) return;
    setActionLoading(true);
    try {
      const stakeAmountNum = parseFloat(stakeAmount);
      if (isNaN(stakeAmountNum) || stakeAmountNum <= 0) {
        throw new Error('Please enter a valid stake amount');
      }
      const minStakeNum = parseInt(view.pool.min_stake, 10) / Math.pow(10, asset.decimals);
      if (stakeAmountNum < minStakeNum) {
        throw new Error(`Minimum stake is ${minStakeNum} ${symbol}`);
      }

      const baseAmount = toBaseUnits(stakeAmount, asset.decimals);
      const msg = createJoinDenomRewardMsg(address, asset.denom, baseAmount);
      const txHash = await signAndBroadcast('beezee-1', [msg], undefined, '');

      toast({
        title: `Staked ${symbol}`,
        description: `Joined DenomReward with ${stakeAmount} ${symbol}. TX: ${txHash.slice(0, 10)}...`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });

      await loadPool();
      await fetchBalance('beezee-1', address);
      onStakeClose();
    } catch (error) {
      console.error('Join DenomReward failed:', error);
      toast({
        title: 'Stake failed',
        description: error instanceof Error ? error.message : 'Transaction failed',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleClaim = async () => {
    if (!address) return;
    setActionLoading(true);
    try {
      const msg = createClaimDenomRewardsMsg(address, asset.denom);
      const txHash = await signAndBroadcast('beezee-1', [msg], undefined, '');
      toast({
        title: 'Rewards claimed',
        description: `Claimed DenomReward prizes. TX: ${txHash.slice(0, 10)}...`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      await loadPool();
      await fetchBalance('beezee-1', address);
    } catch (error) {
      console.error('Claim DenomReward failed:', error);
      toast({
        title: 'Claim failed',
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
    if (!address) return;
    setActionLoading(true);
    try {
      const msg = createExitDenomRewardMsg(address, asset.denom);
      const fee = getDenomRewardExitFee();
      const txHash = await signAndBroadcast('beezee-1', [msg], fee, '');
      toast({
        title: 'Exited stake',
        description: `Left ${symbol} DenomReward. Lock was ${view?.pool.lock ?? 7}d. TX: ${txHash.slice(0, 10)}...`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      await loadPool();
      await fetchBalance('beezee-1', address);
      onExitClose();
    } catch (error) {
      console.error('Exit DenomReward failed:', error);
      toast({
        title: 'Exit failed',
        description: error instanceof Error ? error.message : 'Transaction failed',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setActionLoading(false);
    }
  };

  const hasStake = parseInt(view?.userStake || '0', 10) > 0;
  const hasRewards = parseInt(view?.pendingRewards || '0', 10) > 0;
  const accentToken = accent === 'green' ? 'green.300' : 'purple.300';
  const accentBorder = accent === 'green' ? 'green.700' : 'purple.700';
  const accentHoverBg = accent === 'green' ? 'green.900' : 'purple.900';
  const accentHoverBorder = accent === 'green' ? 'green.400' : 'purple.400';
  const accentBorderBtn = accent === 'green' ? 'green.500' : 'purple.500';
  const spinnerColor = accent === 'green' ? 'green.400' : 'purple.400';

  return (
    <Box h="full" bg="#0a0a0a" overflow="hidden" display="flex" flexDirection="column">
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
                Stake {symbol}
              </Text>
              <Badge colorScheme={accent} fontSize="xs">
                Earn {symbol}
              </Badge>
            </HStack>
            <Text fontSize="xs" color="gray.500">
              BeeZee DenomReward · not Offers
            </Text>
          </VStack>
        </HStack>
        <IconButton
          aria-label="Refresh"
          icon={<RepeatIcon />}
          variant="ghost"
          size="sm"
          onClick={loadPool}
          isLoading={loading}
        />
      </HStack>

      <Box px={4} pt={3}>
        <ButtonGroup size="sm" isAttached variant="outline" w="full">
          {DENOM_REWARD_ASSETS.map((option) => {
            const selected = option.denom === asset.denom;
            return (
              <Button
                key={option.denom}
                flex={1}
                onClick={() => setAsset(option)}
                bg={selected ? '#1a1a1a' : 'transparent'}
                borderColor={selected ? (option.colorScheme === 'green' ? 'green.500' : 'purple.500') : '#2a2a2a'}
                color={selected ? (option.colorScheme === 'green' ? 'green.300' : 'purple.300') : 'gray.400'}
                _hover={{ bg: 'whiteAlpha.100' }}
              >
                {option.symbol}
              </Button>
            );
          })}
        </ButtonGroup>
      </Box>

      <Box flex={1} overflow="auto" p={4}>
        {loading ? (
          <VStack py={8} spacing={4}>
            <Spinner size="lg" color={spinnerColor} />
            <Text color="gray.500">Loading {symbol} earn pool...</Text>
          </VStack>
        ) : !view ? (
          <VStack py={8} spacing={4}>
            <Text color="gray.500">No {symbol} DenomReward pool found</Text>
          </VStack>
        ) : (
          <VStack spacing={4} align="stretch">
            <Box
              bg="#141414"
              borderRadius="xl"
              borderWidth="1px"
              borderColor={hasStake ? accentBorder : '#2a2a2a'}
              overflow="hidden"
            >
              <HStack px={4} py={3} justify="space-between" bg="#1a1a1a">
                <VStack align="start" spacing={0}>
                  <HStack spacing={2}>
                    <Text fontSize="md" fontWeight="semibold">
                      {symbol}
                    </Text>
                    <Text fontSize="sm" color="gray.500">
                      →
                    </Text>
                    <Text fontSize="md" fontWeight="semibold" color={accentToken}>
                      {symbol}
                    </Text>
                  </HStack>
                  <Text fontSize="xs" color="gray.500">
                    Lock {view.pool.lock}d · schedule {view.daysRemaining}d left
                  </Text>
                </VStack>
                <VStack align="end" spacing={0}>
                  <Text fontSize="xs" color="gray.500">
                    APR
                  </Text>
                  <Text color="green.400" fontWeight="bold" fontSize="md">
                    ≈{view.apr}%
                  </Text>
                </VStack>
              </HStack>

              {hasStake && (
                <HStack px={4} py={3} spacing={2} bg="#0d0d0d">
                  <Box flex={1} bg="#1a1a1a" p={2} borderRadius="md">
                    <Text fontSize="9px" color={accentToken}>
                      YOUR STAKE
                    </Text>
                    <Text fontSize="sm" fontWeight="bold">
                      {formatAmount(view.userStake)} {symbol}
                    </Text>
                  </Box>
                  <Box flex={1} bg="#1a1a1a" p={2} borderRadius="md">
                    <Text fontSize="9px" color="cyan.400">
                      CLAIMABLE
                    </Text>
                    <Text fontSize="sm" fontWeight="bold">
                      {formatAmount(view.pendingRewards)} {symbol}
                    </Text>
                  </Box>
                </HStack>
              )}

              <HStack px={4} py={3} spacing={2}>
                <StatBox label="LOCK" value={`${view.pool.lock}d`} />
                <StatBox label="DAILY" value={formatAmount(view.dailyReward)} />
                <StatBox label="MIN" value={formatAmount(view.pool.min_stake)} />
                <StatBox label="TOTAL" value={formatAmount(view.pool.staked_amount)} />
              </HStack>

              <HStack px={4} pb={4} spacing={2}>
                <Button
                  flex={1}
                  size="sm"
                  variant="outline"
                  borderColor={accentBorderBtn}
                  color={accentToken}
                  _hover={{ bg: accentHoverBg, borderColor: accentHoverBorder }}
                  onClick={() => {
                    setStakeAmount('');
                    onStakeOpen();
                  }}
                >
                  {hasStake ? 'Stake More' : `Stake ${symbol}`}
                </Button>
                {hasRewards && (
                  <Button
                    flex={1}
                    size="sm"
                    variant="outline"
                    borderColor="cyan.500"
                    color="cyan.400"
                    _hover={{ bg: 'cyan.900', borderColor: 'cyan.400' }}
                    onClick={handleClaim}
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
                    onClick={onExitOpen}
                  >
                    Exit
                  </Button>
                )}
              </HStack>
            </Box>

            <Text fontSize="xs" color="gray.600" px={1}>
              DenomReward is BeeZee&apos;s long-lived per-denom pool (one each for VDL and CTL).
              Time-boxed campaigns live under Offers.
            </Text>
          </VStack>
        )}
      </Box>

      <Modal isOpen={isStakeOpen} onClose={onStakeClose} isCentered>
        <ModalOverlay bg="blackAlpha.800" />
        <ModalContent bg="#141414" borderColor="#2a2a2a" borderWidth="1px" mx={4}>
          <ModalHeader>
            Stake {symbol}
            <Text fontSize="sm" fontWeight="normal" color="gray.500">
              Earn {symbol} via DenomReward
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
                    color={accentToken}
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
                    Minimum: {formatAmount(view?.pool.min_stake || '0')} {symbol}
                  </Text>
                  <Text fontSize="xs" color={accentToken}>
                    Available: {formatAmount(walletBalance)} {symbol}
                  </Text>
                </HStack>
              </Box>

              <Divider borderColor="#2a2a2a" />

              <HStack justify="space-between">
                <Text fontSize="sm" color="gray.400">
                  Lock Period
                </Text>
                <Text fontSize="sm">{view?.pool.lock ?? 7} days</Text>
              </HStack>
              <HStack justify="space-between">
                <Text fontSize="sm" color="gray.400">
                  Daily Rewards
                </Text>
                <Text fontSize="sm">
                  {formatAmount(view?.dailyReward || '0')} {symbol}
                </Text>
              </HStack>
              <HStack justify="space-between">
                <Text fontSize="sm" color="gray.400">
                  APR
                </Text>
                <Text fontSize="sm" color="green.400">
                  ≈{view?.apr ?? 0}%
                </Text>
              </HStack>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onStakeClose}>
              Cancel
            </Button>
            <Button
              colorScheme={accent}
              onClick={handleJoin}
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
        onClose={onExitClose}
        isCentered
      >
        <AlertDialogOverlay>
          <AlertDialogContent bg="#141414" borderColor="#2a2a2a" borderWidth="1px" mx={4}>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Exit {symbol} stake?
            </AlertDialogHeader>
            <AlertDialogBody>
              Unstakes your full DenomReward position ({formatAmount(view?.userStake || '0')}{' '}
              {symbol}). A {view?.pool.lock ?? 7}-day lock applies from when you joined. Claim
              pending rewards first if you want them now.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={exitCancelRef} onClick={onExitClose} variant="ghost">
                Cancel
              </Button>
              <Button
                colorScheme="orange"
                onClick={handleExit}
                ml={3}
                isLoading={actionLoading}
              >
                Exit
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
};

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

function demoPoolView(asset: DenomRewardAsset): PoolView {
  const isCtl = asset.denom === CTL_DENOM;
  const pool: DenomReward = {
    staking_denom: asset.denom,
    lock: 7,
    min_stake: '0',
    staked_amount: isCtl ? '5900000000000' : '4500000000000',
  };
  const schedules: DenomRewardSchedule[] = [
    {
      schedule_id: 'demo',
      staking_denom: asset.denom,
      prize_denom: asset.denom,
      daily_amount: isCtl ? '15000000000' : '575000000',
      duration: isCtl ? 36500 : 3650,
      payouts: isCtl ? 21 : 2,
    },
  ];
  return {
    pool,
    schedules,
    dailyReward: schedules[0].daily_amount,
    prizeDenom: asset.denom,
    apr: estimateDenomRewardApr(schedules, pool.staked_amount),
    daysRemaining: Math.max(0, schedules[0].duration - schedules[0].payouts),
    userStake: '0',
    pendingRewards: '0',
    pending: [],
  };
}

export default DenomEarn;
