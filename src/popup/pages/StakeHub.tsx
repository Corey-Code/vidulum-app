import React from 'react';
import { Badge, Box, HStack, IconButton, Text, VStack } from '@chakra-ui/react';
import { ArrowBackIcon, ChevronRightIcon } from '@chakra-ui/icons';

/** Destinations the Stake hub can open. */
export type StakeHubTarget = 'native-bze' | 'denom-vdl' | 'denom-ctl';

interface StakeOption {
  id: StakeHubTarget;
  title: string;
  subtitle: string;
  badge: string;
  badgeColorScheme: string;
  meta: Array<{ label: string; value: string }>;
}

/** Non-offer staking surfaces on BeeZee. */
const STAKE_OPTIONS: StakeOption[] = [
  {
    id: 'native-bze',
    title: 'Stake BZE',
    subtitle: 'Native validators · earn BZE',
    badge: 'Native',
    badgeColorScheme: 'cyan',
    meta: [
      { label: 'ASSET', value: 'BZE' },
      { label: 'EARN', value: 'BZE' },
      { label: 'KIND', value: 'Validators' },
      { label: 'EXIT', value: 'Unbond' },
    ],
  },
  {
    id: 'denom-vdl',
    title: 'Stake VDL',
    subtitle: 'Stake VDL to earn VDL',
    badge: 'Earn VDL',
    badgeColorScheme: 'purple',
    meta: [
      { label: 'ASSET', value: 'VDL' },
      { label: 'EARN', value: 'VDL' },
      { label: 'KIND', value: 'Earn pool' },
      { label: 'EXIT', value: 'Exit fee' },
    ],
  },
  {
    id: 'denom-ctl',
    title: 'Stake CTL',
    subtitle: 'Stake CTL to earn CTL',
    badge: 'Earn CTL',
    badgeColorScheme: 'green',
    meta: [
      { label: 'ASSET', value: 'CTL' },
      { label: 'EARN', value: 'CTL' },
      { label: 'KIND', value: 'Earn pool' },
      { label: 'EXIT', value: 'Exit fee' },
    ],
  },
];

interface StakeHubProps {
  onBack: () => void;
  onSelect: (target: StakeHubTarget) => void;
}

const StakeHub: React.FC<StakeHubProps> = ({ onBack, onSelect }) => {
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
                Stake
              </Text>
              <Badge colorScheme="cyan" fontSize="xs">
                BeeZee
              </Badge>
            </HStack>
            <Text fontSize="xs" color="gray.500">
              Validator & earn staking · not Offers
            </Text>
          </VStack>
        </HStack>
      </HStack>

      <Box flex={1} overflow="auto" p={4}>
        <VStack spacing={3} align="stretch">
          {STAKE_OPTIONS.map((option) => (
            <StakeOptionCard
              key={option.id}
              option={option}
              onSelect={() => onSelect(option.id)}
            />
          ))}
        </VStack>
      </Box>
    </Box>
  );
};

interface StakeOptionCardProps {
  option: StakeOption;
  onSelect: () => void;
}

const StakeOptionCard: React.FC<StakeOptionCardProps> = ({ option, onSelect }) => (
  <Box
    bg="#141414"
    borderRadius="xl"
    borderWidth="1px"
    borderColor="#2a2a2a"
    overflow="hidden"
    cursor="pointer"
    onClick={onSelect}
    transition="border-color 0.2s"
    _hover={{ borderColor: '#3a3a3a' }}
    role="button"
    aria-label={option.title}
  >
    <HStack px={3} py={2} justify="space-between" bg="#1a1a1a">
      <VStack align="start" spacing={0}>
        <HStack spacing={2}>
          <Text fontSize="sm" fontWeight="semibold">
            {option.title}
          </Text>
          <Badge colorScheme={option.badgeColorScheme} fontSize="9px">
            {option.badge}
          </Badge>
        </HStack>
        <Text fontSize="xs" color="gray.500">
          {option.subtitle}
        </Text>
      </VStack>
      <ChevronRightIcon color="gray.500" boxSize={5} />
    </HStack>

    <HStack px={3} py={2} spacing={1}>
      {option.meta.map((item) => (
        <Box key={item.label} flex="1" minW="60px" bg="#1a1a1a" px={2} py={1} borderRadius="md">
          <Text fontSize="8px" color="gray.500">
            {item.label}
          </Text>
          <Text fontSize="xs" fontWeight="medium" isTruncated>
            {item.value}
          </Text>
        </Box>
      ))}
    </HStack>
  </Box>
);

export default StakeHub;
