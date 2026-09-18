import React from 'react';
import { Box, Text, VStack } from '@chakra-ui/react';
import {
  formatCatalogReviewMonth,
  getSupportedNetworkFamilyLabel,
  getSupportedNetworkFamilySummary,
  getSupportedNetworksByFamily,
  SUPPORTED_NETWORK_CATALOG_REVIEWED_AT,
  type SupportedNetworkFamily,
} from '@/lib/networks/supported-catalog';
import {
  formatUtxoExplorerLine,
  getEnabledUtxoExplorerSummaries,
  UTXO_ENDPOINTS_REVIEWED_AT,
} from '@/lib/networks/utxo-endpoints';

const FAMILY_ORDER: SupportedNetworkFamily[] = ['cosmos', 'utxo', 'evm', 'svm'];

const SupportedNetworksPanel: React.FC = () => {
  const byFamily = getSupportedNetworksByFamily();
  const reviewedMonth = formatCatalogReviewMonth(SUPPORTED_NETWORK_CATALOG_REVIEWED_AT);
  const utxoExplorers = getEnabledUtxoExplorerSummaries();
  const explorerReviewMonth = formatCatalogReviewMonth(UTXO_ENDPOINTS_REVIEWED_AT);

  return (
    <Box>
      <Text fontSize="lg" color="white" mb={1} fontWeight="semibold">
        Supported networks
      </Text>
      <Text fontSize="md" color="gray.300" mb={4} lineHeight="tall">
        This wallet can hold your assets on the network types below. Reviewed {reviewedMonth}.
      </Text>

      <VStack spacing={3} align="stretch">
        {FAMILY_ORDER.map((family) => {
          const networks = byFamily[family];
          const names = networks.map((network) => network.name).join(', ');

          return (
            <Box
              key={family}
              p={4}
              bg="#141414"
              borderRadius="lg"
              border="1px"
              borderColor="#2a2a2a"
            >
              <Text fontSize="md" color="white" fontWeight="medium">
                {getSupportedNetworkFamilyLabel(family)}
              </Text>
              <Text fontSize="md" color="gray.300" mt={1} lineHeight="tall">
                {getSupportedNetworkFamilySummary(family)}
              </Text>
              <Text fontSize="md" color="gray.400" mt={2} lineHeight="tall">
                {names}
              </Text>
            </Box>
          );
        })}
      </VStack>

      <Box mt={6}>
        <Text fontSize="lg" color="white" mb={1} fontWeight="semibold">
          Bitcoin-like explorers
        </Text>
        <Text fontSize="md" color="gray.300" mb={4} lineHeight="tall">
          When you look up a Bitcoin-like address, this wallet opens these websites. Checked{' '}
          {explorerReviewMonth}.
        </Text>
        <VStack spacing={2} align="stretch">
          {utxoExplorers.map((summary) => (
            <Text key={summary.id} fontSize="md" color="gray.200" lineHeight="tall">
              {formatUtxoExplorerLine(summary)}
            </Text>
          ))}
        </VStack>
      </Box>
    </Box>
  );
};

export default SupportedNetworksPanel;
