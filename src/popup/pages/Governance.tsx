import React, { useCallback, useEffect, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Divider,
  HStack,
  IconButton,
  Link,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Progress,
  Spinner,
  Text,
  VStack,
  useDisclosure,
  useToast,
} from '@chakra-ui/react';
import { ArrowBackIcon, ExternalLinkIcon, RepeatIcon } from '@chakra-ui/icons';
import { useWalletStore } from '@/store/walletStore';
import { SUPPORTED_CHAINS } from '@/lib/cosmos/chains';
import {
  VOTE_CHOICES,
  VOTE_OPTION_LABELS,
  VoteOption,
  createMsgVote,
  explorerGovHomeUrl,
  explorerProposalUrl,
  fetchMyVote,
  fetchProposalTally,
  fetchProposals,
  formatVotingEnd,
  isVotingPeriod,
  proposalStatusColor,
  proposalStatusLabel,
  tallyTotals,
  type GovernanceProposal,
  type VoteOptionValue,
} from '@/lib/cosmos/governance';
import { isDemoSession } from '@/lib/demo/session';

interface GovernanceProps {
  onBack: () => void;
}

const Governance: React.FC<GovernanceProps> = ({ onBack }) => {
  const { getAddressForChain, signAndBroadcast, isDemo } = useWalletStore();
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();

  const [loading, setLoading] = useState(true);
  const [proposals, setProposals] = useState<GovernanceProposal[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [myVotes, setMyVotes] = useState<Record<string, VoteOptionValue>>({});
  const [voteTarget, setVoteTarget] = useState<GovernanceProposal | null>(null);
  const [selectedOption, setSelectedOption] = useState<VoteOptionValue>(VoteOption.YES);
  const [submitting, setSubmitting] = useState(false);

  const chainConfig = SUPPORTED_CHAINS.get('beezee-1');
  const address = getAddressForChain(chainConfig?.bech32Config.bech32PrefixAccAddr || 'bze') || '';
  const demo = isDemo || isDemoSession();

  const loadProposals = useCallback(async () => {
    if (!chainConfig) return;
    setLoading(true);
    try {
      const list = await fetchProposals(chainConfig.rest, { limit: 40, reverse: true });

      // Refresh live tallies for voting-period proposals
      const enriched = await Promise.all(
        list.map(async (p) => {
          if (!isVotingPeriod(p.status)) return p;
          try {
            const tally = await fetchProposalTally(chainConfig.rest, p.id);
            return { ...p, tally };
          } catch {
            return p;
          }
        })
      );
      setProposals(enriched);

      // Prefer expanding first voting proposal
      const voting = enriched.find((p) => isVotingPeriod(p.status));
      if (voting) setExpandedId(voting.id);

      if (address && !demo) {
        const votes: Record<string, VoteOptionValue> = {};
        await Promise.all(
          enriched
            .filter((p) => isVotingPeriod(p.status))
            .map(async (p) => {
              const vote = await fetchMyVote(chainConfig.rest, p.id, address);
              if (vote) votes[p.id] = vote;
            })
        );
        setMyVotes(votes);
      }
    } catch (error) {
      console.error('Failed to load proposals:', error);
      toast({
        title: 'Could not load proposals',
        description: error instanceof Error ? error.message : 'Network error',
        status: 'error',
        duration: 4000,
      });
      setProposals([]);
    } finally {
      setLoading(false);
    }
  }, [address, chainConfig, demo, toast]);

  useEffect(() => {
    loadProposals();
  }, [loadProposals]);

  const openVoteModal = (proposal: GovernanceProposal) => {
    setVoteTarget(proposal);
    setSelectedOption(myVotes[proposal.id] ?? VoteOption.YES);
    onOpen();
  };

  const handleVote = async () => {
    if (!voteTarget || !address) {
      toast({
        title: 'Cannot vote',
        description: !address ? 'Unlock wallet to vote' : 'No proposal selected',
        status: 'warning',
        duration: 3000,
      });
      return;
    }
    const proposalId = voteTarget.id;
    const option = selectedOption;
    setSubmitting(true);
    try {
      const msg = createMsgVote(proposalId, address, option);
      const txHash = await signAndBroadcast('beezee-1', [msg], undefined, '');
      const optionLabel = VOTE_OPTION_LABELS[option];
      // Optimistic local vote marker (demo + immediate UI)
      setMyVotes((prev) => ({ ...prev, [proposalId]: option }));
      setExpandedId(proposalId);
      onClose();
      toast({
        title: demo ? 'Demo vote recorded' : 'Vote submitted',
        description: demo
          ? `${optionLabel} on #${proposalId} (not broadcast)`
          : `${optionLabel} · tx ${String(txHash).slice(0, 12)}…`,
        status: 'success',
        duration: 5000,
        isClosable: true,
        position: 'top',
      });
      if (!demo) await loadProposals();
    } catch (error) {
      console.error('Vote failed:', error);
      toast({
        title: 'Vote failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const voting = proposals.filter((p) => isVotingPeriod(p.status));
  const others = proposals.filter((p) => !isVotingPeriod(p.status));

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
                Governance
              </Text>
              <Badge colorScheme="cyan" fontSize="xs">
                BeeZee
              </Badge>
            </HStack>
            <Text fontSize="xs" color="gray.500">
              Proposals & votes · MsgVote
            </Text>
          </VStack>
        </HStack>
        <HStack spacing={1}>
          <IconButton
            aria-label="Open explorer"
            as="a"
            href={explorerGovHomeUrl()}
            target="_blank"
            rel="noopener noreferrer"
            icon={<ExternalLinkIcon />}
            variant="ghost"
            size="sm"
            color="gray.500"
            _hover={{ color: 'cyan.400' }}
          />
          <IconButton
            aria-label="Refresh"
            icon={<RepeatIcon />}
            variant="ghost"
            size="sm"
            onClick={loadProposals}
            isLoading={loading}
          />
        </HStack>
      </HStack>

      <Box flex={1} overflow="auto" p={4}>
        {loading ? (
          <VStack py={8} spacing={4}>
            <Spinner size="lg" color="cyan.400" />
            <Text color="gray.500">Loading proposals…</Text>
          </VStack>
        ) : proposals.length === 0 ? (
          <VStack py={10} spacing={3} textAlign="center">
            <Text color="gray.400" fontWeight="medium">
              No proposals found
            </Text>
            <Text fontSize="sm" color="gray.600" maxW="260px">
              BeeZee LCD returned an empty list. Check the explorer or try again later.
            </Text>
            <Link
              href={explorerGovHomeUrl()}
              isExternal
              fontSize="sm"
              color="cyan.400"
              display="inline-flex"
              alignItems="center"
              gap={1}
            >
              Open explorer <ExternalLinkIcon mx="2px" />
            </Link>
          </VStack>
        ) : (
          <VStack spacing={4} align="stretch">
            {demo && (
              <Box
                bg="#1a1510"
                borderRadius="lg"
                borderWidth="1px"
                borderColor="yellow.800"
                px={3}
                py={2}
              >
                <Text fontSize="xs" color="yellow.200">
                  Demo mode — votes stay local and are not broadcast.
                </Text>
              </Box>
            )}

            <SectionLabel
              label="Voting now"
              count={voting.length}
              hint={voting.length === 0 ? 'None open — showing recent history below' : undefined}
            />
            {voting.length === 0 ? (
              <Box
                bg="#141414"
                borderRadius="xl"
                borderWidth="1px"
                borderColor="#2a2a2a"
                px={4}
                py={5}
                textAlign="center"
              >
                <Text fontSize="sm" color="gray.500">
                  No proposals in voting period
                </Text>
                <Text fontSize="xs" color="gray.600" mt={1}>
                  You can still browse recent proposals below
                </Text>
              </Box>
            ) : (
              <VStack spacing={3} align="stretch">
                {voting.map((p) => (
                  <ProposalCard
                    key={p.id}
                    proposal={p}
                    expanded={expandedId === p.id}
                    myVote={myVotes[p.id]}
                    canVote={Boolean(address)}
                    onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)}
                    onVote={() => openVoteModal(p)}
                  />
                ))}
              </VStack>
            )}

            {others.length > 0 && (
              <>
                <SectionLabel label="Recent" count={others.length} />
                <VStack spacing={3} align="stretch">
                  {others.map((p) => (
                    <ProposalCard
                      key={p.id}
                      proposal={p}
                      expanded={expandedId === p.id}
                      myVote={myVotes[p.id]}
                      canVote={false}
                      onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)}
                      onVote={() => openVoteModal(p)}
                    />
                  ))}
                </VStack>
              </>
            )}
          </VStack>
        )}
      </Box>

      <Modal isOpen={isOpen} onClose={onClose} isCentered>
        <ModalOverlay bg="blackAlpha.800" />
        <ModalContent bg="#141414" borderColor="#2a2a2a" borderWidth="1px" mx={4}>
          <ModalHeader pr={10}>
            Vote on #{voteTarget?.id}
            <Text fontSize="sm" fontWeight="normal" color="gray.500" noOfLines={2} mt={1}>
              {voteTarget?.title}
            </Text>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={2} align="stretch">
              {VOTE_CHOICES.map((choice) => {
                const active = selectedOption === choice.option;
                return (
                  <Button
                    key={choice.option}
                    variant={active ? 'solid' : 'outline'}
                    colorScheme={
                      choice.option === VoteOption.YES
                        ? 'green'
                        : choice.option === VoteOption.NO
                          ? 'red'
                          : choice.option === VoteOption.NO_WITH_VETO
                            ? 'orange'
                            : 'gray'
                    }
                    justifyContent="flex-start"
                    onClick={() => setSelectedOption(choice.option)}
                    size="sm"
                  >
                    {choice.label}
                  </Button>
                );
              })}
              {!address && (
                <Text fontSize="xs" color="red.300">
                  Unlock your wallet to vote.
                </Text>
              )}
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={2} onClick={onClose} isDisabled={submitting}>
              Cancel
            </Button>
            <Button
              colorScheme="cyan"
              onClick={handleVote}
              isLoading={submitting}
              isDisabled={!address}
            >
              Confirm vote
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

function SectionLabel({
  label,
  count,
  hint,
}: {
  label: string;
  count: number;
  hint?: string;
}) {
  return (
    <HStack justify="space-between" align="baseline">
      <HStack spacing={2}>
        <Text fontSize="xs" fontWeight="semibold" color="gray.400" textTransform="uppercase">
          {label}
        </Text>
        <Badge colorScheme="gray" fontSize="xs">
          {count}
        </Badge>
      </HStack>
      {hint && (
        <Text fontSize="xs" color="gray.600" noOfLines={1} maxW="55%" textAlign="right">
          {hint}
        </Text>
      )}
    </HStack>
  );
}

interface ProposalCardProps {
  proposal: GovernanceProposal;
  expanded: boolean;
  myVote?: VoteOptionValue;
  canVote: boolean;
  onToggle: () => void;
  onVote: () => void;
}

const ProposalCard: React.FC<ProposalCardProps> = ({
  proposal,
  expanded,
  myVote,
  canVote,
  onToggle,
  onVote,
}) => {
  const voting = isVotingPeriod(proposal.status);
  const { percents, total } = tallyTotals(proposal.tally);

  return (
    <Box
      bg="#141414"
      borderRadius="xl"
      borderWidth="1px"
      borderColor={voting ? 'cyan.800' : '#2a2a2a'}
      overflow="hidden"
    >
      <Box px={3} py={3} cursor="pointer" onClick={onToggle} _hover={{ bg: 'whiteAlpha.50' }}>
        <HStack justify="space-between" align="start" mb={1}>
          <HStack spacing={2} align="start">
            <Badge colorScheme="gray" fontSize="xs" mt="2px">
              #{proposal.id}
            </Badge>
            <Text fontSize="sm" fontWeight="medium" noOfLines={expanded ? undefined : 2}>
              {proposal.title}
            </Text>
          </HStack>
          <Badge colorScheme={proposalStatusColor(proposal.status)} fontSize="xs" flexShrink={0}>
            {proposalStatusLabel(proposal.status)}
          </Badge>
        </HStack>
        <HStack spacing={3} fontSize="xs" color="gray.500" mt={1}>
          <Text>Ends {formatVotingEnd(proposal.votingEndTime)}</Text>
          {myVote != null && (
            <Badge colorScheme="purple" fontSize="xs">
              You: {VOTE_OPTION_LABELS[myVote]}
            </Badge>
          )}
        </HStack>
      </Box>

      {expanded && (
        <>
          <Divider borderColor="#2a2a2a" />
          <VStack align="stretch" spacing={3} px={3} py={3}>
            {proposal.summary ? (
              <Text fontSize="xs" color="gray.400" whiteSpace="pre-wrap">
                {proposal.summary.length > 600
                  ? `${proposal.summary.slice(0, 600)}…`
                  : proposal.summary}
              </Text>
            ) : (
              <Text fontSize="xs" color="gray.600">
                No summary provided.
              </Text>
            )}

            {total > 0 && (
              <Box>
                <Text fontSize="xs" color="gray.500" mb={2}>
                  Tally
                </Text>
                <TallyBar label="Yes" percent={percents.yes} colorScheme="green" />
                <TallyBar label="No" percent={percents.no} colorScheme="red" />
                <TallyBar label="Abstain" percent={percents.abstain} colorScheme="gray" />
                <TallyBar label="Veto" percent={percents.noWithVeto} colorScheme="orange" />
              </Box>
            )}

            <HStack spacing={2} justify="space-between">
              <Link
                href={explorerProposalUrl(proposal.id)}
                isExternal
                fontSize="xs"
                color="cyan.400"
                onClick={(e) => e.stopPropagation()}
              >
                Explorer <ExternalLinkIcon mx="2px" />
              </Link>
              {voting && canVote && (
                <Button
                  size="xs"
                  colorScheme={myVote != null ? 'purple' : 'cyan'}
                  variant={myVote != null ? 'outline' : 'solid'}
                  onClick={(e) => {
                    e.stopPropagation();
                    onVote();
                  }}
                >
                  {myVote != null ? `Voted: ${VOTE_OPTION_LABELS[myVote]}` : 'Vote'}
                </Button>
              )}
            </HStack>
          </VStack>
        </>
      )}
    </Box>
  );
};

function TallyBar({
  label,
  percent,
  colorScheme,
}: {
  label: string;
  percent: number;
  colorScheme: string;
}) {
  return (
    <HStack mb={1.5} spacing={2}>
      <Text fontSize="xs" color="gray.500" w="52px" flexShrink={0}>
        {label}
      </Text>
      <Progress
        value={percent}
        size="sm"
        colorScheme={colorScheme}
        borderRadius="full"
        flex={1}
        bg="#1a1a1a"
      />
      <Text fontSize="xs" color="gray.500" w="40px" textAlign="right">
        {percent.toFixed(0)}%
      </Text>
    </HStack>
  );
}

export default Governance;
